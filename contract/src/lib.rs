//! Mintless: a market town on NEAR whose money emerges from barter.
//!
//! * No mint method exists. The supply of every good is fixed in `new`;
//!   afterwards goods only move (`swap`, `mt_transfer`) or rot (burned).
//! * The 40 traders live in contract state. Anyone can call `tick` to advance
//!   the town; nobody can change its rules (see `rules()` and `rules_hash`).
//! * There is no owner, no admin method and no upgrade method. After deploy
//!   the account's last access key is deleted (see ../tools/chain.mjs).
//! * The shipwright (`build`) recomputes the town from its seed, so what counts
//!   as money on a given day is decided here, not by the browser.
//!
//! Items follow NEP-245 (multi token) for transfers, balances, supply and
//! events. Not implemented on purpose: approvals and `*_transfer_call`.

mod engine;

use engine::{spoil_units, swap_quote, Rules, Town};
use near_sdk::json_types::{U128, U64};
use near_sdk::serde_json::json;
use near_sdk::store::LookupMap;
use near_sdk::{env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault};

/// Percent of every swap kept by the town stall.
pub const SWAP_FEE: u64 = 5;
/// Most days one `tick` call may advance (keeps gas bounded).
pub const MAX_TICK_DAYS: u32 = 10;
/// What each boat part costs, in units of the town's money that day.
pub const PART_COST: [u64; 4] = [4, 6, 8, 10];
/// The town trades three of its days each night of a season.
pub const TOWN_DAYS_PER_NIGHT: u32 = 3;
/// A season is ten days, so the last morning is town day 27.
pub const LAST_TOWN_DAY: u32 = 27;

#[derive(BorshStorageKey)]
#[near(serializers = [borsh])]
enum StorageKey {
    Bags,
    Boats,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Bag {
    pub units: Vec<u64>,
    pub carry: Vec<u32>,
    /// Town day up to which spoilage has been applied.
    pub day: u32,
}

/// A player's boat. `paid` is units per good burned at the shipyard.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Boat {
    pub parts: u8,
    pub town_day: u32,
    pub paid: Vec<u64>,
}

#[near(serializers = [json])]
pub struct TownView {
    pub name: String,
    pub day: u32,
    pub season_days: u32,
    pub max_days: u32,
    pub day_seconds: U64,
    pub money: Option<String>,
    pub accept_permille: Vec<u32>,
    pub prices: Vec<u64>,
    pub spoil_percent: Vec<u32>,
    pub holds: Vec<u8>,
    pub fed_total: u64,
    pub seed: u32,
    pub rules_hash: String,
    pub players: u32,
    pub bags_left: u32,
}

#[near(serializers = [json])]
pub struct MtToken {
    pub token_id: String,
    pub owner_id: Option<AccountId>,
}

#[derive(PanicOnDefault)]
#[near(contract_state)]
pub struct Contract {
    town: Town,
    seed: u32,
    rules_json: String,
    rules_hash: String,
    start_ns: u64,
    day_seconds: u64,
    max_days: u32,
    starter: Vec<u64>,
    bags_left: u32,
    players: u32,
    /// Stock of the town stall, held by this contract account. It does not spoil.
    stall: Vec<u64>,
    supply: Vec<u128>,
    bags: LookupMap<AccountId, Bag>,
    boats: LookupMap<AccountId, Boat>,
}

fn emit(event: &str, data: near_sdk::serde_json::Value) {
    let ev = json!({ "standard": "nep245", "version": "1.0.0", "event": event, "data": [data] });
    env::log_str(&format!("EVENT_JSON:{}", ev));
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

#[near]
impl Contract {
    /// Birth of the town. `stall` and `starter` are units per good, in the
    /// order of `rules.goods`. Total supply = stall + starter x bags, forever.
    #[init]
    pub fn new(rules_json: String, seed: u32, day_seconds: U64, max_days: u32, stall: Vec<U64>, starter: Vec<U64>, bags: u32) -> Self {
        require!(!env::state_exists(), "Already initialized");
        let rules: Rules = near_sdk::serde_json::from_str(&rules_json).unwrap_or_else(|_| env::panic_str("rules_json is not valid town rules"));
        let goods = rules.goods.len();
        require!(stall.len() == goods && starter.len() == goods, "stall and starter need one amount per good");
        require!(max_days >= rules.season_days, "max_days must cover the season");
        let starter: Vec<u64> = starter.iter().map(|u| u.0).collect();
        let stall: Vec<u64> = stall.iter().enumerate().map(|(g, u)| u.0 + starter[g] * bags as u64).collect();
        let supply: Vec<u128> = stall.iter().map(|u| *u as u128).collect();
        let rules_hash = hex(&env::sha256(rules_json.as_bytes()));
        let token_ids: Vec<String> = rules.goods.iter().map(|g| g.key.clone()).collect();
        emit(
            "mt_mint",
            json!({ "owner_id": env::current_account_id(), "token_ids": token_ids, "amounts": supply.iter().map(|s| s.to_string()).collect::<Vec<_>>(), "memo": "genesis: the only mint, ever" }),
        );
        Self {
            town: Town::new(rules, seed),
            seed,
            rules_json,
            rules_hash,
            start_ns: env::block_timestamp(),
            day_seconds: day_seconds.0,
            max_days,
            starter,
            bags_left: bags,
            players: 0,
            stall,
            supply,
            bags: LookupMap::new(StorageKey::Bags),
            boats: LookupMap::new(StorageKey::Boats),
        }
    }

    // ------------------------------------------------------------ town

    /// Advance the town by up to `days` days. Anyone may call it. A town with
    /// `day_seconds > 0` cannot run ahead of the clock.
    pub fn tick(&mut self, days: u32) -> TownView {
        let allowed = if self.day_seconds == 0 {
            self.max_days
        } else {
            let elapsed = (env::block_timestamp() - self.start_ns) / 1_000_000_000 / self.day_seconds;
            std::cmp::min(self.max_days as u64, elapsed) as u32
        };
        require!(self.town.day < allowed, "the town is up to date");
        let n = days.min(MAX_TICK_DAYS).min(allowed - self.town.day);
        require!(n > 0, "days must be at least 1");
        for _ in 0..n {
            self.town.step();
        }
        let view = self.town();
        env::log_str(&format!("day {}: money = {}", view.day, view.money.clone().unwrap_or_else(|| "none yet".into())));
        view
    }

    pub fn town(&self) -> TownView {
        let money = self.town.money();
        TownView {
            name: self.town.rules.name.clone(),
            day: self.town.day,
            season_days: self.town.rules.season_days,
            max_days: self.max_days,
            day_seconds: U64(self.day_seconds),
            money: if money < 0 { None } else { Some(self.town.rules.goods[money as usize].key.clone()) },
            accept_permille: self.town.acceptance(),
            prices: self.town.prices(),
            spoil_percent: self.town.spoil.clone(),
            holds: self.town.agents.iter().map(|a| a.holds).collect(),
            fed_total: self.town.agents.iter().map(|a| a.fed as u64).sum(),
            seed: self.seed,
            rules_hash: self.rules_hash.clone(),
            players: self.players,
            bags_left: self.bags_left,
        }
    }

    /// FNV-1a of the whole town state; equals stateHash() of the JS engine
    /// for the same rules, seed and day.
    pub fn fingerprint(&self) -> String {
        self.town.state_hash()
    }

    /// The exact rules text this town was born with (sha256 = `rules_hash`).
    pub fn rules(&self) -> String {
        self.rules_json.clone()
    }

    /// A trader's notebook, for the "why" tooltip.
    pub fn trader(&self, index: u32) -> engine::Agent {
        self.town.agents.get(index as usize).cloned().unwrap_or_else(|| env::panic_str("no such trader"))
    }

    // ------------------------------------------------------------ players

    /// Take one starter bag from the town chest. Once per account.
    pub fn join(&mut self) -> Bag {
        let who = env::predecessor_account_id();
        require!(!self.bags.contains_key(&who), "already joined");
        require!(self.bags_left > 0, "the starter chest is empty");
        for g in 0..self.starter.len() {
            self.stall[g] -= self.starter[g];
        }
        let bag = Bag { units: self.starter.clone(), carry: vec![0; self.starter.len()], day: self.town.day };
        self.bags.insert(who.clone(), bag.clone());
        self.bags_left -= 1;
        self.players += 1;
        self.emit_move(&env::current_account_id(), &who, &self.starter.clone(), "starter bag");
        bag
    }

    /// Swap `amount` units of `give` for `get` at today's town prices
    /// (5% stays with the stall). Returns units received.
    pub fn swap(&mut self, give: String, amount: U64, get: String) -> U64 {
        let who = env::predecessor_account_id();
        let (from, to) = (self.good(&give), self.good(&get));
        require!(from != to, "pick two different goods");
        let mut bag = self.settled(&who);
        require!(amount.0 > 0 && amount.0 <= bag.units[from], "not enough in your bag");
        let prices = self.town.prices();
        let got = swap_quote(amount.0, prices[from], prices[to], SWAP_FEE);
        require!(got > 0, "amount too small for one unit");
        require!(self.stall[to] >= got, "the stall has run out of that good");
        bag.units[from] -= amount.0;
        bag.units[to] += got;
        self.stall[from] += amount.0;
        self.stall[to] -= got;
        self.bags.insert(who.clone(), bag);
        let me = env::current_account_id();
        let mut gave = vec![0; self.stall.len()];
        gave[from] = amount.0;
        self.emit_move(&who, &me, &gave, "swap");
        let mut took = vec![0; self.stall.len()];
        took[to] = got;
        self.emit_move(&me, &who, &took, "swap");
        U64(got)
    }

    /// Pay the shipwright for boat part `part` on town day `town_day`, in the
    /// good the town accepts most that day. The town is recomputed from its seed
    /// and rules, so the browser cannot choose the day's money. Payment burns
    /// goods from the caller's bag; part 0 starts a new boat.
    pub fn build(&mut self, part: u8, town_day: u32, good: String) -> Boat {
        let who = env::predecessor_account_id();
        let cost = *PART_COST.get(part as usize).unwrap_or_else(|| env::panic_str("the boat has four parts"));
        require!(town_day % TOWN_DAYS_PER_NIGHT == 0 && town_day <= LAST_TOWN_DAY, "not a morning of the season");
        let goods = self.stall.len();
        let mut boat = match self.boats.get(&who) {
            Some(b) if part > 0 => b.clone(),
            _ => Boat { parts: 0, town_day: 0, paid: vec![0; goods] },
        };
        require!(boat.parts == part, "build the parts in order");
        require!(town_day >= boat.town_day, "that morning has passed");
        let g = self.good(&good);
        let takes = self.shop_good(town_day);
        require!(g == takes, format!("the shipwright takes {} that day", self.town.rules.goods[takes].key));
        let mut bag = self.settled(&who);
        require!(bag.units[g] >= cost, "not enough in your bag");
        bag.units[g] -= cost;
        self.supply[g] -= cost as u128;
        self.bags.insert(who.clone(), bag);
        boat.parts += 1;
        boat.town_day = town_day;
        boat.paid[g] += cost;
        self.boats.insert(who.clone(), boat.clone());
        emit("mt_burn", json!({ "owner_id": who, "token_ids": [good], "amounts": [cost.to_string()], "memo": "paid the shipwright" }));
        boat
    }

    /// Which good the shipwright takes on `town_day`, from the seed and rules alone.
    pub fn shipyard(&self, town_day: u32) -> String {
        require!(town_day <= LAST_TOWN_DAY, "not a day of the season");
        self.town.rules.goods[self.shop_good(town_day)].key.clone()
    }

    pub fn boat_of(&self, account_id: AccountId) -> Option<Boat> {
        self.boats.get(&account_id).cloned()
    }

    /// Bring a bag's spoilage up to today (rot is burned). Anyone may call it.
    pub fn settle(&mut self, account_id: AccountId) -> Bag {
        let bag = self.settled(&account_id);
        self.bags.insert(account_id, bag.clone());
        bag
    }

    pub fn bag_of(&self, account_id: AccountId) -> Option<Bag> {
        self.bags.get(&account_id).map(|b| self.spoiled(b.clone()).0)
    }

    pub fn stall(&self) -> Vec<U64> {
        self.stall.iter().map(|u| U64(*u)).collect()
    }

    // ------------------------------------------------------------ NEP-245

    #[payable]
    pub fn mt_transfer(&mut self, receiver_id: AccountId, token_id: String, amount: U128, approval: Option<(AccountId, u64)>, memo: Option<String>) {
        self.mt_batch_transfer(receiver_id, vec![token_id], vec![amount], approval.map(|a| vec![Some(a)]), memo);
    }

    #[payable]
    pub fn mt_batch_transfer(&mut self, receiver_id: AccountId, token_ids: Vec<String>, amounts: Vec<U128>, approvals: Option<Vec<Option<(AccountId, u64)>>>, memo: Option<String>) {
        require!(env::attached_deposit() == NearToken::from_yoctonear(1), "attach exactly 1 yoctoNEAR");
        require!(approvals.is_none(), "approvals are not supported");
        require!(token_ids.len() == amounts.len(), "token_ids and amounts differ in length");
        let sender = env::predecessor_account_id();
        require!(sender != receiver_id, "sender and receiver are the same");
        require!(self.bags.contains_key(&receiver_id), "receiver has not joined the town");
        let mut from = self.settled(&sender);
        let mut to = self.settled(&receiver_id);
        let mut moved = vec![0u64; self.stall.len()];
        for (t, a) in token_ids.iter().zip(amounts.iter()) {
            let g = self.good(t);
            let n = u64::try_from(a.0).unwrap_or_else(|_| env::panic_str("amount too large"));
            require!(n > 0 && from.units[g] >= n, "not enough in your bag");
            from.units[g] -= n;
            to.units[g] += n;
            moved[g] += n;
        }
        self.bags.insert(sender.clone(), from);
        self.bags.insert(receiver_id.clone(), to);
        self.emit_move(&sender, &receiver_id, &moved, memo.as_deref().unwrap_or("transfer"));
    }

    pub fn mt_balance_of(&self, account_id: AccountId, token_id: String) -> U128 {
        let g = self.good(&token_id);
        if account_id == env::current_account_id() {
            return U128(self.stall[g] as u128);
        }
        U128(self.bag_of(account_id).map(|b| b.units[g] as u128).unwrap_or(0))
    }

    pub fn mt_batch_balance_of(&self, account_id: AccountId, token_ids: Vec<String>) -> Vec<U128> {
        token_ids.into_iter().map(|t| self.mt_balance_of(account_id.clone(), t)).collect()
    }

    pub fn mt_supply(&self, token_id: String) -> Option<U128> {
        Some(U128(self.supply[self.good(&token_id)]))
    }

    pub fn mt_batch_supply(&self, token_ids: Vec<String>) -> Vec<Option<U128>> {
        token_ids.into_iter().map(|t| self.mt_supply(t)).collect()
    }

    pub fn mt_token(&self, token_ids: Vec<String>) -> Vec<Option<MtToken>> {
        token_ids
            .into_iter()
            .map(|t| self.town.rules.goods.iter().any(|g| g.key == t).then(|| MtToken { token_id: t, owner_id: None }))
            .collect()
    }

    // ------------------------------------------------------------ internal

    fn good(&self, key: &str) -> usize {
        self.town.rules.goods.iter().position(|g| g.key == key).unwrap_or_else(|| env::panic_str("unknown good"))
    }

    /// Bag with spoilage applied up to today, plus units rotted per good.
    fn spoiled(&self, mut bag: Bag) -> (Bag, Vec<u64>) {
        let mut rot = vec![0u64; bag.units.len()];
        for day in (bag.day + 1)..=self.town.day {
            let spoil = self.town.spoil_on(day);
            for g in 0..bag.units.len() {
                rot[g] += spoil_units(&mut bag.units[g], &mut bag.carry[g], spoil[g]);
            }
        }
        bag.day = self.town.day;
        (bag, rot)
    }

    fn settled(&mut self, who: &AccountId) -> Bag {
        let bag = self.bags.get(who).cloned().unwrap_or_else(|| env::panic_str("join the town first"));
        let (bag, rot) = self.spoiled(bag);
        if rot.iter().any(|r| *r > 0) {
            for (g, r) in rot.iter().enumerate() {
                self.supply[g] -= *r as u128;
            }
            let (ids, amounts) = self.nonzero(&rot);
            emit("mt_burn", json!({ "owner_id": who, "token_ids": ids, "amounts": amounts, "memo": "spoiled" }));
        }
        bag
    }

    // The first good with the highest acceptance, same as shopGood() in engine/island.js.
    fn shop_good(&self, town_day: u32) -> usize {
        let mut town = Town::new(self.town.rules.clone(), self.seed);
        for _ in 0..town_day {
            town.step();
        }
        let accept = town.acceptance();
        let top = *accept.iter().max().unwrap_or(&0);
        accept.iter().position(|a| *a == top).unwrap_or(0)
    }

    fn nonzero(&self, units: &[u64]) -> (Vec<String>, Vec<String>) {
        let mut ids = Vec::new();
        let mut amounts = Vec::new();
        for (g, u) in units.iter().enumerate() {
            if *u > 0 {
                ids.push(self.town.rules.goods[g].key.clone());
                amounts.push(u.to_string());
            }
        }
        (ids, amounts)
    }

    fn emit_move(&self, from: &AccountId, to: &AccountId, units: &[u64], memo: &str) {
        let (ids, amounts) = self.nonzero(units);
        if !ids.is_empty() {
            emit("mt_transfer", json!({ "old_owner_id": from, "new_owner_id": to, "token_ids": ids, "amounts": amounts, "memo": memo }));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{get_logs, VMContextBuilder};
    use near_sdk::testing_env;

    const RULES: &str = include_str!("../tests/rules.json");
    const GOODS: [&str; 5] = ["salt", "fish", "rice", "cloth", "wood"];

    fn ctx(who: &str) -> VMContextBuilder {
        let mut b = VMContextBuilder::new();
        b.current_account_id("town.testnet".parse().unwrap()).predecessor_account_id(who.parse().unwrap());
        b
    }

    fn town(bags: u32, day_seconds: u64) -> Contract {
        testing_env!(ctx("deployer.testnet").build());
        Contract::new(RULES.to_string(), 7, U64(day_seconds), 60, vec![U64(1000); 5], vec![U64(0), U64(10), U64(10), U64(0), U64(10)], bags)
    }

    fn totals(c: &Contract, players: &[&str]) -> Vec<u128> {
        (0..5)
            .map(|g| {
                let mut t = c.stall[g] as u128;
                for p in players {
                    t += c.bag_of(p.parse().unwrap()).map(|b| b.units[g] as u128).unwrap_or(0);
                }
                t
            })
            .collect()
    }

    // shopGood() of the JS engine, Salt Town seed 7, every morning of a season.
    const SHOP_SEED_7: [&str; 10] = ["salt", "salt", "salt", "salt", "salt", "salt", "cloth", "cloth", "cloth", "cloth"];

    #[test]
    fn the_shipyard_matches_the_js_engine_every_morning() {
        let c = town(1, 0);
        for (i, want) in SHOP_SEED_7.iter().enumerate() {
            assert_eq!(c.shipyard(i as u32 * TOWN_DAYS_PER_NIGHT), *want, "morning {}", i);
        }
    }

    fn rich_town() -> Contract {
        testing_env!(ctx("deployer.testnet").build());
        let mut c = Contract::new(RULES.to_string(), 7, U64(0), 60, vec![U64(1000); 5], vec![U64(32); 5], 3);
        testing_env!(ctx("ana.testnet").build());
        c.join();
        c
    }

    #[test]
    fn paying_the_shipwright_burns_goods_and_builds_in_order() {
        let mut c = rich_town();
        let good = c.shipyard(9);
        let g = GOODS.iter().position(|k| *k == good).unwrap();
        let before = c.mt_supply(good.clone()).unwrap().0;
        testing_env!(ctx("ana.testnet").build());
        let boat = c.build(0, 9, good.clone());
        assert_eq!((boat.parts, boat.town_day, boat.paid[g]), (1, 9, 4));
        assert_eq!(c.mt_supply(good.clone()).unwrap().0, before - 4);
        assert_eq!(c.bag_of("ana.testnet".parse().unwrap()).unwrap().units[g], 28);
        let boat = c.build(1, 12, c.shipyard(12));
        assert_eq!(boat.parts, 2);
    }

    #[test]
    #[should_panic(expected = "the shipwright takes")]
    fn the_shipwright_refuses_yesterdays_money() {
        let mut c = rich_town();
        let before = c.shipyard(12);
        let after = c.shipyard(27);
        assert_ne!(before, after);
        testing_env!(ctx("ana.testnet").build());
        c.build(0, 27, before);
    }

    #[test]
    #[should_panic(expected = "build the parts in order")]
    fn parts_go_in_order() {
        let mut c = rich_town();
        testing_env!(ctx("ana.testnet").build());
        c.build(2, 12, c.shipyard(12));
    }

    #[test]
    #[should_panic(expected = "that morning has passed")]
    fn time_only_runs_forward() {
        let mut c = rich_town();
        testing_env!(ctx("ana.testnet").build());
        c.build(0, 15, c.shipyard(15));
        c.build(1, 12, c.shipyard(12));
    }

    #[test]
    #[should_panic(expected = "not a morning of the season")]
    fn only_mornings_count() {
        let mut c = rich_town();
        testing_env!(ctx("ana.testnet").build());
        c.build(0, 10, "salt".into());
    }

    #[test]
    fn genesis_is_the_only_mint() {
        let c = town(3, 0);
        assert_eq!(c.mt_supply("salt".into()).unwrap().0, 1000);
        assert_eq!(c.mt_supply("fish".into()).unwrap().0, 1030);
        assert_eq!(c.rules_hash.len(), 64);
        let logs = get_logs();
        assert_eq!(logs.iter().filter(|l| l.contains("\"mt_mint\"")).count(), 1);
    }

    #[test]
    fn join_gives_one_starter_bag_per_account() {
        let mut c = town(1, 0);
        testing_env!(ctx("dex.testnet").build());
        let bag = c.join();
        assert_eq!(bag.units, vec![0, 10, 10, 0, 10]);
        assert_eq!(c.mt_balance_of("dex.testnet".parse().unwrap(), "fish".into()).0, 10);
        testing_env!(ctx("other.testnet").build());
        assert_eq!(c.bags_left, 0);
    }

    #[test]
    #[should_panic(expected = "already joined")]
    fn cannot_join_twice() {
        let mut c = town(3, 0);
        testing_env!(ctx("dex.testnet").build());
        c.join();
        c.join();
    }

    #[test]
    #[should_panic(expected = "the starter chest is empty")]
    fn chest_runs_out() {
        let mut c = town(1, 0);
        testing_env!(ctx("a.testnet").build());
        c.join();
        testing_env!(ctx("b.testnet").build());
        c.join();
    }

    #[test]
    fn swap_moves_goods_and_never_creates_any() {
        let mut c = town(2, 0);
        testing_env!(ctx("dex.testnet").build());
        c.join();
        let before = totals(&c, &["dex.testnet"]);
        let got = c.swap("fish".into(), U64(10), "salt".into());
        assert!(got.0 > 0 && got.0 < 10, "5% fee and equal day-0 prices give fewer units");
        assert_eq!(totals(&c, &["dex.testnet"]), before);
        let supply: Vec<u128> = GOODS.iter().map(|g| c.mt_supply(g.to_string()).unwrap().0).collect();
        assert_eq!(supply, before);
    }

    #[test]
    fn rot_is_burned_and_supply_only_goes_down() {
        let mut c = town(2, 0);
        testing_env!(ctx("dex.testnet").build());
        c.join();
        let fish0 = c.mt_supply("fish".into()).unwrap().0;
        c.tick(3);
        let bag = c.settle("dex.testnet".parse().unwrap());
        assert!(bag.units[1] < 10, "fish spoils 20% a night");
        let burned = 10 - bag.units[1] as u128;
        assert_eq!(c.mt_supply("fish".into()).unwrap().0, fish0 - burned);
        assert!(get_logs().iter().any(|l| l.contains("\"mt_burn\"")));
    }

    #[test]
    fn transfer_between_players_needs_one_yocto_and_a_joined_receiver() {
        let mut c = town(2, 0);
        testing_env!(ctx("a.testnet").build());
        c.join();
        testing_env!(ctx("b.testnet").build());
        c.join();
        testing_env!(ctx("a.testnet").attached_deposit(NearToken::from_yoctonear(1)).build());
        c.mt_transfer("b.testnet".parse().unwrap(), "rice".into(), U128(4), None, None);
        assert_eq!(c.mt_balance_of("a.testnet".parse().unwrap(), "rice".into()).0, 6);
        assert_eq!(c.mt_balance_of("b.testnet".parse().unwrap(), "rice".into()).0, 14);
    }

    #[test]
    #[should_panic(expected = "receiver has not joined the town")]
    fn transfer_to_stranger_is_refused() {
        let mut c = town(2, 0);
        testing_env!(ctx("a.testnet").build());
        c.join();
        testing_env!(ctx("a.testnet").attached_deposit(NearToken::from_yoctonear(1)).build());
        c.mt_transfer("nobody.testnet".parse().unwrap(), "rice".into(), U128(1), None, None);
    }

    #[test]
    fn anyone_can_tick_and_the_town_finds_salt() {
        let mut c = town(0, 0);
        testing_env!(ctx("stranger.testnet").build());
        let mut view = c.tick(10);
        assert_eq!(view.day, 10);
        assert_eq!(view.money.as_deref(), Some("salt"));
        for _ in 0..2 {
            view = c.tick(10);
        }
        assert_eq!(view.day, 30);
        assert_eq!(view.money.as_deref(), Some("cloth"), "after the rain on day 16");
    }

    #[test]
    #[should_panic(expected = "the town is up to date")]
    fn a_clocked_town_cannot_run_ahead() {
        let mut c = town(0, 600);
        testing_env!(ctx("stranger.testnet").block_timestamp(599 * 1_000_000_000).build());
        c.tick(1);
    }

    #[test]
    fn a_clocked_town_moves_with_the_clock() {
        let mut c = town(0, 600);
        testing_env!(ctx("stranger.testnet").block_timestamp(1800 * 1_000_000_000).build());
        assert_eq!(c.tick(10).day, 3);
    }
}
