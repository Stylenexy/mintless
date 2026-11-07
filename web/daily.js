import { makeRng } from "../engine/rng.js";

// UTC is deliberate: one island worldwide, changing at 00:00 UTC (07:00 WIB).
export function dailyIsland(now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  return { date, seed: Number(date.replaceAll("-", "")) };
}

export function dailyRandom(seed) {
  const rng = makeRng(seed);
  return () => rng.next() / 4294967296;
}

// Sleep costs the rest of that day too. Paused menus do not cost game time.
export function dailySeconds(day, clock, firstDaySeconds, daySeconds) {
  return Math.round(day > 1
    ? firstDaySeconds + (day - 2 + Math.min(1, clock)) * daySeconds
    : Math.min(1, clock) * firstDaySeconds);
}

const DAILY_KEY = "mintless-daily-v1";
const validDate = (date) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date);
const validResult = (r) => r && typeof r.won === "boolean" && Number.isInteger(r.parts) && r.parts >= 0 && r.parts <= 4 && r.won === (r.parts === 4) && Number.isInteger(r.seconds) && r.seconds >= 0 && r.seconds <= 870;
const rankDaily = (a, b) => Number(b.won) - Number(a.won) || b.parts - a.parts || a.seconds - b.seconds || a.attempt - b.attempt;

export function createDailyBoard(storage) {
  let memory = {};
  let persistent = true;
  try {
    storage ??= globalThis.localStorage;
    if (!storage) persistent = false;
  } catch {
    persistent = false;
  }
  function read() {
    let saved;
    if (persistent) {
      try {
        saved = storage.getItem(DAILY_KEY);
      } catch {
        persistent = false;
      }
    }
    try {
      const raw = persistent ? JSON.parse(saved || "{}") : memory;
      const clean = {};
      for (const date of Object.keys(raw || {}).filter(validDate).sort().slice(-7)) {
        const value = raw[date];
        if (!value || !Number.isSafeInteger(value.attempts) || value.attempts < 0 || !Array.isArray(value.runs)) continue;
        clean[date] = {
          attempts: value.attempts,
          runs: value.runs.filter((r) => validResult(r) && Number.isSafeInteger(r.attempt) && r.attempt > 0 && r.attempt <= value.attempts).sort(rankDaily).slice(0, 10),
        };
      }
      memory = clean;
    } catch {
      // Malformed saves or blocked storage must never stop a run.
    }
    return memory;
  }
  return {
    get(date) {
      const value = read()[date] || { attempts: 0, runs: [] };
      return { ...structuredClone(value), persistent };
    },
    add(date, result) {
      if (!validDate(date) || !validResult(result)) throw new Error("Invalid daily result");
      const all = read();
      const value = all[date] || { attempts: 0, runs: [] };
      const attempt = value.attempts + 1;
      all[date] = { attempts: attempt, runs: [...value.runs, { won: result.won, parts: result.parts, seconds: result.seconds, attempt }].sort(rankDaily).slice(0, 10) };
      const recent = Object.keys(all).sort().slice(-7);
      // Retrying an older island across midnight still saves to its original date.
      if (!recent.includes(date)) recent[0] = date;
      memory = Object.fromEntries(recent.map((d) => [d, all[d]]));
      if (persistent) {
        try {
          storage.setItem(DAILY_KEY, JSON.stringify(memory));
        } catch {
          persistent = false;
        }
      }
      return this.get(date);
    },
  };
}

export function renderDailyBoard(root, date, board) {
  const { runs, persistent } = board.get(date);
  const doc = root.ownerDocument;
  const heading = doc.createElement("h3");
  heading.textContent = `Daily island ${date} (UTC)`;
  const note = doc.createElement("p");
  note.textContent = `Top 10 on this browser only. ${persistent ? "Saved locally." : "Session only: storage unavailable."} Sailed first, then most boat parts, then fastest game time. Sleep counts as a full day. No online verification.`;
  const list = doc.createElement("ol");
  for (const run of runs) {
    const row = doc.createElement("li");
    const time = `${Math.floor(run.seconds / 60)}:${String(run.seconds % 60).padStart(2, "0")}`;
    row.textContent = `Run ${run.attempt}: ${run.won ? "sailed" : `${run.parts}/4 boat parts`}, ${time}`;
    list.append(row);
  }
  if (!runs.length) {
    const empty = doc.createElement("li");
    empty.textContent = "No finished runs yet. Try the daily island!";
    list.append(empty);
  }
  root.replaceChildren(heading, note, list);
}
