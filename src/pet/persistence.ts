// Local persistence: active pet + farm archive + import/export backup string.
// localStorage is sufficient for v1; the export string provides a backup/export
// option even in v1.

import type { FarmEntry, PetState } from "./types";
import { emptyHidden } from "./types";
import { ageMs } from "./state";

const PET_KEY = "cozy-sprites-pet";
const FARM_KEY = "cozy-sprites-farm";
const DEVICE_KEY = "cozy-sprites-device";
const SAVE_VERSION = 1;

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = randomId();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** UUID via crypto when available, else a plain fallback. crypto.randomUUID
 *  only exists in a secure context, so on a plain-http LAN address (phone
 *  testing) we must not assume it — otherwise startup throws. */
function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function savePet(state: PetState): void {
  localStorage.setItem(PET_KEY, JSON.stringify(state));
}

export function loadPet(): PetState | null {
  const raw = localStorage.getItem(PET_KEY);
  if (!raw) return null;
  try {
    return migratePet(JSON.parse(raw) as PetState);
  } catch {
    return null;
  }
}

/** Backfill fields added after a save was written so old saves keep working. */
function migratePet(p: PetState): PetState {
  const defaults = emptyHidden();
  return {
    ...p,
    illness: p.illness ?? (p.sick ? "sniffles" : null),
    dosesGiven: p.dosesGiven ?? 0,
    zeroHealthMs: p.zeroHealthMs ?? 0,
    deadAt: p.deadAt ?? null,
    causeOfDeath: p.causeOfDeath ?? null,
    attentionWant: p.attentionWant ?? (p.wantsAttention ? "pat" : null),
    tapStreak: p.tapStreak ?? 0,
    // Backfill hidden stats + any newly-added game counters (e.g. cubehum) so an
    // old save doesn't turn gamePlays[newGame]++ into NaN and poison scoring.
    hidden: {
      ...defaults,
      ...p.hidden,
      gamePlays: { ...defaults.gamePlays, ...p.hidden?.gamePlays },
    },
  };
}

export function clearPet(): void {
  localStorage.removeItem(PET_KEY);
}

export function loadFarm(): FarmEntry[] {
  const raw = localStorage.getItem(FARM_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as FarmEntry[];
  } catch {
    return [];
  }
}

export function saveFarm(entries: FarmEntry[]): void {
  localStorage.setItem(FARM_KEY, JSON.stringify(entries));
}

/** Retire the active pet into the farm archive and return the new archive.
 *  Dead pets get a memorial entry instead of a retirement one. */
export function retireToFarm(state: PetState, now: number): FarmEntry[] {
  const entry: FarmEntry = {
    name: state.name,
    form: state.form,
    finalStage: state.stage,
    ageMs: ageMs(state, state.deadAt ?? now),
    hatchedAt: state.createdAt,
    retiredAt: state.deadAt ?? now,
    passedAway: state.deadAt !== null,
    cause: state.causeOfDeath,
  };
  const farm = [entry, ...loadFarm()];
  saveFarm(farm);
  clearPet();
  return farm;
}

// --- Backup string (base64-encoded JSON blob) -------------------------------
interface Backup {
  v: number;
  pet: PetState | null;
  farm: FarmEntry[];
}

export function exportSave(): string {
  const backup: Backup = { v: SAVE_VERSION, pet: loadPet(), farm: loadFarm() };
  // encodeURIComponent handles any unicode in pet names before base64.
  return btoa(encodeURIComponent(JSON.stringify(backup)));
}

/** Guard against a well-formed-but-wrong-shape blob crashing state functions. */
function isValidPet(p: unknown): p is PetState {
  if (!p || typeof p !== "object") return false;
  const s = p as Record<string, unknown>;
  const hidden = s.hidden as Record<string, unknown> | undefined;
  return (
    typeof s.name === "string" &&
    typeof s.stage === "string" &&
    typeof s.hunger === "number" &&
    typeof s.lastUpdated === "number" &&
    !!hidden &&
    typeof hidden === "object" &&
    typeof hidden.gamePlays === "object"
  );
}

export function importSave(code: string): boolean {
  try {
    const backup = JSON.parse(decodeURIComponent(atob(code.trim()))) as Backup;
    if (typeof backup !== "object" || backup.v !== SAVE_VERSION) return false;
    if (backup.pet) {
      if (!isValidPet(backup.pet)) return false;
      savePet(backup.pet);
    } else {
      clearPet();
    }
    saveFarm(Array.isArray(backup.farm) ? backup.farm : []);
    return true;
  } catch {
    return false;
  }
}
