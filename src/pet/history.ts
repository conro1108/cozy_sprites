// The in-game history screen's data layer: turns the raw diagnostic trail
// (pet.diag events + pet.vitals samples) into something a player can actually
// read — "Fed a slice of Cake", not "fed  cake".
//
// The debug report (debug.ts) stays the technical dump for bug-hunting; this is
// the same underlying record told in plain language, grouped by day, newest
// first. Pure and testable — the UI just renders whatever this returns.

import { ILLNESSES } from "./types";
import type { DiagEvent, GameId, IllnessId, PetState, VitalsSample } from "./types";
import { FOODS, ADULTS } from "./roster";
import { GAME_NAMES } from "./games";

export interface HistoryRow {
  t: number;
  /** Emoji standing in for the event — the list reads as a timeline at a glance. */
  icon: string;
  text: string;
  /** Vitals rows are the opt-in numeric samples; events are the diary proper. */
  kind: "event" | "vitals";
}

export interface HistoryDay {
  /** "Today" / "Yesterday" / "Mar 3" — the sticky heading for the group. */
  label: string;
  rows: HistoryRow[];
}

export interface HistoryOptions {
  /** Fold the hourly numeric vitals samples in among the events. */
  includeVitals?: boolean;
}

/** Whether the diag ring has evicted its oldest entries — the screen says so
 *  rather than presenting a trail that looks complete but isn't. */
export function historyTruncated(pet: PetState): boolean {
  return pet.diagTotal > pet.diag.length;
}

const r1 = (v: number): number => Math.round(v * 10) / 10;

function illnessLabel(id: string | undefined): string {
  const known = id && id in ILLNESSES ? ILLNESSES[id as IllnessId].label : null;
  return known ?? "something";
}

/** The played note is `${game} ${win|loss|tie}`, or `${game} reach ${n}` for
 *  the one endless game. Told from the player's side, since they're reading it. */
function describePlayed(note: string | undefined): string {
  if (!note) return "Played a game";
  const [game, ...rest] = note.split(" ");
  const name = game in GAME_NAMES ? GAME_NAMES[game as GameId] : game;
  const detail = rest.join(" ");
  if (detail.startsWith("reach ")) {
    return `Played ${name} — reached round ${detail.slice("reach ".length)}`;
  }
  if (detail === "win") return `Played ${name} — you won`;
  if (detail === "loss") return `Played ${name} — you lost`;
  if (detail === "tie") return `Played ${name} — a tie`;
  return `Played ${name}`;
}

/** The stage note is a bare stage name, or `adult (form) — <hidden stats>` for
 *  the one transition that carries its reasoning. */
function describeStage(note: string | undefined): string {
  if (!note) return "Grew up";
  const adult = /^adult \((\w+)\)/.exec(note);
  if (adult) {
    const form = adult[1];
    const name = form in ADULTS ? ADULTS[form as keyof typeof ADULTS].name : form;
    return `Grew up into the ${name}`;
  }
  const stage = note.split(" ")[0];
  return `Grew into a ${stage}`;
}

/** The call note is `${verb}:${fake|real}? ${want}` — raised/expired carry
 *  whether the call was a genuine need, satisfied/spoiled just carry the want. */
function describeCall(note: string | undefined): string {
  if (!note) return "Called for attention";
  const [head, ...rest] = note.split(" ");
  const [verb, qualifier] = head.split(":");
  const want = rest.join(" ").trim();
  const forWhat = want === "pat" ? "attention" : want === "play" ? "a game" : want === "snack" ? "a snack" : want;
  switch (verb) {
    case "raised":
      return qualifier === "fake"
        ? `Cried for ${forWhat || "attention"} — and didn't mean it`
        : `Called for ${forWhat || "attention"}`;
    case "expired":
      return `Called for ${forWhat || "attention"} — nobody came`;
    case "satisfied":
      return `Got the ${forWhat || "attention"} it asked for`;
    case "spoiled":
      return `Spoiled with ${forWhat || "attention"} it hadn't asked for`;
    default:
      return "Called for attention";
  }
}

/** One diag event, in plain language. Unknown/absent notes degrade to a bare
 *  headline rather than leaking the raw note. */
function describeEvent(e: DiagEvent): { icon: string; text: string } {
  // Dev Tools levers log through the same kinds as organic events, tagged
  // "(dev)" for the debug report — the diary reads them the same either way.
  const note = e.note?.replace(/\s*\(dev\)$/, "");
  switch (e.kind) {
    case "hatched":
      return { icon: "🥚", text: "Hatched" };
    case "stage":
      return { icon: "✨", text: describeStage(note) };
    case "sick":
      return { icon: "🤒", text: `Came down with ${illnessLabel(note)}` };
    case "cured": {
      // `${illness} (${via})` — the folk remedy is worth calling out by name.
      const m = /^(\S+)\s*\((\w+)\)/.exec(note ?? "");
      const ill = illnessLabel(m?.[1]);
      const via = m?.[2] === "soup" ? " — cured by soup, of all things" : "";
      return { icon: "💚", text: `Recovered from ${ill}${via}` };
    }
    case "poop":
      return { icon: "💩", text: "Made a mess" };
    case "fed": {
      const food = note && note in FOODS ? FOODS[note as keyof typeof FOODS].name : note;
      return { icon: "🍽️", text: food ? `Fed a ${food}` : "Fed" };
    }
    case "cleaned": {
      // `${n} swept`
      const n = Number.parseInt(note ?? "", 10);
      if (!Number.isFinite(n)) return { icon: "🧹", text: "Cleaned up" };
      return { icon: "🧹", text: `Cleaned up ${n} mess${n === 1 ? "" : "es"}` };
    }
    case "medicine":
      return { icon: "💊", text: note ? `Given medicine (${note.replace("dose ", "")})` : "Given medicine" };
    case "played":
      return { icon: "🎮", text: describePlayed(note) };
    case "pat":
      return {
        icon: "🫶",
        text: note === "enough" ? "Patted past the point of enjoying it" : "Enjoyed a good pat",
      };
    case "tap":
      return { icon: "👆", text: note?.startsWith("annoyed") ? "Poked — and did not care for it" : "Poked" };
    case "discipline":
      return note === "correct"
        ? { icon: "📢", text: "Told off — and deserved it" }
        : { icon: "📢", text: "Told off — unfairly" };
    case "call":
      return { icon: "🔔", text: describeCall(note) };
    case "zoomies":
      return { icon: "💨", text: "Got the zoomies" };
    case "lights":
      return note === "on"
        ? { icon: "💡", text: "Lights on" }
        : { icon: "🌙", text: "Lights off" };
    case "retirement":
      if (note === "restless") return { icon: "🌾", text: "Started gazing at the horizon" };
      if (note === "ready") return { icon: "🌾", text: "Ready for the farm" };
      return { icon: "🌾", text: "Left for the farm" };
    case "dawn":
      // The overnight summary — the hours nobody was watching.
      return { icon: "🌅", text: note ? `Morning — ${note}` : "Morning" };
    case "zero-health":
      return { icon: "⚠️", text: "Health hit zero" };
    case "recovered":
      return { icon: "❤️", text: "Health climbed back off zero" };
    case "death":
      return { icon: "🪦", text: note ? `Died of ${note}` : "Died" };
    case "timeline":
      return {
        icon: "⏱️",
        text: note === "demo" ? "Switched to the demo timeline" : "Back on the real timeline",
      };
  }
}

function describeVitals(v: VitalsSample): string {
  const bits = [
    `health ${r1(v.health)}`,
    `energy ${r1(v.energy)}`,
    `happiness ${r1(v.happiness)}`,
    `${Math.round(v.weight)}g`,
  ];
  if (v.poops > 0) bits.push(`${v.poops} mess${v.poops === 1 ? "" : "es"}`);
  if (v.illness) bits.push(illnessLabel(v.illness));
  if (v.asleep) bits.push("asleep");
  return bits.join(" · ");
}

function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(t: number, now: number): string {
  const key = dayKey(t);
  if (key === dayKey(now)) return "Today";
  if (key === dayKey(now - 24 * 60 * 60 * 1000)) return "Yesterday";
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Clock time for a row, e.g. "2:41 PM". */
export function rowTime(t: number): string {
  return new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * The pet's whole recorded life, newest first, grouped by day. Vitals samples
 * are opt-in: they're the hourly numbers, useful for "why did it get sick" and
 * pure noise otherwise.
 */
export function buildHistory(
  pet: PetState,
  opts: HistoryOptions = {},
  now: number = Date.now(),
): HistoryDay[] {
  const rows: HistoryRow[] = pet.diag.map((e) => {
    const { icon, text } = describeEvent(e);
    return { t: e.t, icon, text, kind: "event" as const };
  });
  if (opts.includeVitals) {
    for (const v of pet.vitals) {
      rows.push({ t: v.t, icon: "📊", text: describeVitals(v), kind: "vitals" });
    }
  }
  // Newest first — a log is read from the most recent thing backwards.
  rows.sort((a, b) => b.t - a.t);

  const days: HistoryDay[] = [];
  let current: HistoryDay | null = null;
  let currentKey = "";
  for (const row of rows) {
    const key = dayKey(row.t);
    if (!current || key !== currentKey) {
      current = { label: dayLabel(row.t, now), rows: [] };
      currentKey = key;
      days.push(current);
    }
    current.rows.push(row);
  }
  return days;
}
