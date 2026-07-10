import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
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
