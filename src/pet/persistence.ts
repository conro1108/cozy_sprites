// Local persistence: active pet + farm archive + import/export backup string.
// localStorage is sufficient for v1; the export string provides a backup/export
// option even in v1.

import type { AdultForm, FarmEntry, PetState } from "./types";
import { emptyHidden } from "./types";
import { ageMs } from "./state";

const PET_KEY = "cozy-sprites-pet";
const FARM_KEY = "cozy-sprites-farm";
const DEVICE_KEY = "cozy-sprites-device";
// Discovered adult forms are normally derived from the farm archive, but a
// farm wipe must not erase them — this snapshot survives that wipe.
const DISCOVERED_KEY = "cozy-sprites-discovered";
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

/** Backfill fields added after a save was written so old saves keep working.
 *  Exported for unit tests (loadPet needs localStorage; this doesn't). */
export function migratePet(p: PetState): PetState {
  const defaults = emptyHidden();
  // Pre-rename saves stored this meter as "hunger" (a fullness meter where
  // higher was confusingly better) — carry the value over under its new name.
  const legacy = p as unknown as { hunger?: number; hungerZeroMs?: number };
  return {
    ...p,
    energy: p.energy ?? legacy.hunger ?? 3,
    illness: p.illness ?? (p.sick ? "sniffles" : null),
    dosesGiven: p.dosesGiven ?? 0,
    lastDoseAt: p.lastDoseAt ?? null,
    illnessMs: p.illnessMs ?? 0,
    napMs: p.napMs ?? 0,
    // Real-clock fields (grace windows, night ledger, retirement). Zero is the
    // gentle default for every accumulator: no penalty inherited retroactively.
    energyZeroMs: p.energyZeroMs ?? legacy.hungerZeroMs ?? 0,
    happinessZeroMs: p.happinessZeroMs ?? 0,
    nightAwakeMs: p.nightAwakeMs ?? 0,
    nightSleepMs: p.nightSleepMs ?? 0,
    adultLifeMs: p.adultLifeMs ?? 0,
    departedAt: p.departedAt ?? null,
    // An in-flight call from a pre-expiry save starts its clock at its last
    // update rather than being judged stale on arrival.
    callStartedAt: p.callStartedAt ?? (p.wantsAttention ? p.lastUpdated ?? null : null),
    // Pre-fiber saves have no poopPressure; without this it'd be undefined and
    // every `+=` would go NaN, jamming pooping shut forever.
    poopPressure: p.poopPressure ?? 0,
    zeroHealthMs: p.zeroHealthMs ?? 0,
    deadAt: p.deadAt ?? null,
    causeOfDeath: p.causeOfDeath ?? null,
    attentionWant: p.attentionWant ?? (p.wantsAttention ? "pat" : null),
    zoomies: p.zoomies ?? false,
    zoomiesStartedAt: p.zoomiesStartedAt ?? null,
    tapStreak: p.tapStreak ?? 0,
    // Pre-accumulator saves aged by wall clock, so progress through the current
    // stage was (lastUpdated − stageStartedAt). Deriving from that preserves an
    // in-flight pet's progress without resetting it or making it instantly
    // evolve. A bare ?? 0 to undefined here would go NaN and freeze growth.
    stageElapsedMs:
      p.stageElapsedMs ?? Math.max(0, (p.lastUpdated ?? 0) - (p.stageStartedAt ?? 0)),
    recentPats: p.recentPats ?? [],
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

export function loadDiscoveredForms(): AdultForm[] {
  const raw = localStorage.getItem(DISCOVERED_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AdultForm[];
  } catch {
    return [];
  }
}

export function saveDiscoveredForms(forms: AdultForm[]): void {
  localStorage.setItem(DISCOVERED_KEY, JSON.stringify(forms));
}

/** The hidden "reset progress" option: wipe every retiree and gravestone.
 *  Snapshots the given discovered-forms set first, since discovery is
 *  normally derived from the farm archive this is about to erase. */
export function wipeFarm(discovered: AdultForm[]): void {
  saveDiscoveredForms(discovered);
  saveFarm([]);
}

/** Retire the active pet into the farm archive and return the new archive.
 *  Dead pets get a memorial entry instead of a retirement one; a pet that
 *  departed on its own at dawn is dated to the sunrise it left with. */
export function retireToFarm(state: PetState, now: number): FarmEntry[] {
  const endedAt = state.deadAt ?? state.departedAt ?? now;
  const entry: FarmEntry = {
    name: state.name,
    form: state.form,
    finalStage: state.stage,
    ageMs: ageMs(state, endedAt),
    hatchedAt: state.createdAt,
    retiredAt: endedAt,
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
  discovered: AdultForm[];
}

export function exportSave(): string {
  const pet = loadPet();
  const farm = loadFarm();
  // Discovered forms live in their own snapshot key (see DISCOVERED_KEY) so a
  // farm wipe doesn't erase them — a backup has to union all three sources or
  // it silently drops any form that only survives in that snapshot.
  const discovered = new Set<AdultForm>(loadDiscoveredForms());
  for (const e of farm) if (e.form) discovered.add(e.form);
  if (pet?.form) discovered.add(pet.form);
  const backup: Backup = { v: SAVE_VERSION, pet, farm, discovered: Array.from(discovered) };
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
    // Accept pre-rename backups too (they store this meter as "hunger");
    // migratePet carries the value over to "energy" on next load.
    (typeof s.energy === "number" || typeof s.hunger === "number") &&
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
    // Older backups predate this field — leave the local snapshot alone
    // rather than reading `undefined` as "wipe collection progress".
    if (Array.isArray(backup.discovered)) saveDiscoveredForms(backup.discovered);
    return true;
  } catch {
    return false;
  }
}
