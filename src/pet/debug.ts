// Debug report: a human-readable dump of a pet's full diagnostic trail
// (vitals + diag, merged in chronological order), for reconstructing exactly
// what happened to a pet — its own record, its owner's actions, and the
// game's — without decoding a base64 backup by hand. Pure and testable;
// the UI just copies whatever this returns to the clipboard. Works the same
// for the live pet and for a FarmEntry.final snapshot of a retired one.

import { ILLNESSES } from "./types";
import type { PetState } from "./types";
import { ageLabel } from "./format";

function fmtTime(t: number): string {
  return new Date(t).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDebugReport(pet: PetState, now: number = Date.now()): string {
  const lines: string[] = [];
  lines.push(`Cozy Sprites debug report — ${pet.name}`);
  lines.push(
    `Stage: ${pet.stage}${pet.form ? ` (${pet.form})` : ""}${pet.sick && pet.illness ? ` — sick: ${ILLNESSES[pet.illness].label}` : ""}`,
  );
  lines.push(`Hatched: ${fmtTime(pet.createdAt)}`);
  if (pet.deadAt !== null) {
    lines.push(`Died: ${fmtTime(pet.deadAt)} — ${pet.causeOfDeath ?? "unknown cause"}`);
    lines.push(`Lived: ${ageLabel(pet.deadAt - pet.createdAt)}`);
  } else if (pet.departedAt !== null) {
    lines.push(`Retired: ${fmtTime(pet.departedAt)}`);
    lines.push(`Lived: ${ageLabel(pet.departedAt - pet.createdAt)}`);
  } else {
    lines.push(`Status: alive, last updated ${fmtTime(pet.lastUpdated)}`);
    lines.push(`Age: ${ageLabel(now - pet.createdAt)}`);
  }
  lines.push("");
  lines.push(`--- Timeline (${pet.vitals.length} vitals samples, ${pet.diag.length} events) ---`);

  interface Row {
    t: number;
    text: string;
  }
  const rows: Row[] = [];
  for (const v of pet.vitals) {
    rows.push({
      t: v.t,
      text:
        `vitals  health=${v.health} energy=${v.energy} happiness=${v.happiness} weight=${v.weight}g ` +
        `poops=${v.poops} illness=${v.illness ?? "-"} asleep=${v.asleep} lights=${v.lightsOn} ` +
        `zeroHealthMs=${v.zeroHealthMs} careMistakes=${v.careMistakes}`,
    });
  }
  for (const e of pet.diag) {
    rows.push({ t: e.t, text: `${e.kind}${e.note ? `  ${e.note}` : ""}` });
  }
  // Stable sort keeps same-timestamp entries in the order they were pushed
  // (vitals before diag at an identical t is fine — both wrote at that instant).
  rows.sort((a, b) => a.t - b.t);

  if (rows.length === 0) {
    lines.push("(no history recorded yet)");
  } else {
    for (const r of rows) lines.push(`${fmtTime(r.t)}  ${r.text}`);
  }
  return lines.join("\n");
}
