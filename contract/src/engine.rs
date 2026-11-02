//! Port of ../../engine/town.js and the price/spoil parts of player.js.
//! Integer-only and step-for-step identical to the JavaScript engine; the
//! parity test at the bottom replays fixtures produced by the JS code.

use near_sdk::near;

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Good {
    pub key: String,
    pub spoil: u32,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Role {
    pub key: String,
    pub makes: u8,
    pub needs: u8,
    pub count: u32,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TraderRule {
    pub base_cost: u32,
    pub doubt: u32,
    pub memory_shift: u32,
    pub prior: i32,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Market {
    pub rounds_per_day: u32,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Event {
    pub day: u32,
    pub good: u8,
    pub spoil: u32,
    pub key: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Rules {
    pub name: String,
    pub season_days: u32,
    pub goods: Vec<Good>,
    pub roles: Vec<Role>,
    pub trader: TraderRule,
    pub market: Market,
    pub money_threshold: u32,
    pub events: Vec<Event>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Agent {
    pub needs: u8,
    pub makes: u8,
    pub holds: u8,
    pub fed: u32,
    pub memory: Vec<i32>,
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct Town {
    pub rules: Rules,
    pub rng_state: u32,
    pub day: u32,
    pub spoil: Vec<u32>,
    pub agents: Vec<Agent>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct DayReport {
    pub trades: u32,
    pub fed_today: u32,
}

pub fn next_u32(state: &mut u32) -> u32 {
    *state = state.wrapping_add(0x6d2b_79f5);
    let mut t = *state;
    t = (t ^ (t >> 15)).wrapping_mul(t | 1);
    t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
    t ^ (t >> 14)
}

impl Town {
    pub fn new(rules: Rules, seed: u32) -> Self {
        let mut agents = Vec::new();
        for role in &rules.roles {
            for _ in 0..role.count {
                agents.push(Agent {
                    needs: role.needs,
                    makes: role.makes,
                    holds: role.makes,
                    fed: 0,
                    memory: vec![rules.trader.prior; rules.goods.len()],
                });
            }
        }
        near_sdk::require!(agents.len() % 2 == 0, "town needs an even number of traders");
        let spoil = rules.goods.iter().map(|g| g.spoil).collect();
        let mut town = Town { rules, rng_state: seed, day: 0, spoil, agents };
        town.apply_events();
        town
    }

    fn apply_events(&mut self) {
        for ev in &self.rules.events {
            if ev.day == self.day {
                self.spoil[ev.good as usize] = ev.spoil;
            }
        }
    }

    pub fn holding_cost(&self, good: u8) -> i64 {
        (self.rules.trader.base_cost + self.spoil[good as usize]) as i64
    }

    fn worth(&self, agent: &Agent, good: u8) -> i64 {
        (agent.memory[good as usize] as i64 * 1000) / self.holding_cost(good)
    }

    pub fn will_take(&self, agent: &Agent, offered: u8, holding: u8) -> bool {
        if offered == holding {
            return false;
        }
        if offered == agent.needs {
            return true;
        }
        if holding == agent.needs {
            return false;
        }
        let doubt = self.rules.trader.doubt as i64;
        self.worth(agent, offered) * 100 > self.worth(agent, holding) * (100 + doubt)
    }

    fn learn(&mut self, a: usize, b: usize) {
        let shift = self.rules.trader.memory_shift;
        let partner = &self.agents[b];
        let goods = self.spoil.len();
        let mut seen = vec![-1i32; goods];
        for g in 0..goods {
            if g as u8 == partner.holds {
                continue;
            }
            seen[g] = if self.will_take(partner, g as u8, partner.holds) { 1000 } else { 0 };
        }
        let agent = &mut self.agents[a];
        for g in 0..goods {
            if seen[g] < 0 {
                continue;
            }
            agent.memory[g] += (seen[g] - agent.memory[g]) >> shift;
        }
    }

    pub fn step(&mut self) -> DayReport {
        let n = self.agents.len();
        let mut order: Vec<usize> = (0..n).collect();
        let mut trades = 0;
        let mut fed_today = 0;
        let mut state = self.rng_state;
        for _ in 0..self.rules.market.rounds_per_day {
            for i in (1..n).rev() {
                let j = (next_u32(&mut state) % (i as u32 + 1)) as usize;
                order.swap(i, j);
            }
            let mut k = 0;
            while k < n {
                let (a, b) = (order[k], order[k + 1]);
                let a_takes = self.will_take(&self.agents[a], self.agents[b].holds, self.agents[a].holds);
                let b_takes = self.will_take(&self.agents[b], self.agents[a].holds, self.agents[b].holds);
                self.learn(a, b);
                self.learn(b, a);
                if a_takes && b_takes {
                    let x = self.agents[a].holds;
                    self.agents[a].holds = self.agents[b].holds;
                    self.agents[b].holds = x;
                    trades += 1;
                }
                k += 2;
            }
            for ag in self.agents.iter_mut() {
                if ag.holds == ag.needs {
                    ag.fed += 1;
                    fed_today += 1;
                    ag.holds = ag.makes;
                }
            }
        }
        self.rng_state = state;
        self.day += 1;
        self.apply_events();
        DayReport { trades, fed_today }
    }

    pub fn acceptance(&self) -> Vec<u32> {
        let goods = self.spoil.len();
        (0..goods)
            .map(|g| {
                let (mut yes, mut total) = (0u32, 0u32);
                for ag in &self.agents {
                    if ag.needs as usize == g || ag.makes as usize == g {
                        continue;
                    }
                    total += 1;
                    if ag.holds as usize == g || self.will_take(ag, g as u8, ag.holds) {
                        yes += 1;
                    }
                }
                if total == 0 { 0 } else { yes * 1000 / total }
            })
            .collect()
    }

    pub fn money(&self) -> i32 {
        let accept = self.acceptance();
        let mut best: i32 = -1;
        for (g, a) in accept.iter().enumerate() {
            if *a >= self.rules.money_threshold && (best == -1 || *a > accept[best as usize]) {
                best = g as i32;
            }
        }
        best
    }

    pub fn belief(&self) -> Vec<u32> {
        let n = self.agents.len() as i64;
        (0..self.spoil.len())
            .map(|g| (self.agents.iter().map(|a| a.memory[g] as i64).sum::<i64>() / n) as u32)
            .collect()
    }

    /// Price of one unit in value points (1..100), as in player.js.
    pub fn prices(&self) -> Vec<u64> {
        self.belief().iter().map(|b| ((*b as u64 + 5) / 10).max(1)).collect()
    }

    /// Spoil rate of the night that ends on `day` (the rules are public, so
    /// any day can be computed without running the town).
    pub fn spoil_on(&self, day: u32) -> Vec<u32> {
        let mut spoil: Vec<u32> = self.rules.goods.iter().map(|g| g.spoil).collect();
        for ev in &self.rules.events {
            if ev.day <= day {
                spoil[ev.good as usize] = ev.spoil;
            }
        }
        spoil
    }

    /// FNV-1a over the whole state, identical to stateHash() in town.js.
    pub fn state_hash(&self) -> String {
        let mut h: u32 = 0x811c_9dc5;
        let mut mix = |v: u32| {
            h ^= v & 0xffff;
            h = h.wrapping_mul(0x0100_0193);
            h ^= (v >> 16) & 0xffff;
            h = h.wrapping_mul(0x0100_0193);
        };
        mix(self.day);
        mix(self.rng_state);
        for s in &self.spoil {
            mix(*s);
        }
        for ag in &self.agents {
            mix(ag.holds as u32);
            mix(ag.fed);
            for m in &ag.memory {
                mix(*m as u32);
            }
        }
        format!("{:08x}", h)
    }
}

/// Units received for `units` of a good priced `p_from`, in a good priced `p_to`.
pub fn swap_quote(units: u64, p_from: u64, p_to: u64, fee_percent: u64) -> u64 {
    (units as u128 * p_from as u128 * (100 - fee_percent) as u128 / (100 * p_to as u128)) as u64
}

/// One night of spoilage on a stockpile: returns units lost, updates carry.
pub fn spoil_units(units: &mut u64, carry: &mut u32, spoil: u32) -> u64 {
    let amount = *units as u128 * spoil as u128 + *carry as u128;
    let rot = std::cmp::min(*units as u128, amount / 100) as u64;
    *carry = (amount % 100) as u32;
    *units -= rot;
    rot
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::serde_json::{self, Value};

    const FIXTURE: &str = include_str!("../tests/parity.json");

    #[test]
    fn rust_engine_matches_javascript_engine_day_by_day() {
        let fx: Value = serde_json::from_str(FIXTURE).unwrap();
        let rules: Rules = serde_json::from_value(fx["rules"].clone()).unwrap();
        for run in fx["runs"].as_array().unwrap() {
            let seed = run["seed"].as_u64().unwrap() as u32;
            let mut town = Town::new(rules.clone(), seed);
            for (day, expect) in run["days"].as_array().unwrap().iter().enumerate() {
                if day > 0 {
                    town.step();
                }
                assert_eq!(town.state_hash(), expect["hash"].as_str().unwrap(), "seed {seed} day {day}");
                let money = expect["money"].as_i64().unwrap() as i32;
                assert_eq!(town.money(), money, "seed {seed} day {day} money");
                let prices: Vec<u64> = expect["prices"].as_array().unwrap().iter().map(|v| v.as_u64().unwrap()).collect();
                assert_eq!(town.prices(), prices, "seed {seed} day {day} prices");
            }
        }
    }

    #[test]
    fn prng_matches_known_values() {
        let fx: Value = serde_json::from_str(FIXTURE).unwrap();
        let mut s = 12345u32;
        let got: Vec<u64> = (0..5).map(|_| next_u32(&mut s) as u64).collect();
        let want: Vec<u64> = fx["prng12345"].as_array().unwrap().iter().map(|v| v.as_u64().unwrap()).collect();
        assert_eq!(got, want);
    }

    #[test]
    fn spoil_matches_player_js() {
        let (mut u, mut c) = (100u64, 0u32);
        assert_eq!(spoil_units(&mut u, &mut c, 20), 20);
        assert_eq!(u, 80);
        let (mut u, mut c) = (7u64, 0u32);
        spoil_units(&mut u, &mut c, 12);
        assert_eq!((u, c), (7, 84));
        spoil_units(&mut u, &mut c, 12);
        assert_eq!((u, c), (6, 68));
    }
}
