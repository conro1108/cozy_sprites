import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  exportSave,
  importSave,
  loadDiscoveredForms,
  loadFarm,
  migratePet,
  retireToFarm,
  SAVE_VERSION,
  saveDiscoveredForms,
  saveFarm,
  wipeFarm,
} from "./persistence";
import { createPet } from "./state";
import type { PetState } from "./types";
import type { AdultForm, FarmEntry } from "./types";

// The test env is plain node — no localStorage. Stub the two methods
// persistence.ts actually uses.
let store: Record<string, string>;

beforeEach(() => {
  store = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  };
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

const grave: FarmEntry = {
  name: "Sparky",
  form: "dog",
  finalStage: "adult",
  ageMs: 1000,
  hatchedAt: 0,
  retiredAt: 1000,
  passedAway: true,
  cause: "dysentery",
};

describe("discovered-forms snapshot", () => {
  it("defaults to empty", () => {
    expect(loadDiscoveredForms()).toEqual([]);
  });

  it("round-trips a set of forms", () => {
    const forms: AdultForm[] = ["dog", "ghost"];
    saveDiscoveredForms(forms);
    expect(loadDiscoveredForms()).toEqual(forms);
  });
});

describe("wipeFarm", () => {
  it("clears the farm archive but preserves discovered forms", () => {
    saveFarm([grave]);
    wipeFarm(["dog", "carrot"]);
    expect(loadFarm()).toEqual([]);
    expect(loadDiscoveredForms()).toEqual(["dog", "carrot"]);
  });
});

describe("export/import round trip", () => {
  it("carries forms that only survive in the discovered snapshot (post farm-wipe)", () => {
    // A wiped farm has no "carrot" gravestone anymore — only the snapshot
    // remembers it was ever discovered.
    saveFarm([grave]);
    wipeFarm(["dog", "carrot"]);
    const code = exportSave();

    // Simulate a fresh device/browser with no local state at all.
    store = {};
    expect(importSave(code)).toBe(true);
    expect(loadDiscoveredForms().sort()).toEqual(["carrot", "dog"]);
  });

  it("leaves local discovered forms untouched when importing a backup missing the discovered field", () => {
    saveDiscoveredForms(["dog", "carrot"]);
    // A well-formed current-version backup that simply predates/omits the
    // `discovered` field.
    const legacyCode = btoa(encodeURIComponent(JSON.stringify({ v: SAVE_VERSION, pet: null, farm: [] })));
    expect(importSave(legacyCode)).toBe(true);
    expect(loadDiscoveredForms()).toEqual(["dog", "carrot"]);
  });
});

describe("burial keeps the evidence", () => {
  // Burial used to call clearPet() on the only copy of the state, so a death
  // could never be explained after the fact — just a one-line cause, unverifiable.
  it("carries the full final state into the farm entry", () => {
    const pet: PetState = {
      ...createPet("Archibald", 1000),
      stage: "adult",
      form: "gremlin",
      deadAt: 5000,
      causeOfDeath: "an empty bowl",
      health: 0,
      zeroHealthMs: 7_200_000,
    };
    const farm = retireToFarm(pet, 6000);
    expect(farm[0].final?.zeroHealthMs).toBe(7_200_000);
    expect(farm[0].final?.diag.some((d) => d.kind === "hatched")).toBe(true);
    expect(farm[0].retiredAt).toBe(5000); // dated to the death, not the burial
  });

  it("survives an export/import round trip", () => {
    const pet: PetState = {
      ...createPet("Archibald", 1000),
      deadAt: 5000,
      causeOfDeath: "an empty bowl",
    };
    retireToFarm(pet, 6000);
    const code = exportSave();
    saveFarm([]);
    expect(importSave(code)).toBe(true);
    expect(loadFarm()[0].final?.name).toBe("Archibald");
  });

  it("logs a player-walked retirement, the one path dawn's auto-leave doesn't cover", () => {
    const pet: PetState = {
      ...createPet("Archibald", 1000),
      stage: "adult",
      form: "gremlin",
      // Neither deadAt nor departedAt is set — a player walking a ready adult
      // over retires it directly, without going through the dawn auto-leave
      // hook that would otherwise log this.
    };
    const farm = retireToFarm(pet, 9000);
    expect(farm[0].final?.diag.find((d) => d.kind === "retirement")?.note).toBe("walked");
  });

  it("does not double-log retirement for a pet that already departed on its own", () => {
    const pet: PetState = {
      ...createPet("Archibald", 1000),
      stage: "adult",
      form: "gremlin",
      departedAt: 8000,
    };
    const farm = retireToFarm(pet, 9000);
    const retirementLogs = farm[0].final?.diag.filter((d) => d.kind === "retirement") ?? [];
    expect(retirementLogs).toHaveLength(0);
  });
});

describe("migratePet backfills the diagnostics trail", () => {
  it("starts an empty trail for saves written before it existed", () => {
    const legacy = { ...createPet("Old", 1) } as Partial<PetState>;
    delete legacy.vitals;
    delete legacy.diag;
    const m = migratePet(legacy as PetState);
    expect(m.vitals).toEqual([]);
    expect(m.diag).toEqual([]);
  });
});
