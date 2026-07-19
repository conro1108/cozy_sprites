import { describe, expect, it } from "vitest";
import {
  describeCondition,
  dyingLine,
  farmConfirmLine,
  illnessAnnouncement,
  isDying,
  memorialLine,
  pickLine,
  seasonLine,
  shouldSpeak,
  speakChance,
  teenFlickerLine,
} from "./dialogue";
import type { Category } from "./dialogue";
import { createPet } from "./state";
import { ADULT_ORDER } from "./roster";
import type { PetState } from "./types";

const T0 = 1_700_000_000_000;

function petAt(stage: PetState["stage"], form: PetState["form"] = null): PetState {
  return { ...createPet("Milo", T0), stage, form };
}

/** Every line a (state, category) can produce, by sweeping the rng. 97 is
 *  prime and larger than any bank, so every index gets hit. */
function allLines(state: PetState, category: Category): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < 97; i++) {
    const line = pickLine(state, category, () => i / 97);
    if (line !== null) out.add(line);
  }
  return out;
}

describe("chattiness", () => {
  it("always speaks for important feedback", () => {
    expect(speakChance(petAt("teen"), "sick")).toBe(1);
    expect(speakChance(petAt("teen"), "win")).toBe(1);
    expect(speakChance(petAt("adult", "ghost"), "call")).toBe(1);
  });

  it("routine chatter is throttled and varies by stage", () => {
    expect(speakChance(petAt("teen"), "tap")).toBeLessThan(
      speakChance(petAt("child"), "tap"),
    );
  });

  it("varies by adult form — the dog talks more than the ghost", () => {
    expect(speakChance(petAt("adult", "dog"), "idle")).toBeGreaterThan(
      speakChance(petAt("adult", "ghost"), "idle"),
    );
  });

  it("shouldSpeak respects the roll", () => {
    expect(shouldSpeak(petAt("teen"), "tap", () => 0.99)).toBe(false);
    expect(shouldSpeak(petAt("teen"), "tap", () => 0.0)).toBe(true);
  });
});

describe("seasonLine", () => {
  const seasons = ["spring", "summer", "fall", "winter"] as const;

  it("draws from the matching season's bank and never crosses over", () => {
    // Sweep the rng across each bank; every result must be unique to its season.
    const banks = seasons.map((s) =>
      Array.from({ length: 20 }, (_, i) => seasonLine(s, null, () => i / 20)),
    );
    banks.forEach((bank, i) => {
      const others = new Set(banks.filter((_, j) => j !== i).flat());
      for (const line of bank) expect(others.has(line)).toBe(false);
    });
  });

  it("is deterministic for a given roll", () => {
    expect(seasonLine("fall", null, () => 0)).toBe(seasonLine("fall", null, () => 0));
  });

  it("pools a form's seasonal line with the general bank", () => {
    // rng()=0 draws the form's own line (pooled at the front); a general-bank
    // roll still surfaces a shared line — so both voices remain reachable.
    const formLine = seasonLine("winter", "menace", () => 0);
    const generalLine = seasonLine("winter", null, () => 0);
    expect(formLine).not.toBe(generalLine);
    const pooled = Array.from({ length: 20 }, (_, i) => seasonLine("winter", "menace", () => i / 20));
    expect(pooled).toContain(generalLine);
  });
});

describe("stage voices", () => {
  // A formless adult resolves straight to the GENERAL bank — the grown-up
  // fallback voice the young stages must never leak into.
  const GENERAL_VOICE = petAt("adult");

  it("young stages never fall through to the grown-up voice on common categories", () => {
    const stages: PetState["stage"][] = ["baby", "child", "teen"];
    const categories: Category[] = ["pat", "pat_enough", "win", "lose", "annoyed", "medicine", "feed"];
    for (const stage of stages) {
      for (const cat of categories) {
        const own = allLines(petAt(stage), cat);
        const general = allLines(GENERAL_VOICE, cat);
        expect(own.size, `${stage}/${cat} has no lines of its own`).toBeGreaterThan(0);
        // A missing stage bank would resolve to GENERAL's set exactly — a
        // shared line or two ("More.") is fine, wholesale identity is not.
        expect(own, `${stage}/${cat} fell through to the GENERAL bank`).not.toEqual(general);
      }
    }
  });

  it("a baby's pat vocabulary includes drooling", () => {
    expect(allLines(petAt("baby"), "pat")).toContain("*drools*");
  });

  it("every adult form keeps its own idle voice", () => {
    for (const form of ADULT_ORDER) {
      expect(allLines(petAt("adult", form), "idle").size).toBeGreaterThan(3);
    }
  });
});

describe("teen flicker", () => {
  it("hints at every adult form without quoting its actual lines", () => {
    for (const form of ADULT_ORDER) {
      const adultIdle = allLines(petAt("adult", form), "idle");
      const flickers = new Set<string>();
      for (let i = 0; i < 97; i++) {
        const line = teenFlickerLine(form, () => i / 97);
        if (line !== null) flickers.add(line);
      }
      expect(flickers.size, `${form} has no flicker lines`).toBeGreaterThan(0);
      for (const line of flickers) {
        expect(adultIdle, `${form} flicker quotes the adult verbatim: "${line}"`).not.toContain(line);
      }
    }
  });
});

describe("illness + memorial copy", () => {
  it("announces illnesses Oregon-Trail style", () => {
    expect(illnessAnnouncement("Milo", "dysentery", () => 0)).toBe(
      "Milo has dysentery.",
    );
  });

  it("writes the memorial line with a cause", () => {
    expect(memorialLine("Milo", "the plague")).toBe("Milo has died of the plague.");
  });
});

describe("describeCondition", () => {
  const awake = (over: Partial<PetState>): PetState => ({
    ...createPet("Milo", T0),
    stage: "child", // createPet starts as an egg; most cases want a hatched pet
    asleep: false,
    sick: false,
    illness: null,
    ...over,
  });

  it("is deterministic for a given pet and moment", () => {
    const p = awake({ energy: 0 });
    expect(describeCondition(p, T0)).toBe(describeCondition(p, T0));
  });

  it("names the illness, and it outranks an empty bowl", () => {
    const p = awake({ sick: true, illness: "plague", energy: 0 });
    expect(describeCondition(p, T0)).toContain("the plague");
  });

  it("an egg reads as forming even with empty meters", () => {
    const egg = awake({ stage: "egg", energy: 0, happiness: 0 });
    const starving = awake({ stage: "baby", energy: 0, happiness: 0 });
    // Egg branch wins over the energy/mood branches.
    expect(describeCondition(egg, T0)).not.toBe(describeCondition(starving, T0));
  });

  it("an empty bowl reads differently from a thriving pet", () => {
    const starving = awake({ energy: 0, happiness: 4, health: 100 });
    const thriving = awake({ energy: 4, happiness: 4, health: 100 });
    expect(describeCondition(starving, T0)).not.toBe(describeCondition(thriving, T0));
  });

  it("sleep outranks a peckish stomach", () => {
    const asleep = awake({ asleep: true, energy: 2, happiness: 4, health: 100 });
    const up = awake({ asleep: false, energy: 2, happiness: 4, health: 100 });
    expect(describeCondition(asleep, T0)).not.toBe(describeCondition(up, T0));
  });

  const ZOOMIES_LABELS = [
    "Has the zoomies",
    "Zooming",
    "Absolutely sending it",
    "Vibrating with energy",
  ];

  it("the zoomies read distinctly from an ordinary good mood", () => {
    const zooming = awake({ zoomies: true, energy: 4, happiness: 4, health: 100 });
    const calm = awake({ zoomies: false, energy: 4, happiness: 4, health: 100 });
    expect(ZOOMIES_LABELS).toContain(describeCondition(zooming, T0));
    expect(describeCondition(zooming, T0)).not.toBe(describeCondition(calm, T0));
  });

  it("being sick outranks the zoomies", () => {
    const p = awake({ zoomies: true, sick: true, illness: "sniffles", energy: 4, happiness: 4 });
    expect(ZOOMIES_LABELS).not.toContain(describeCondition(p, T0));
  });
});

describe("farm confirmation lines", () => {
  it("has distinct lines for every stage", () => {
    const stages: PetState["stage"][] = ["egg", "baby", "child", "teen", "adult"];
    const lines = stages.map((s) => farmConfirmLine(s, () => 0));
    expect(new Set(lines).size).toBe(stages.length);
  });
});

describe("dying dialogue", () => {
  it("triggers on low health or an active doom clock, but never after death", () => {
    expect(isDying({ ...petAt("adult"), health: 10 })).toBe(true);
    expect(isDying({ ...petAt("adult"), health: 50, zeroHealthMs: 1 })).toBe(true);
    expect(isDying({ ...petAt("adult"), health: 50 })).toBe(false);
    expect(isDying({ ...petAt("adult"), health: 0, deadAt: T0 })).toBe(false);
  });

  it("names the circumstance — sickness beats energy beats loneliness", () => {
    const base = { ...petAt("adult"), health: 5 };
    expect(dyingLine({ ...base, sick: true, energy: 0 }, () => 0)).toBe(
      "The end is near.",
    );
    expect(dyingLine({ ...base, energy: 0 }, () => 0)).toBe("So... hungry...");
    expect(dyingLine({ ...base, energy: 3, happiness: 0 }, () => 0)).toBe(
      "It's so quiet...",
    );
    expect(dyingLine({ ...base, energy: 3, happiness: 3 }, () => 0)).toBe(
      "The end is near.",
    );
  });
});

describe("clean_nothing", () => {
  it("always comments when you sweep a clean floor", () => {
    expect(speakChance(petAt("adult", "ghost"), "clean_nothing")).toBe(1);
    expect(pickLine(petAt("child"), "clean_nothing", () => 0)).toBeTruthy();
  });
});

describe("pickLine", () => {
  it("uses the adult form's own voice when available", () => {
    const line = pickLine(petAt("adult", "ghost"), "idle", () => 0);
    expect(line).toBe("...");
  });

  it("falls back to the general bank for uncovered categories", () => {
    const line = pickLine(petAt("adult", "ghost"), "clean", () => 0);
    expect(line).toBeTruthy();
  });
});
