import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  exportSave,
  importSave,
  loadDiscoveredForms,
  loadFarm,
  saveDiscoveredForms,
  saveFarm,
  wipeFarm,
} from "./persistence";
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

  it("leaves local discovered forms untouched when importing an old-format backup", () => {
    saveDiscoveredForms(["dog", "carrot"]);
    // An export from before the `discovered` field existed.
    const legacyCode = btoa(encodeURIComponent(JSON.stringify({ v: 1, pet: null, farm: [] })));
    expect(importSave(legacyCode)).toBe(true);
    expect(loadDiscoveredForms()).toEqual(["dog", "carrot"]);
  });
});
