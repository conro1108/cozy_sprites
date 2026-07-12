import { describe, expect, it } from "vitest";
import {
  ADULT_LIFESPAN_MS,
  AUTO_LEAVE_EXTRA_MS,
  CALL_EXPIRE_MS,
  DEATH_AFTER_ZERO_HEALTH_MS,
  DIAG_CAP,
  MAX_HEARTS,
  OVERWEIGHT,
  PAT_SATIATION,
  TAP_ANNOY_THRESHOLD,
  TAP_WINDOW_MS,
  TIMING,
  VITALS_CAP,
  ZOOMIES_DURATION_MS,
  applyElapsedDecay,
  applyGameResult,
  clean,
  createPet,
  discipline,
  feed,
  giveMedicine,
  isNight,
  pat,
  retirementPhase,
  rollIllness,
  stepEvents,
  tap,
  toggleLight,
  tooSickToPlay,
} from "./state";
import { migratePet } from "./persistence";
import { FOODS } from "./roster";
import type { IllnessId, PetState } from "./types";

const HOUR = 3_600_000;

/** Local wall-clock time on a fixed summer Monday (no DST transitions in
 *  June). isNight() runs on local hours, so every fixture is built this way —
 *  hour 30 rolls into the next day, which the Date constructor handles. */
function at(hour: number, minute = 0): number {
  return new Date(2026, 5, 15, hour, minute).getTime();
}

/** Mid-morning: deep in the day window, hours from either boundary. */
const T0 = at(10);

/** Advance a pet to a given stage for tests that need past-egg behaviour. */
function asStage(pet: PetState, stage: PetState["stage"]): PetState {
  return { ...pet, stage, stageStartedAt: pet.lastUpdated };
}

describe("day/night clock", () => {
  it("night runs 8pm to 8am local", () => {
    expect(isNight(at(19, 59))).toBe(false);
    expect(isNight(at(20))).toBe(true);
    expect(isNight(at(23))).toBe(true);
    expect(isNight(at(7, 59))).toBe(true);
    expect(isNight(at(8))).toBe(false);
  });
});

describe("applyElapsedDecay", () => {
  it("does nothing when no time passes", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    expect(applyElapsedDecay(pet, T0)).toBe(pet);
  });

  it("freezes stats during the egg stage", () => {
    const pet = createPet("Milo", T0);
    const later = applyElapsedDecay(pet, T0 + 30_000);
    expect(later.energy).toBe(pet.energy);
  });

  it("decays energy over time once hatched", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const later = applyElapsedDecay(pet, T0 + 30 * 60_000);
    expect(later.energy).toBeLessThan(pet.energy);
  });

  it("empties a full bowl in roughly 3.5 awake hours (adult)", () => {
    const pet = asStage({ ...createPet("Milo", T0), energy: MAX_HEARTS }, "adult");
    const nearly = applyElapsedDecay(pet, T0 + 3.4 * HOUR);
    expect(nearly.energy).toBeGreaterThan(0);
    const done = applyElapsedDecay(pet, T0 + 3.6 * HOUR);
    expect(done.energy).toBe(0);
  });

  it("clamps stats at zero after a long absence", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const later = applyElapsedDecay(pet, T0 + 5 * 24 * HOUR);
    expect(later.energy).toBe(0);
    expect(later.happiness).toBe(0);
    // Five ignored days is also, correctly, fatal (see the death suite).
    expect(later.deadAt).not.toBeNull();
  });
});

describe("starvation grace window", () => {
  const emptyBowl = () =>
    asStage(
      { ...createPet("Milo", T0), energy: 0, happiness: 4, health: 80 },
      "adult",
    );

  it("an hour at zero energy is not yet neglect", () => {
    const later = applyElapsedDecay(emptyBowl(), T0 + 1 * HOUR);
    expect(later.health).toBe(80); // no drain, no regen — just an empty bowl
    expect(later.hidden.careMistakes).toBe(0);
  });

  it("three hours at zero energy drains health and racks mistakes", () => {
    const later = applyElapsedDecay(emptyBowl(), T0 + 3 * HOUR);
    // ~1.5h past grace at −15/h.
    expect(later.health).toBeLessThan(60);
    expect(later.health).toBeGreaterThan(50);
    expect(later.hidden.careMistakes).toBeGreaterThanOrEqual(2.5);
    expect(later.hidden.careMistakes).toBeLessThanOrEqual(3.5);
  });

  it("feeding resets the grace clock", () => {
    const hungryAWhile = applyElapsedDecay(emptyBowl(), T0 + 1 * HOUR);
    expect(hungryAWhile.energyZeroMs).toBeCloseTo(1 * HOUR);
    const fed = feed(hungryAWhile, "burger", T0 + 1 * HOUR + 60_000).state;
    const later = applyElapsedDecay(fed, T0 + 2 * HOUR);
    expect(later.energyZeroMs).toBe(0);
  });
});

describe("night: sleep, all-nighters, and the bedtime bonus", () => {
  /** Tucked in properly at 10pm: fed, content, clean, well. */
  function tuckedIn(): PetState {
    return asStage(
      {
        ...createPet("Milo", at(22)),
        energy: 4,
        happiness: 4,
        health: 80,
        lightsOn: false,
        asleep: true,
      },
      "adult",
    );
  }

  it("relights the lantern and wakes the pet on its own at dawn", () => {
    const later = applyElapsedDecay(tuckedIn(), at(32, 5)); // 8:05am next day
    expect(later.lightsOn).toBe(true);
    expect(later.asleep).toBe(false);
  });

  it("stays asleep while it's still night", () => {
    const later = applyElapsedDecay(tuckedIn(), at(23));
    expect(later.lightsOn).toBe(false);
    expect(later.asleep).toBe(true);
  });

  it("sleep barely touches the meters — wakes hungry-ish, not starving", () => {
    const later = applyElapsedDecay(tuckedIn(), at(32, 5)); // 8:05am next day
    expect(later.energy).toBeGreaterThan(2); // breakfast ritual, not rescue
    expect(later.happiness).toBeGreaterThan(3);
  });

  it("pays the bedtime bonus for a full night's sleep gone to bed well", () => {
    const later = applyElapsedDecay(tuckedIn(), at(32, 5)); // 8:05am next day
    expect(later.health).toBeGreaterThan(85); // 80 + 8, minus rounding
  });

  it("withholds the bonus when it went to bed sick", () => {
    const sick = { ...tuckedIn(), sick: true, illness: "sniffles" as const };
    const later = applyElapsedDecay(sick, at(32, 5));
    expect(later.health).toBeLessThanOrEqual(80);
  });

  it("charges one care mistake — and some health — for a lights-on all-nighter", () => {
    const litAllNight = asStage(
      { ...createPet("Milo", at(19, 50)), energy: 4, happiness: 4, health: 100 },
      "adult",
    );
    const later = applyElapsedDecay(litAllNight, at(32, 10));
    expect(later.hidden.careMistakes).toBe(1);
    expect(later.health).toBeLessThan(92); // −1/h of lost sleep
    expect(later.health).toBeGreaterThan(80); // …but only slightly negative
  });

  it("untreated illness keeps draining overnight at half pace", () => {
    const sick = {
      ...tuckedIn(),
      sick: true,
      illness: "goblinflu" as const, // −10/h by day → −5/h by night
    };
    const later = applyElapsedDecay(sick, at(32, 0));
    // 10h at −5/h from 80 → ~30. Dramatic morning, not a corpse.
    expect(later.health).toBeLessThan(40);
    expect(later.health).toBeGreaterThan(20);
    expect(later.deadAt).toBeNull();
  });
});

describe("stage advancement", () => {
  it("hatches egg → baby after the egg timer", () => {
    const pet = createPet("Milo", T0);
    const later = applyElapsedDecay(pet, T0 + 61_000);
    expect(later.stage).toBe("baby");
  });

  it("hatches into a needy baby so care is immediately meaningful", () => {
    const pet = createPet("Milo", T0);
    const later = applyElapsedDecay(pet, T0 + 61_000);
    expect(later.energy).toBeLessThanOrEqual(2);
    expect(later.happiness).toBeLessThanOrEqual(2);
  });

  it("decays the baby portion of a span that crosses the egg→baby boundary", () => {
    const pet = createPet("Milo", T0);
    const past = applyElapsedDecay(pet, T0 + 61_000 + 60_000);
    expect(past.stage).toBe("baby");
    expect(past.energy).toBeLessThan(MAX_HEARTS);
  });

  it("graduates baby → child after its half-hour", () => {
    const pet = asStage(createPet("Milo", T0), "baby");
    const later = applyElapsedDecay(pet, T0 + TIMING.baby + 1_000);
    expect(later.stage).toBe("child");
  });

  it("assigns an adult form on crossing the teen boundary", () => {
    const teen = {
      ...asStage(createPet("Milo", T0), "teen"),
      stageElapsedMs: TIMING.teen - 1_000,
    };
    const later = applyElapsedDecay(teen, T0 + 2_000);
    expect(later.stage).toBe("adult");
    expect(later.form).not.toBeNull();
  });
});

describe("aging pauses while asleep", () => {
  const nightStart = at(22);
  const span = 90_000;

  it("freezes stage progress while the pet sleeps (SLEEP_AGE_RATE = 0)", () => {
    const asleepChild = asStage(
      { ...createPet("Milo", nightStart), lightsOn: false, asleep: true },
      "child",
    );
    const later = applyElapsedDecay(asleepChild, nightStart + span);
    expect(later.asleep).toBe(true);
    expect(later.stageElapsedMs).toBe(0);
  });

  it("accrues stage progress at 1x while awake over the same span", () => {
    const awakeChild = asStage(
      { ...createPet("Milo", nightStart), lightsOn: true },
      "child",
    );
    const later = applyElapsedDecay(awakeChild, nightStart + span);
    expect(later.stageElapsedMs).toBeCloseTo(span);
  });

  it("advances on awake time, not wall clock", () => {
    const child = {
      ...asStage(createPet("Milo", T0), "child"),
      stageElapsedMs: TIMING.child - 60_000,
    };
    const later = applyElapsedDecay(child, T0 + 2 * 60_000);
    expect(later.stage).toBe("teen");
  });
});

describe("feed", () => {
  it("restores energy, clamped to max", () => {
    const pet = asStage({ ...createPet("Milo", T0), energy: 1 }, "child");
    const { state } = feed(pet, "burger", T0);
    expect(state.energy).toBe(3);
  });

  it("cannot feed during the egg stage", () => {
    const pet = createPet("Milo", T0);
    const { note } = feed(pet, "burger", T0);
    expect(note).toBe("cant");
  });

  it("tracks cake consumption as a hidden stat", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { state } = feed(pet, "cake", T0);
    expect(state.hidden.cakeEaten).toBe(1);
  });

  it("refuses a proper meal when already full", () => {
    const pet = asStage({ ...createPet("Milo", T0), energy: MAX_HEARTS }, "child");
    const { state, note } = feed(pet, "burger", T0);
    expect(note).toBe("full");
    expect(state.energy).toBe(MAX_HEARTS);
    expect(state.weight).toBe(pet.weight);
  });

  it("still accepts a treat when full", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { note, state } = feed(pet, "cake", T0);
    expect(note).not.toBe("full");
    expect(state.hidden.cakeEaten).toBe(1);
  });
});

describe("salad, the disciplined pick", () => {
  it("heals a little when well", () => {
    const pet = asStage({ ...createPet("Milo", T0), energy: 1, health: 50 }, "child");
    const { state } = feed(pet, "salad", T0);
    expect(state.health).toBe(52);
    expect(state.energy).toBeCloseTo(3);
  });

  it("heals properly on a sickbed", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), energy: 1, health: 50, sick: true, illness: "goblinflu" as const },
      "child",
    );
    const { state } = feed(pet, "salad", T0);
    expect(state.health).toBe(56);
  });
});

describe("soup, the folk remedy", () => {
  const sickWith = (illness: IllnessId, over: Partial<PetState> = {}) =>
    asStage(
      { ...createPet("Milo", T0), energy: 2, health: 50, sick: true, illness, ...over },
      "child",
    );

  it.each(["sniffles", "goblinflu", "vapors"] as const)("cures %s", (illness) => {
    const { state, note } = feed(sickWith(illness), "soup", T0);
    expect(state.sick).toBe(false);
    expect(state.illness).toBeNull();
    expect(note).toBe("soupcure");
  });

  it.each(["dysentery", "trimethylaminuria", "plague"] as const)(
    "does not cure %s — that still wants medicine",
    (illness) => {
      const { state, note } = feed(sickWith(illness), "soup", T0);
      expect(state.sick).toBe(true);
      expect(state.illness).toBe(illness);
      expect(note).not.toBe("soupcure");
    },
  );

  it("clears the dose counter, so a later illness starts fresh", () => {
    const relapsed = sickWith("goblinflu", { dosesGiven: 1, lastDoseAt: T0, illnessMs: 2 * HOUR });
    const { state } = feed(relapsed, "soup", T0);
    expect(state.dosesGiven).toBe(0);
    expect(state.lastDoseAt).toBeNull();
    expect(state.illnessMs).toBe(0);
  });

  it("is a cure, not a tonic — health is left exactly where it was", () => {
    const { state } = feed(sickWith("sniffles"), "soup", T0);
    expect(state.health).toBe(50);
  });

  it("still feeds: energy and happiness land as normal", () => {
    const { state } = feed(sickWith("goblinflu", { energy: 2, happiness: 2 }), "soup", T0);
    expect(state.energy).toBeCloseTo(2 + FOODS.soup.energy);
    expect(state.happiness).toBeCloseTo(2 + FOODS.soup.happiness);
  });

  it("a full stomach doesn't turn away the cure", () => {
    // Soup is a proper meal, not a treat, so a full pet would normally refuse
    // it — but a sick pet gets its soup regardless.
    const stuffed = sickWith("vapors", { energy: MAX_HEARTS });
    const { state, note } = feed(stuffed, "soup", T0);
    expect(note).toBe("soupcure");
    expect(state.sick).toBe(false);
  });

  it("a full and healthy pet still refuses plain soup", () => {
    const stuffed = asStage({ ...createPet("Milo", T0), energy: MAX_HEARTS }, "child");
    expect(feed(stuffed, "soup", T0).note).toBe("full");
  });

  it("the cure note outranks a favorite-food note", () => {
    // The Little Cosmos's favorite is soup — the sickness lifting is the
    // headline, but it still pockets the favorite happiness bonus.
    const cosmos = asStage(
      {
        ...createPet("Milo", T0),
        form: "cosmos" as const,
        happiness: 2,
        sick: true,
        illness: "sniffles" as const,
      },
      "adult",
    );
    const { state, note } = feed(cosmos, "soup", T0);
    expect(note).toBe("soupcure");
    expect(state.happiness).toBeCloseTo(2 + FOODS.soup.happiness + 1);
  });

  it("soup on a well pet is just soup", () => {
    const well = asStage({ ...createPet("Milo", T0), energy: 2, health: 50 }, "child");
    const { state, note } = feed(well, "soup", T0);
    expect(note).toBeUndefined();
    expect(state.health).toBe(50);
    expect(state.sick).toBe(false);
  });
});

describe("illness particulars", () => {
  it("dysentery: meals only half stick", () => {
    const well = asStage({ ...createPet("Milo", T0), energy: 1 }, "adult");
    expect(feed(well, "burger", T0).state.energy).toBe(3);
    const runs = { ...well, sick: true, illness: "dysentery" as const };
    expect(feed(runs, "burger", T0).state.energy).toBe(2);
  });

  it("goblin flu blocks games — and banks no reward", () => {
    const flu = asStage(
      { ...createPet("Milo", T0), happiness: 1, sick: true, illness: "goblinflu" as const },
      "child",
    );
    expect(tooSickToPlay(flu)).toBe(true);
    const { state, note } = applyGameResult(flu, "fetch", true, T0);
    expect(note).toBe("toosick");
    expect(state.happiness).toBe(1);
    expect(state.hidden.gamePlays.fetch).toBe(0);
  });

  it("the sniffles don't block games", () => {
    const sniffly = asStage(
      { ...createPet("Milo", T0), sick: true, illness: "sniffles" as const },
      "child",
    );
    expect(tooSickToPlay(sniffly)).toBe(false);
  });

  it("the sniffles pass on their own within the day", () => {
    const sniffly = asStage(
      { ...createPet("Milo", T0), energy: 4, sick: true, illness: "sniffles" as const },
      "adult",
    );
    const later = applyElapsedDecay(sniffly, T0 + 4.5 * HOUR);
    expect(later.sick).toBe(false);
    expect(later.illness).toBeNull();
  });

  it("the sniffles are too mild to count as neglect", () => {
    const sniffly = asStage(
      { ...createPet("Milo", T0), energy: 4, happiness: 4, sick: true, illness: "sniffles" as const },
      "adult",
    );
    const later = applyElapsedDecay(sniffly, T0 + 1 * HOUR);
    expect(later.hidden.careMistakes).toBe(0);
  });

  it("untreated dysentery IS neglect", () => {
    const runs = asStage(
      { ...createPet("Milo", T0), energy: 4, happiness: 4, sick: true, illness: "dysentery" as const },
      "adult",
    );
    const later = applyElapsedDecay(runs, T0 + 1 * HOUR);
    expect(later.hidden.careMistakes).toBeGreaterThan(0);
  });

  it("the vapors: fainted — pats and pokes get nothing", () => {
    const fainted = asStage(
      { ...createPet("Milo", T0), happiness: 2, sick: true, illness: "vapors" as const },
      "adult",
    );
    expect(pat(fainted, T0).reaction).toBe("cant");
    expect(tap(fainted, T0).reaction).toBe("ignore");
  });

  it("the vapors: a proper daytime lie-down cures them", () => {
    const fainted = asStage(
      { ...createPet("Milo", T0), energy: 4, lightsOn: false, sick: true, illness: "vapors" as const },
      "adult",
    );
    const rested = applyElapsedDecay(fainted, T0 + 90 * 60_000);
    expect(rested.sick).toBe(false);
    expect(rested.illness).toBeNull();
  });

  it("trimethylaminuria: the pat lands but pays nothing", () => {
    const smelly = asStage(
      { ...createPet("Milo", T0), happiness: 2, sick: true, illness: "trimethylaminuria" as const },
      "adult",
    );
    const r = pat(smelly, T0);
    expect(r.reaction).toBe("enjoyed");
    expect(r.state.happiness).toBe(2);
  });
});

describe("clean", () => {
  it("clears poops", () => {
    const pet = asStage({ ...createPet("Milo", T0), poops: 2 }, "child");
    const { state, note } = clean(pet, T0);
    expect(state.poops).toBe(0);
    expect(note).toBe("cleaned");
  });

  it("reports nothing to clean when floor is clear", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    expect(clean(pet, T0).note).toBe("nothing");
  });
});

describe("giveMedicine", () => {
  it("cures a sick pet", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), sick: true, illness: "sniffles" as const },
      "child",
    );
    const { state, note } = giveMedicine(pet, T0);
    expect(state.sick).toBe(false);
    expect(state.illness).toBeNull();
    expect(note).toBe("cured");
  });

  it("is a care mistake when the pet is not sick", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { note, state } = giveMedicine(pet, T0);
    expect(note).toBe("notneeded");
    expect(state.hidden.careMistakes).toBe(1);
  });

  it("plague: two doses, and the second must wait an hour", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), sick: true, illness: "plague" as const },
      "child",
    );
    const first = giveMedicine(pet, T0);
    expect(first.note).toBe("dose");
    expect(first.state.sick).toBe(true);

    // Too eager: the first dose is still negotiating.
    const eager = giveMedicine(first.state, T0 + 30 * 60_000);
    expect(eager.note).toBe("toosoon");
    expect(eager.state.dosesGiven).toBe(1);

    // The return visit lands.
    const second = giveMedicine(eager.state, T0 + 61 * 60_000);
    expect(second.note).toBe("cured");
    expect(second.state.sick).toBe(false);
    expect(second.state.dosesGiven).toBe(0);
  });
});

describe("illness rolls", () => {
  it("assigns a named illness when a pet falls sick", () => {
    const pet = asStage({ ...createPet("Milo", T0), health: 10 }, "child");
    const { state, events } = stepEvents(pet, 15 * 60_000, () => 0.001);
    expect(events).toContain("sick");
    expect(state.illness).not.toBeNull();
  });

  it("rolls the plague only from the rare tail of the table", () => {
    expect(rollIllness(() => 0.95)).toBe("plague");
    expect(rollIllness(() => 0.0)).toBe("sniffles");
  });

  it("keeps the sniffles the most common ailment", () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const id = rollIllness(() => i / 1000);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    expect(ranked[0][0]).toBe("sniffles");
    expect(counts["trimethylaminuria"] ?? 0).toBeLessThan(counts["sniffles"]);
    expect(counts["plague"] ?? 0).toBeLessThan(counts["sniffles"]);
  });

  it("extra weight raises sickness pressure", () => {
    // rng 0.004 sits between the trim rate (0.25%/chunk) and the overweight
    // rate (~0.6%/chunk) — only the heavy pet falls ill.
    const trim = asStage(createPet("Milo", T0), "adult");
    expect(stepEvents(trim, 15 * 60_000, () => 0.004).events).not.toContain("sick");
    const heavy = { ...trim, weight: OVERWEIGHT + 1 };
    expect(stepEvents(heavy, 15 * 60_000, () => 0.004).events).toContain("sick");
  });
});

describe("weight consequences", () => {
  it("overweight dulls the joy of games", () => {
    const trim = asStage({ ...createPet("Milo", T0), happiness: 0 }, "adult");
    const heavy = { ...trim, weight: OVERWEIGHT + 2 };
    const trimGain = applyGameResult(trim, "fetch", true, T0).state.happiness;
    const heavyGain = applyGameResult(heavy, "fetch", true, T0).state.happiness;
    expect(heavyGain).toBeLessThan(trimGain);
  });

  it("underweight blocks health regen until fed back up", () => {
    const wellFed = asStage(
      { ...createPet("Milo", T0), energy: 4, happiness: 4, health: 50 },
      "adult",
    );
    const skinny = { ...wellFed, weight: 2 };
    expect(applyElapsedDecay(wellFed, T0 + 1 * HOUR).health).toBeGreaterThan(50);
    expect(applyElapsedDecay(skinny, T0 + 1 * HOUR).health).toBe(50);
  });

  it("a child burns off weight faster than an adult, matching its faster hunger", () => {
    // Children eat much more often than adults (energy decays 2.5x faster),
    // so their metabolism has to keep pace or weight only ever climbs.
    const heavy = { ...createPet("Milo", T0), weight: 10 };
    const child = asStage(heavy, "child");
    const adult = asStage(heavy, "adult");
    const childLoss = 10 - applyElapsedDecay(child, T0 + 1 * HOUR).weight;
    const adultLoss = 10 - applyElapsedDecay(adult, T0 + 1 * HOUR).weight;
    expect(childLoss).toBeGreaterThan(adultLoss);
    expect(childLoss).toBeCloseTo(adultLoss * 2.5);
  });

  it("weight per energy climbs from healthy to neutral to cake", () => {
    const ratio = (food: keyof typeof FOODS) => FOODS[food].weight / FOODS[food].energy;
    expect(ratio("carrot")).toBeLessThan(ratio("soup"));
    expect(ratio("soup")).toBeLessThan(ratio("burger"));
    expect(ratio("burger")).toBeLessThan(ratio("salad"));
    expect(ratio("salad")).toBeLessThan(ratio("cake"));
  });

  it("cube costs energy instead of restoring it — a treat, not a meal", () => {
    expect(FOODS.cube.energy).toBeLessThan(0);
    // Still a treat: always accepted, even on a full stomach (see feed()'s isTreat check).
    expect(FOODS.cube.happiness).toBeGreaterThanOrEqual(0.5);
  });

  it("pays the reward off the sprite's result — in RPS it's happiest when it beats you", () => {
    const pet = asStage({ ...createPet("Milo", T0), happiness: 1 }, "adult");
    const playerWins = applyGameResult(pet, "rps", true, T0).state.happiness;
    const spriteWins = applyGameResult(pet, "rps", false, T0).state.happiness;
    expect(spriteWins).toBeGreaterThan(playerWins);
    // Fetch is played *with* it: the shared result still decides the reward.
    const fetchWon = applyGameResult(pet, "fetch", true, T0).state.happiness;
    const fetchLost = applyGameResult(pet, "fetch", false, T0).state.happiness;
    expect(fetchWon).toBeGreaterThan(fetchLost);
  });

  it("a tied match splits the happiness reward between a sprite win and a sprite loss", () => {
    const pet = asStage({ ...createPet("Milo", T0), happiness: 1 }, "adult");
    const tie = applyGameResult(pet, "rps", "tie", T0).state.happiness;
    const spriteWins = applyGameResult(pet, "rps", false, T0).state.happiness;
    const playerWins = applyGameResult(pet, "rps", true, T0).state.happiness;
    expect(tie).toBeLessThan(spriteWins);
    expect(tie).toBeGreaterThan(playerWins);
  });

  it("fetch burns more energy and weight than other games", () => {
    const pet = asStage({ ...createPet("Milo", T0), energy: 4, weight: 10 }, "adult");
    const afterFetch = applyGameResult(pet, "fetch", true, T0).state;
    const afterRps = applyGameResult(pet, "rps", true, T0).state;
    expect(10 - afterFetch.weight).toBeGreaterThan(10 - afterRps.weight);
    expect(4 - afterFetch.energy).toBeGreaterThan(4 - afterRps.energy);
  });
});

describe("death", () => {
  function doomed(t = T0): PetState {
    return asStage(
      { ...createPet("Milo", t), health: 0, energy: 0, happiness: 0 },
      "child",
    );
  }

  it("dies after sustained daytime at zero health", () => {
    const later = applyElapsedDecay(doomed(), T0 + DEATH_AFTER_ZERO_HEALTH_MS + 60_000);
    expect(later.deadAt).not.toBeNull();
    expect(later.causeOfDeath).toBeTruthy();
  });

  it("does not die immediately at zero health", () => {
    const later = applyElapsedDecay(doomed(), T0 + 30_000);
    expect(later.deadAt).toBeNull();
  });

  it("never dies overnight — the doom clock waits for dawn", () => {
    const bedtimeDoom = doomed(at(21));
    const smallHours = applyElapsedDecay(bedtimeDoom, at(31, 30)); // 7:30am next day
    expect(smallHours.deadAt).toBeNull(); // 10.5 dark hours at zero health
    const morning = applyElapsedDecay(bedtimeDoom, at(35)); // 11am next day
    expect(morning.deadAt).not.toBeNull(); // daylight resumes the clock
  });

  it("total decay-only abandonment takes roughly a waking day", () => {
    const abandoned = asStage(
      { ...createPet("Milo", at(8, 30)), energy: 4, happiness: 4, health: 100 },
      "adult",
    );
    // Starves by noon, grace till ~13:30, health gone by evening — but night
    // shields it, so the end comes the next morning.
    const sameEvening = applyElapsedDecay(abandoned, at(19, 59));
    expect(sameEvening.deadAt).toBeNull();
    const nextMorning = applyElapsedDecay(abandoned, at(34)); // 10am next day
    expect(nextMorning.deadAt).not.toBeNull();
  });

  it("blames the illness when one is present", () => {
    const pet = { ...doomed(), sick: true, illness: "dysentery" as const };
    const later = applyElapsedDecay(pet, T0 + DEATH_AFTER_ZERO_HEALTH_MS + 60_000);
    expect(later.causeOfDeath).toBe("dysentery");
  });

  it("does not blame an illness that cannot itself drain health (drainPerHour 0)", () => {
    // The sniffles never kill on their own — a pet that dies while merely
    // carrying them died of the neglect underneath, not the cold.
    const pet = { ...doomed(), sick: true, illness: "sniffles" as const };
    const later = applyElapsedDecay(pet, T0 + DEATH_AFTER_ZERO_HEALTH_MS + 60_000);
    expect(later.causeOfDeath).not.toBe("the sniffles");
    expect(later.causeOfDeath).toBe("an empty bowl");
  });

  it("eggs cannot die", () => {
    const egg = { ...createPet("Milo", T0), health: 0 };
    const later = applyElapsedDecay(egg, T0 + 30_000);
    expect(later.deadAt).toBeNull();
  });

  it("dead pets no longer decay or act", () => {
    const dead = { ...doomed(), deadAt: T0, causeOfDeath: "dysentery" };
    const later = applyElapsedDecay(dead, T0 + 60 * 60_000);
    expect(later.stage).toBe("child");
    expect(feed(later, "burger", T0 + 61 * 60_000).note).toBe("cant");
    expect(stepEvents(later, 60_000, () => 0).events).toEqual([]);
  });
});

describe("retirement", () => {
  const adult = (t = T0) =>
    asStage(
      { ...createPet("Old Sport", t), energy: 4, happiness: 4, health: 100 },
      "adult",
    );

  it("phases: none → restless → ready as adult life accrues", () => {
    expect(retirementPhase(adult())).toBe("none");
    expect(retirementPhase({ ...adult(), adultLifeMs: ADULT_LIFESPAN_MS * 0.75 })).toBe("restless");
    expect(retirementPhase({ ...adult(), adultLifeMs: ADULT_LIFESPAN_MS })).toBe("ready");
  });

  it("thriving pets age toward retirement slower than scruffy ones", () => {
    const thriving = applyElapsedDecay(adult(), T0 + 1 * HOUR);
    const scruffy = applyElapsedDecay(
      { ...adult(), health: 30, happiness: 2 },
      T0 + 1 * HOUR,
    );
    expect(thriving.adultLifeMs).toBeGreaterThan(0);
    expect(scruffy.adultLifeMs).toBeGreaterThan(thriving.adultLifeMs);
  });

  it("a ready adult kept waiting long enough departs at dawn", () => {
    const waiting = {
      ...adult(at(22)),
      lightsOn: false,
      asleep: true,
      adultLifeMs: ADULT_LIFESPAN_MS + AUTO_LEAVE_EXTRA_MS,
    };
    const morning = applyElapsedDecay(waiting, at(32, 5));
    expect(morning.departedAt).not.toBeNull();
    // The departed have left the meadow: no decay, no meals, no events.
    expect(feed(morning, "burger", at(33)).note).toBe("cant");
    expect(stepEvents(morning, 60_000, () => 0).events).toEqual([]);
  });

  it("a ready adult that ISN'T overdue stays through the night", () => {
    const ready = {
      ...adult(at(22)),
      lightsOn: false,
      asleep: true,
      adultLifeMs: ADULT_LIFESPAN_MS,
    };
    const morning = applyElapsedDecay(ready, at(32, 5));
    expect(morning.departedAt).toBeNull();
    expect(retirementPhase(morning)).toBe("ready");
  });
});

describe("attention call expiry", () => {
  const caller = (fake: boolean): PetState =>
    asStage(
      {
        ...createPet("Milo", T0),
        energy: 4,
        happiness: 4,
        wantsAttention: true,
        fakeCall: fake,
        attentionWant: "snack" as const,
        callStartedAt: T0,
      },
      "adult",
    );

  it("a genuine call that goes stale is a care mistake", () => {
    const later = applyElapsedDecay(caller(false), T0 + CALL_EXPIRE_MS + 60_000);
    expect(later.wantsAttention).toBe(false);
    expect(later.hidden.careMistakes).toBe(1);
  });

  it("a fake call that goes stale just gives up the bit", () => {
    const later = applyElapsedDecay(caller(true), T0 + CALL_EXPIRE_MS + 60_000);
    expect(later.wantsAttention).toBe(false);
    expect(later.hidden.careMistakes).toBe(0);
  });

  it("a fresh call survives a short wait", () => {
    const later = applyElapsedDecay(caller(false), T0 + 10 * 60_000);
    expect(later.wantsAttention).toBe(true);
  });
});

describe("zoomies", () => {
  it("a happy, healthy pet can catch the zoomies", () => {
    // A single short slice (well under EVENT_CHUNK_MS) ending exactly at
    // lastUpdated, so a roll that lands isn't dismissed as already-stale.
    // Roll order within the slice is poop, illness, attention call, then
    // zoomies — keep the first three high (no mess, no illness, no call) and
    // let only the fourth roll low.
    let calls = 0;
    const rng = () => {
      calls++;
      return calls === 4 ? 0 : 0.99;
    };
    const pet = asStage(createPet("Milo", T0), "child");
    const { state, events } = stepEvents(pet, 60_000, rng);
    expect(events).toContain("zoomies");
    expect(state.zoomies).toBe(true);
    expect(state.zoomiesStartedAt).not.toBeNull();
  });

  it("never strikes a sick pet", () => {
    const pet = { ...asStage(createPet("Milo", T0), "child"), sick: true, illness: "sniffles" as const };
    const { events } = stepEvents(pet, 1 * HOUR, () => 0);
    expect(events).not.toContain("zoomies");
  });

  it("never strikes a pet that's down in the dumps", () => {
    const pet = { ...asStage(createPet("Milo", T0), "child"), happiness: 1 };
    const { events } = stepEvents(pet, 1 * HOUR, () => 0);
    expect(events).not.toContain("zoomies");
  });

  it("runs its course with no penalty, unlike a stale attention call", () => {
    const zooming = asStage(
      { ...createPet("Milo", T0), zoomies: true, zoomiesStartedAt: T0 },
      "child",
    );
    const later = applyElapsedDecay(zooming, T0 + ZOOMIES_DURATION_MS + 5_000);
    expect(later.zoomies).toBe(false);
    expect(later.zoomiesStartedAt).toBeNull();
    expect(later.hidden.careMistakes).toBe(0);
  });

  it("a fresh burst survives a short moment", () => {
    const zooming = asStage(
      { ...createPet("Milo", T0), zoomies: true, zoomiesStartedAt: T0 },
      "child",
    );
    const soon = applyElapsedDecay(zooming, T0 + 5_000);
    expect(soon.zoomies).toBe(true);
  });
});

describe("discipline", () => {
  it("rewards correct discipline of a fake call", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), wantsAttention: true, fakeCall: true },
      "teen",
    );
    const { state, note } = discipline(pet, T0);
    expect(note).toBe("correct");
    expect(state.hidden.discipline).toBeGreaterThan(0);
    expect(state.wantsAttention).toBe(false);
  });

  it("rewards disciplining a demand the pet doesn't need", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), energy: 3, wantsAttention: true, fakeCall: false, attentionWant: "snack" as const },
      "teen",
    );
    const { state, note } = discipline(pet, T0);
    expect(note).toBe("correct");
    expect(state.hidden.discipline).toBeGreaterThan(0);
    expect(state.wantsAttention).toBe(false);
  });

  it("penalises disciplining a genuine need", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), energy: 0.5, wantsAttention: true, fakeCall: false, attentionWant: "snack" as const },
      "teen",
    );
    const { state, note } = discipline(pet, T0);
    expect(note).toBe("incorrect");
    expect(state.hidden.careMistakes).toBe(1);
  });

  it("penalises incorrect discipline", () => {
    const pet = asStage(createPet("Milo", T0), "teen");
    const { state, note } = discipline(pet, T0);
    expect(note).toBe("incorrect");
    expect(state.hidden.careMistakes).toBe(1);
  });

  it("cannot discipline a baby", () => {
    const pet = asStage(createPet("Milo", T0), "baby");
    expect(discipline(pet, T0).note).toBe("cant");
  });
});

describe("tap", () => {
  it("reacts to the first poke, then ignores the next few", () => {
    let pet = asStage(createPet("Milo", T0), "child");
    const first = tap(pet, T0);
    expect(first.reaction).toBe("react");
    pet = first.state;
    const second = tap(pet, T0 + 100);
    expect(second.reaction).toBe("ignore");
  });

  it("becomes annoyed after rapid taps", () => {
    let pet = asStage(createPet("Milo", T0), "child");
    let reaction = "";
    for (let i = 0; i < TAP_ANNOY_THRESHOLD; i++) {
      const r = tap(pet, T0 + i * 100);
      pet = r.state;
      reaction = r.reaction;
    }
    expect(reaction).toBe("annoyed");
  });

  it("keeps ignoring-then-complaining for the rest of an unbroken streak, never reacting again", () => {
    let pet = asStage(createPet("Milo", T0), "child");
    const reactions: string[] = [];
    for (let i = 0; i < TAP_ANNOY_THRESHOLD * 3; i++) {
      const r = tap(pet, T0 + i * 100);
      pet = r.state;
      reactions.push(r.reaction);
    }
    expect(reactions).toEqual([
      "react",
      "ignore",
      "ignore",
      "annoyed",
      "ignore",
      "ignore",
      "ignore",
      "annoyed",
      "ignore",
      "ignore",
      "ignore",
      "annoyed",
    ]);
  });

  it("reacts again only after the streak actually goes quiet", () => {
    let pet = asStage(createPet("Milo", T0), "child");
    for (let i = 0; i < TAP_ANNOY_THRESHOLD; i++) {
      const r = tap(pet, T0 + i * 100);
      pet = r.state;
    }
    const afterQuiet = tap(pet, T0 + TAP_ANNOY_THRESHOLD * 100 + TAP_WINDOW_MS);
    expect(afterQuiet.reaction).toBe("react");
  });

  it("doesn't resume a stale pre-call streak once a snack/play call resolves", () => {
    const pet = asStage(
      {
        ...createPet("Milo", T0),
        tapStreak: 3,
        recentTaps: [],
        wantsAttention: true,
        fakeCall: false,
        attentionWant: "snack" as const,
      },
      "child",
    );
    const hint = tap(pet, T0);
    expect(hint.reaction).toBe("hint");

    const resolved: PetState = { ...hint.state, wantsAttention: false, attentionWant: null };
    const afterResolve = tap(resolved, T0 + 50);
    expect(afterResolve.reaction).toBe("ignore");
  });

  it("hints (not answers) on a pat call — a poke is the wrong gesture now", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), wantsAttention: true, fakeCall: false, attentionWant: "pat" as const },
      "child",
    );
    const r = tap(pet, T0);
    expect(r.reaction).toBe("hint");
    expect(r.want).toBe("pat");
    expect(r.state.wantsAttention).toBe(true);
  });

  it("hints when the call wants something a poke isn't", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), wantsAttention: true, fakeCall: false, attentionWant: "snack" as const },
      "child",
    );
    const r = tap(pet, T0);
    expect(r.reaction).toBe("hint");
    expect(r.want).toBe("snack");
    expect(r.state.wantsAttention).toBe(true);
  });

  it("only hints at a fake pat call — a poke can't spoil it (that's pat()'s job)", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), wantsAttention: true, fakeCall: true, attentionWant: "pat" as const },
      "teen",
    );
    const r = tap(pet, T0);
    expect(r.reaction).toBe("hint");
    expect(r.state.wantsAttention).toBe(true);
  });

  it("peeks at the first poke while asleep, then shushes the rest of the streak", () => {
    let pet = asStage(
      { ...createPet("Milo", at(22)), lightsOn: false, asleep: true },
      "child",
    );
    const first = tap(pet, at(22));
    expect(first.reaction).toBe("peek");
    pet = first.state;
    const second = tap(pet, at(22) + 100);
    expect(second.reaction).toBe("shush");
    pet = second.state;
    const third = tap(pet, at(22) + 200);
    expect(third.reaction).toBe("shush");
  });

  it("peeks again once an asleep streak actually goes quiet", () => {
    const pet = asStage(
      { ...createPet("Milo", at(22)), lightsOn: false, asleep: true },
      "child",
    );
    const first = tap(pet, at(22));
    expect(first.reaction).toBe("peek");
    const afterQuiet = tap(first.state, at(22) + TAP_WINDOW_MS);
    expect(afterQuiet.reaction).toBe("peek");
  });

  it("still ignores a fainted (vapors) sleeper rather than peeking", () => {
    const pet = asStage(
      { ...createPet("Milo", at(22)), lightsOn: false, asleep: true, sick: true, illness: "vapors" as const },
      "child",
    );
    expect(tap(pet, at(22)).reaction).toBe("ignore");
  });
});

describe("pat", () => {
  const child = () => asStage(createPet("Milo", T0), "child");

  it("cannot pat an egg, a sleeper, or the dead", () => {
    expect(pat(createPet("Milo", T0), T0).reaction).toBe("cant");
    const asleep = asStage(
      { ...createPet("Milo", at(22)), lightsOn: false, asleep: true },
      "child",
    );
    expect(pat(asleep, at(22)).reaction).toBe("cant");
    const dead = asStage(
      { ...createPet("Milo", T0), deadAt: T0, causeOfDeath: "neglect" },
      "child",
    );
    expect(pat(dead, T0).reaction).toBe("cant");
  });

  it("enjoyed: a plain pat is always welcome and lifts happiness", () => {
    const r = pat({ ...child(), happiness: 1 }, T0);
    expect(r.reaction).toBe("enjoyed");
    expect(r.state.happiness).toBeGreaterThan(1);
  });

  it("answered: a genuine pat call is satisfied by the right gesture", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), wantsAttention: true, fakeCall: false, attentionWant: "pat" as const },
      "child",
    );
    const r = pat(pet, T0);
    expect(r.reaction).toBe("answered");
    expect(r.state.wantsAttention).toBe(false);
  });

  it("spoiled: comforting a fake pat call is a care mistake", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), wantsAttention: true, fakeCall: true, attentionWant: "pat" as const },
      "teen",
    );
    const r = pat(pet, T0);
    expect(r.reaction).toBe("spoiled");
    expect(r.state.hidden.careMistakes).toBe(1);
  });

  it("enough: past satiation a pat stops paying — but never subtracts", () => {
    let pet: PetState = { ...child(), happiness: 1 };
    let last = pat(pet, T0);
    pet = last.state;
    for (let i = 1; i <= PAT_SATIATION; i++) {
      last = pat(pet, T0 + i * 100);
      pet = last.state;
    }
    expect(last.reaction).toBe("enough");
    const before = pet.happiness;
    const extra = pat(pet, pet.lastUpdated);
    expect(extra.reaction).toBe("enough");
    expect(extra.state.happiness).toBe(before);
  });

  it("affinity: a dog loves pats more than a gremlin does", () => {
    const dog = asStage({ ...createPet("Dog", T0), form: "dog" as const, happiness: 0 }, "adult");
    const grem = asStage({ ...createPet("Grem", T0), form: "gremlin" as const, happiness: 0 }, "adult");
    expect(pat(dog, T0).state.happiness).toBeGreaterThan(pat(grem, T0).state.happiness);
  });
});

describe("attention wants", () => {
  it("feeding satisfies a genuine snack call", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), energy: 0.5, wantsAttention: true, fakeCall: false, attentionWant: "snack" as const },
      "child",
    );
    const { state, call } = feed(pet, "burger", T0);
    expect(call).toBe("satisfied");
    expect(state.wantsAttention).toBe(false);
  });

  it("feeding a fake snack call rewards the con", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), energy: 1, wantsAttention: true, fakeCall: true, attentionWant: "snack" as const },
      "teen",
    );
    const { state, call } = feed(pet, "burger", T0);
    expect(call).toBe("spoiled");
    expect(state.hidden.careMistakes).toBe(1);
  });

  it("a finished game satisfies a genuinely bored play call", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), happiness: 0.5, wantsAttention: true, fakeCall: false, attentionWant: "play" as const },
      "child",
    );
    const { state, call } = applyGameResult(pet, "fetch", true, T0);
    expect(call).toBe("satisfied");
    expect(state.wantsAttention).toBe(false);
  });

  it("rewards a longer Cube's Hum run with more happiness", () => {
    const base = asStage({ ...createPet("Milo", T0), happiness: 0 }, "child");
    const short = applyGameResult(base, "cubehum", false, T0, 1).state.happiness;
    const long = applyGameResult(base, "cubehum", true, T0, 8).state.happiness;
    expect(long).toBeGreaterThan(short);
  });

  it("feeding a snack it doesn't need spoils, even on a genuine call", () => {
    const pet = asStage(
      {
        ...createPet("Milo", T0),
        energy: 3,
        discipline: 50,
        wantsAttention: true,
        fakeCall: false,
        attentionWant: "snack" as const,
      },
      "child",
    );
    const { state, call } = feed(pet, "burger", T0);
    expect(call).toBe("spoiled");
    expect(state.hidden.careMistakes).toBe(1);
    // Half of what a correct scold would have earned (8 for a non-teen).
    expect(state.discipline).toBe(46);
  });

  it("playing when it isn't bored spoils, even on a genuine call", () => {
    const pet = asStage(
      {
        ...createPet("Milo", T0),
        happiness: 3,
        discipline: 50,
        wantsAttention: true,
        fakeCall: false,
        attentionWant: "play" as const,
      },
      "child",
    );
    const { state, call } = applyGameResult(pet, "fetch", true, T0);
    expect(call).toBe("spoiled");
    expect(state.hidden.careMistakes).toBe(1);
    expect(state.discipline).toBe(46);
  });

  it("falling for a fake call costs more discipline as a teen, mirroring the bigger correct-scold reward", () => {
    const pet = asStage(
      {
        ...createPet("Milo", T0),
        energy: 3,
        discipline: 50,
        wantsAttention: true,
        fakeCall: true,
        attentionWant: "snack" as const,
      },
      "teen",
    );
    const { state, call } = feed(pet, "burger", T0);
    expect(call).toBe("spoiled");
    // Half of the teen correct-scold reward (12), not the non-teen one (8).
    expect(state.discipline).toBe(44);
  });

  it("every new call comes with a want attached", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { state, events } = stepEvents(pet, 60_000, () => 0.001);
    expect(events).toContain("call");
    expect(state.attentionWant).not.toBeNull();
    expect(state.callStartedAt).not.toBeNull();
  });
});

describe("stepEvents", () => {
  it("spawns a poop when rng is favourable", () => {
    const pet = asStage(createPet("Milo", T0), "baby");
    const { state, events } = stepEvents(pet, 60_000, () => 0);
    expect(events).toContain("poop");
    expect(state.poops).toBe(1);
  });

  it("produces no events during the egg stage", () => {
    const pet = createPet("Milo", T0);
    const { events } = stepEvents(pet, 60_000, () => 0);
    expect(events).toEqual([]);
  });

  it("asleep is quiet time — no messes, plots, or demands", () => {
    // Lights off at midnight: genuinely asleep, so the world holds still.
    const pet = {
      ...asStage(createPet("Milo", new Date(2026, 5, 16, 0).getTime()), "child"),
      lightsOn: false,
      asleep: true,
    };
    const { events } = stepEvents(pet, 1 * HOUR, () => 0);
    expect(events).toEqual([]);
  });

  it("an awake pet at night still gets messes, calls, and the odd bug", () => {
    // Lights blazing at midnight: quiet time is about being asleep, not the
    // hour, so an owl kept up late still needs looking after.
    const pet = asStage(createPet("Milo", new Date(2026, 5, 16, 0).getTime()), "child");
    expect(pet.asleep).toBe(false);
    const { events } = stepEvents(pet, 1 * HOUR, () => 0);
    expect(events).not.toEqual([]);
  });

  it("dysentery floods the floor at an rng a healthy pet wouldn't poop on", () => {
    const healthy = asStage(createPet("Milo", T0), "adult");
    expect(stepEvents(healthy, 1 * HOUR, () => 0.35).events).not.toContain("poop");

    const runs = { ...healthy, sick: true, illness: "dysentery" as const };
    expect(stepEvents(runs, 1 * HOUR, () => 0.35).events).toContain("poop");
  });

  it("a long absence is replayed in slices — several messes, not one", () => {
    // 8 daytime hours away with an adversarial rng: the floor fills to its
    // 8-mess cap, one slice at a time.
    const pet = asStage(createPet("Milo", at(18)), "child");
    const { state, events } = stepEvents(pet, 8 * HOUR, () => 0);
    expect(state.poops).toBe(8);
    expect(events.filter((e) => e === "poop")).toHaveLength(8);
  });

  it("a call rolled hours ago during an absence is already stale — charged, not shown", () => {
    // One slice fires a call at ~10:15, then nothing else. By 6pm it's long
    // expired: a genuine cry with nobody home becomes a care mistake, and no
    // active call greets the returning player.
    let calls = 0;
    const rng = () => {
      // Alternate rolls: poop-roll high (no poop), sick-roll high, call-roll
      // low exactly once, then everything high.
      calls++;
      return calls === 3 ? 0 : 0.99;
    };
    const pet = asStage(createPet("Milo", at(18)), "child");
    const { state } = stepEvents(pet, 8 * HOUR, rng);
    expect(state.wantsAttention).toBe(false);
    expect(state.hidden.careMistakes).toBe(1);
  });

  it("a fake call never asks for a pat — a pat is always a fair ask", () => {
    // Rolls in order: poop (high, none), sick (high, none), call-gate (low,
    // triggers), fake (low, triggers), want-index (swept across its range).
    const rngFor = (indexRoll: number) => {
      let calls = 0;
      return () => {
        calls++;
        if (calls === 3 || calls === 4) return 0;
        if (calls === 5) return indexRoll;
        return 0.99;
      };
    };
    const pet = asStage(createPet("Milo", T0), "teen");
    for (const indexRoll of [0, 0.999]) {
      const { state, events } = stepEvents(pet, 60_000, rngFor(indexRoll));
      expect(events).toContain("fakecall");
      expect(state.attentionWant).not.toBe("pat");
    }
  });
});

describe("fiber-driven poop quality", () => {
  const quiet = () => 0.999;
  const always = () => 0;

  it("fiber level drifts toward recent meals via a rolling average", () => {
    const child = asStage(createPet("Milo", T0), "child");
    const carrotFed = feed(child, "carrot", T0).state;
    expect(carrotFed.fiberLevel).toBeGreaterThan(child.fiberLevel);
    const cubeFed = feed(child, "cube", T0).state;
    expect(cubeFed.fiberLevel).toBeLessThan(child.fiberLevel);
  });

  it("poops on a regular per-stage schedule, not gated by fiber", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { events } = stepEvents(pet, 60_000, always);
    expect(events).toContain("poop");
  });

  it("babies poop far more often than adults on the same roll", () => {
    const roll = () => 0.1;
    const baby = asStage(createPet("Milo", T0), "baby");
    const adult = asStage(createPet("Milo", T0), "adult");
    expect(stepEvents(baby, 60_000, roll).events).toContain("poop");
    expect(stepEvents(adult, 60_000, roll).events).not.toContain("poop");
  });

  it("does not poop on an unfavourable roll", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { events } = stepEvents(pet, 60_000, quiet);
    expect(events).not.toContain("poop");
  });

  it("still honours the poops cap even on a favourable roll", () => {
    const pet = asStage({ ...createPet("Milo", T0), poops: 8 }, "child");
    const { state, events } = stepEvents(pet, 60_000, always);
    expect(events).not.toContain("poop");
    expect(state.poops).toBe(8);
  });

  it("a fiber-rich diet makes poops good: small weight loss, small health gain", () => {
    let pet = asStage({ ...createPet("Milo", T0), health: 50 }, "child");
    pet = feed(pet, "carrot", T0).state;
    expect(pet.fiberLevel).toBeGreaterThanOrEqual(0.4);
    const weightBefore = pet.weight;
    const healthBefore = pet.health; // carrot itself already nudges health up
    const { state, events } = stepEvents(pet, 60_000, always);
    expect(events).toContain("poop");
    expect(events).not.toContain("poop-bad");
    expect(state.weight).toBeCloseTo(weightBefore - 0.15);
    expect(state.health).toBe(healthBefore + 1);
    expect(state.hasBadPoop).toBe(false);
  });

  it("a junk-heavy diet makes poops bad: bigger weight loss, health hit, sticky flag", () => {
    let pet = asStage({ ...createPet("Milo", T0), health: 50 }, "child");
    pet = feed(pet, "cube", T0).state;
    pet = feed(pet, "cube", T0).state;
    expect(pet.fiberLevel).toBeLessThanOrEqual(0.2);
    const weightBefore = pet.weight;
    const { state, events } = stepEvents(pet, 60_000, always);
    expect(events).toContain("poop");
    expect(events).toContain("poop-bad");
    expect(state.weight).toBeCloseTo(weightBefore - 0.5);
    expect(state.health).toBe(46);
    expect(state.hasBadPoop).toBe(true);
  });

  it("a middling diet makes poops neutral: no weight/health effect from quality", () => {
    let pet = asStage({ ...createPet("Milo", T0), health: 50 }, "child");
    pet = feed(pet, "burger", T0).state;
    expect(pet.fiberLevel).toBeGreaterThan(0.2);
    expect(pet.fiberLevel).toBeLessThan(0.4);
    const weightBefore = pet.weight;
    const { state, events } = stepEvents(pet, 60_000, always);
    expect(events).toContain("poop");
    expect(events).not.toContain("poop-bad");
    expect(state.weight).toBeCloseTo(weightBefore);
    expect(state.health).toBe(50);
  });

  it("dysentery always makes poops bad, even on a fiber-rich diet", () => {
    let pet = asStage(
      { ...createPet("Milo", T0), health: 50, sick: true, illness: "dysentery" },
      "child",
    );
    pet = feed(pet, "carrot", T0).state;
    expect(pet.fiberLevel).toBeGreaterThanOrEqual(0.4);
    const { events } = stepEvents(pet, 60_000, always);
    expect(events).toContain("poop-bad");
  });

  it("clean() resets the bad-poop flag along with the mess", () => {
    const pet = { ...asStage(createPet("Milo", T0), "child"), poops: 1, hasBadPoop: true };
    const { state } = clean(pet, T0);
    expect(state.poops).toBe(0);
    expect(state.hasBadPoop).toBe(false);
  });

  it("a lingering bad poop raises sickness pressure", () => {
    // rng 0.005 sits between the base rate (~0.25%/chunk) and the bad-poop-
    // bumped rate (~1%/chunk) — only the pet with a bad poop still on the
    // floor falls ill.
    const trim = asStage(createPet("Milo", T0), "adult");
    expect(stepEvents(trim, 15 * 60_000, () => 0.005).events).not.toContain("sick");
    const withBadPoop = { ...trim, hasBadPoop: true };
    expect(stepEvents(withBadPoop, 15 * 60_000, () => 0.005).events).toContain("sick");
  });
});

describe("save migration", () => {
  it("backfills fiberLevel/hasBadPoop on a save that predates them", () => {
    const { fiberLevel: _drop, hasBadPoop: _drop2, ...legacy } = createPet("Ancient", T0);
    const migrated = migratePet(legacy as unknown as PetState);
    expect(migrated.fiberLevel).toBe(0.3);
    expect(migrated.hasBadPoop).toBe(false);

    const fed = feed(asStage(migrated, "child"), "carrot", T0).state;
    expect(Number.isNaN(fed.fiberLevel)).toBe(false);
    expect(fed.fiberLevel).toBeGreaterThan(0.3);
  });

  it("derives stageElapsedMs from wall-clock progress and defaults recentPats", () => {
    const aged = {
      ...createPet("Ancient", T0),
      stage: "child" as const,
      stageStartedAt: T0,
      lastUpdated: T0 + 90_000,
    };
    const { stageElapsedMs: _s, recentPats: _p, ...legacy } = aged;
    const migrated = migratePet(legacy as unknown as PetState);
    expect(migrated.stageElapsedMs).toBe(90_000);
    expect(migrated.recentPats).toEqual([]);
  });

  it("backfills every real-clock field on a pre-real-mode save", () => {
    const {
      energyZeroMs: _a,
      happinessZeroMs: _b,
      nightAwakeMs: _c,
      nightSleepMs: _d,
      adultLifeMs: _e,
      departedAt: _f,
      callStartedAt: _g,
      lastDoseAt: _h,
      illnessMs: _i,
      napMs: _j,
      ...legacy
    } = createPet("Ancient", T0);
    const migrated = migratePet(legacy as unknown as PetState);
    expect(migrated.energyZeroMs).toBe(0);
    expect(migrated.happinessZeroMs).toBe(0);
    expect(migrated.nightAwakeMs).toBe(0);
    expect(migrated.nightSleepMs).toBe(0);
    expect(migrated.adultLifeMs).toBe(0);
    expect(migrated.departedAt).toBeNull();
    expect(migrated.callStartedAt).toBeNull();
    expect(migrated.lastDoseAt).toBeNull();
    expect(migrated.illnessMs).toBe(0);
    expect(migrated.napMs).toBe(0);

    // And the backfilled accumulators survive arithmetic — no NaN freezing
    // the grace windows shut.
    const later = applyElapsedDecay(asStage(migrated, "child"), T0 + 30 * 60_000);
    expect(Number.isNaN(later.energyZeroMs)).toBe(false);
  });

  it("migrates a pre-rename save's hunger field to energy", () => {
    const { energy: _e, energyZeroMs: _ez, ...pet } = createPet("Ancient", T0);
    const legacy = { ...pet, hunger: 2, hungerZeroMs: 45_000 };
    const migrated = migratePet(legacy as unknown as PetState);
    expect(migrated.energy).toBe(2);
    expect(migrated.energyZeroMs).toBe(45_000);

    // And it stays usable — no NaN freezing the meter shut.
    const fed = feed(asStage(migrated, "child"), "carrot", T0).state;
    expect(Number.isNaN(fed.energy)).toBe(false);
    expect(fed.energy).toBeGreaterThan(2);
  });

  it("starts the expiry clock on an in-flight call from an old save", () => {
    const calling = {
      ...createPet("Ancient", T0),
      wantsAttention: true,
      attentionWant: "snack" as const,
    };
    const { callStartedAt: _g, ...legacy } = calling;
    const migrated = migratePet(legacy as unknown as PetState);
    expect(migrated.callStartedAt).toBe(migrated.lastUpdated);
  });
});

// --- Regressions --------------------------------------------------------------
// Both of these were live bugs. They are the reason the diagnostics below exist.

describe("overnight event replay (a sleeping pet is not an awake one)", () => {
  /** Reproduces the real sequence: pet tucked in at 10pm, app closed, reopened
   *  after dawn. applyElapsedDecay relights the lantern on the way through, so
   *  the state handed to stepEvents claims the pet is awake with the lights on.
   *  stepEvents must still judge the night by how it actually was. */
  function sleepThroughTheNight(rng: () => number) {
    const bedtime = at(22);
    // Exactly dawn: the whole span is night, so a sleeping pet should roll
    // nothing at all. (Past 8am the pet is legitimately awake and does roll.)
    const morning = at(32);
    const pet: PetState = {
      ...asStage(createPet("Milo", bedtime), "adult"),
      lightsOn: false,
      asleep: true,
    };
    const lightsOnDuringSpan = pet.lightsOn;
    const decayed = applyElapsedDecay(pet, morning);
    // The dawn relight is what sets the trap — assert it really happened.
    expect(decayed.lightsOn).toBe(true);
    expect(decayed.asleep).toBe(false);
    return stepEvents(decayed, morning - bedtime, rng, lightsOnDuringSpan);
  }

  it("rolls no events across a night spent asleep, even with a certain rng", () => {
    // rng() === 0 makes every probability check fire, so any unskipped chunk
    // would poop, fall ill and place a call. The night must roll nothing at all.
    const { state, events } = sleepThroughTheNight(() => 0);
    expect(events).toEqual([]);
    expect(state.poops).toBe(0);
    expect(state.sick).toBe(false);
  });

  it("charges no care mistakes for calls a sleeping pet never made", () => {
    const { state } = sleepThroughTheNight(() => 0);
    expect(state.hidden.careMistakes).toBe(0);
  });

  it("still rolls events for a night the pet was left awake under the lights", () => {
    const bedtime = at(22);
    const morning = at(32);
    const pet: PetState = {
      ...asStage(createPet("Milo", bedtime), "adult"),
      lightsOn: true,
      asleep: false,
    };
    const decayed = applyElapsedDecay(pet, morning);
    const { state } = stepEvents(decayed, morning - bedtime, () => 0, true);
    expect(state.poops).toBeGreaterThan(0);
  });
});

describe("the doom clock never freezes part-spent", () => {
  /** A pet nursed back to 1-10 health used to keep its part-spent death clock
   *  forever — the reset only fired above 10. Nothing on any screen showed it,
   *  and the next dip to zero killed in minutes instead of two hours. */
  it("unwinds while health sits in the fragile 1-10 band", () => {
    const pet: PetState = {
      ...asStage(createPet("Milo", T0), "adult"),
      health: 8,
      zeroHealthMs: 1.5 * HOUR,
    };
    const later = applyElapsedDecay(pet, T0 + HOUR);
    expect(later.zeroHealthMs).toBeLessThan(1.5 * HOUR);
  });

  it("wipes outright once the pet is properly recovered", () => {
    const pet: PetState = {
      ...asStage(createPet("Milo", T0), "adult"),
      health: 60,
      zeroHealthMs: 1.5 * HOUR,
    };
    expect(applyElapsedDecay(pet, T0 + 60_000).zeroHealthMs).toBe(0);
  });

  it("still kills after a full unbroken span at zero health", () => {
    const pet: PetState = {
      ...asStage(createPet("Milo", T0), "adult"),
      health: 0,
      energy: 0,
      happiness: 0,
    };
    const dead = applyElapsedDecay(pet, T0 + DEATH_AFTER_ZERO_HEALTH_MS + 60_000);
    expect(dead.deadAt).not.toBeNull();
  });

  it("does not kill a fragile pet minutes after it dips back to zero", () => {
    // 1h50m of clock already banked, then two hours spent at 8 health (which
    // unwinds it), then back to zero. It must get the full two hours again.
    const nursed: PetState = {
      ...asStage(createPet("Milo", T0), "adult"),
      health: 8,
      zeroHealthMs: 1.83 * HOUR,
    };
    const recovered = applyElapsedDecay(nursed, T0 + 2 * HOUR);
    expect(recovered.zeroHealthMs).toBe(0);
    const relapsed = applyElapsedDecay(
      { ...recovered, health: 0, energy: 0 },
      recovered.lastUpdated + 30 * 60_000,
    );
    expect(relapsed.deadAt).toBeNull();
  });
});

describe("diagnostics", () => {
  it("samples vitals about once an hour", () => {
    const pet = asStage(createPet("Milo", T0), "adult");
    const later = applyElapsedDecay(pet, T0 + 5 * HOUR);
    expect(later.vitals.length).toBeGreaterThanOrEqual(4);
    expect(later.vitals.length).toBeLessThanOrEqual(6);
    expect(later.vitals[0].health).toBeTypeOf("number");
  });

  it("logs the night's ledger at dawn", () => {
    const pet: PetState = {
      ...asStage(createPet("Milo", at(22)), "adult"),
      lightsOn: false,
      asleep: true,
    };
    const morning = applyElapsedDecay(pet, at(32, 20));
    const dawn = morning.diag.filter((d) => d.kind === "dawn");
    expect(dawn).toHaveLength(1);
    expect(dawn[0].note).toMatch(/slept/);
  });

  it("records the death, with its cause", () => {
    const pet: PetState = {
      ...asStage(createPet("Milo", T0), "adult"),
      health: 0,
      energy: 0,
    };
    const dead = applyElapsedDecay(pet, T0 + DEATH_AFTER_ZERO_HEALTH_MS + 60_000);
    const death = dead.diag.find((d) => d.kind === "death");
    expect(death?.note).toBe(dead.causeOfDeath);
  });

  it("does not mutate the trail of the state it was handed", () => {
    const pet = asStage(createPet("Milo", T0), "adult");
    applyElapsedDecay(pet, T0 + 5 * HOUR);
    expect(pet.vitals).toHaveLength(0);
  });

  it("tracks a lifetime total alongside each ring's current length", () => {
    const pet = asStage(createPet("Milo", T0), "adult");
    expect(pet.diagTotal).toBe(pet.diag.length); // just "hatched" so far
    const { state } = feed(pet, "burger", T0);
    expect(state.diagTotal).toBe(pet.diagTotal + 1);
    expect(state.diagTotal).toBe(state.diag.length);
  });

  it("keeps counting the lifetime total past the ring's cap once it starts evicting", () => {
    // A diag ring already sitting at the cap, as if DIAG_CAP events have been
    // logged over a long, heavily-interacted life. One more push should still
    // grow the ring's length keeps at the cap while diagTotal keeps counting —
    // the ring truncates, the total doesn't.
    const full = Array.from({ length: DIAG_CAP }, (_, i) => ({ t: T0 + i, kind: "fed" as const }));
    const pet: PetState = {
      ...asStage(createPet("Milo", T0), "adult"),
      diag: full,
      diagTotal: DIAG_CAP,
    };
    const { state } = feed(pet, "burger", T0 + DIAG_CAP + 1000);
    expect(state.diag.length).toBe(DIAG_CAP); // ring stays capped
    expect(state.diagTotal).toBe(DIAG_CAP + 1); // but the total keeps climbing
    expect(state.diagTotal).toBeGreaterThan(state.diag.length);
  });

  it("keeps counting the vitals lifetime total past the ring's cap too", () => {
    const full = Array.from({ length: VITALS_CAP }, (_, i) => ({
      t: T0 + i * HOUR,
      health: 100,
      energy: 4,
      happiness: 4,
      weight: 5,
      poops: 0,
      illness: null,
      asleep: false,
      lightsOn: true,
      zeroHealthMs: 0,
      careMistakes: 0,
    }));
    const pet: PetState = {
      ...asStage(createPet("Milo", T0), "adult"),
      lastUpdated: T0 + (VITALS_CAP - 1) * HOUR,
      vitals: full,
      vitalsTotal: VITALS_CAP,
    };
    const later = applyElapsedDecay(pet, pet.lastUpdated + 2 * HOUR);
    expect(later.vitals.length).toBe(VITALS_CAP);
    expect(later.vitalsTotal).toBeGreaterThan(VITALS_CAP);
    expect(later.vitalsTotal).toBeGreaterThan(later.vitals.length);
  });
});

describe("diagnostics: the full care loop reaches the log", () => {
  it("logs a pat", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { state } = pat(pet, T0);
    expect(state.diag.find((d) => d.kind === "pat")?.note).toBe("enjoyed");
  });

  it("logs pat satiation once the window fills up", () => {
    let pet: PetState = asStage(createPet("Milo", T0), "child");
    for (let i = 0; i <= PAT_SATIATION; i++) {
      pet = pat(pet, T0 + i * 100).state;
    }
    expect(pet.diag.some((d) => d.kind === "pat" && d.note === "enough")).toBe(true);
  });

  it("logs a tap reaction", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { state } = tap(pet, T0);
    expect(state.diag.find((d) => d.kind === "tap")?.note).toBe("react");
  });

  it("does not mutate the caller's diag when applyElapsedDecay is a no-op", () => {
    // tap()/pat() call applyElapsedDecay first; when no time has passed it
    // hands back the same object, so logging must clone diag itself or it
    // would corrupt the array the caller is still holding.
    const pet = asStage(createPet("Milo", T0), "child");
    const before = pet.diag.length;
    tap(pet, T0);
    expect(pet.diag.length).toBe(before);
  });

  it("logs discipline outcomes", () => {
    const correct = asStage({ ...createPet("Milo", T0), wantsAttention: true, fakeCall: true }, "teen");
    expect(discipline(correct, T0).state.diag.find((d) => d.kind === "discipline")?.note).toBe("correct");
    const wrong = asStage(createPet("Milo", T0), "teen");
    expect(discipline(wrong, T0).state.diag.find((d) => d.kind === "discipline")?.note).toBe("incorrect");
  });

  it("logs lights on/off", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const off = toggleLight(pet, T0);
    expect(off.diag.find((d) => d.kind === "lights")?.note).toBe("off");
    const on = toggleLight(off, T0 + 1_000);
    expect(on.diag.find((d) => d.kind === "lights" && d.note === "on")).toBeTruthy();
  });

  it("logs a played game with its outcome", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { state } = applyGameResult(pet, "fetch", true, T0);
    expect(state.diag.find((d) => d.kind === "played")?.note).toBe("fetch win");
  });

  it("logs an attention call being raised, with its want", () => {
    let calls = 0;
    // Roll order per EVENT_CHUNK_MS slice: poop, sick, then the call roll.
    // Miss the first two, hit the call roll, then take the first fake/want pick.
    const rng = () => {
      calls++;
      return calls === 3 ? 0 : 0.99;
    };
    const pet = asStage(createPet("Milo", T0), "adult");
    const { state } = stepEvents(pet, 60_000, rng);
    const raised = state.diag.find((d) => d.kind === "call" && d.note?.startsWith("raised"));
    expect(raised).toBeTruthy();
  });

  it("logs a call resolution when an action satisfies it", () => {
    const pet = asStage(
      {
        ...createPet("Milo", T0),
        energy: 0.5,
        wantsAttention: true,
        fakeCall: false,
        attentionWant: "snack" as const,
      },
      "child",
    );
    const { state } = feed(pet, "burger", T0);
    expect(state.diag.find((d) => d.kind === "call")?.note).toBe("satisfied:snack");
  });

  it("logs a stale call's expiry", () => {
    const caller = asStage(
      {
        ...createPet("Milo", T0),
        wantsAttention: true,
        fakeCall: false,
        attentionWant: "snack" as const,
        callStartedAt: T0,
      },
      "adult",
    );
    const later = applyElapsedDecay(caller, T0 + CALL_EXPIRE_MS + 60_000);
    expect(later.diag.some((d) => d.kind === "call" && d.note?.startsWith("expired"))).toBe(true);
  });

  it("logs a zoomies burst", () => {
    let calls = 0;
    const rng = () => {
      calls++;
      return calls === 4 ? 0 : 0.99;
    };
    const pet = asStage(createPet("Milo", T0), "child");
    const { state } = stepEvents(pet, 60_000, rng);
    expect(state.diag.some((d) => d.kind === "zoomies")).toBe(true);
  });

  it("logs restless → ready retirement phase transitions", () => {
    const base = asStage(
      { ...createPet("Old Sport", T0), energy: 4, happiness: 4, health: 100 },
      "adult",
    );
    const restless = applyElapsedDecay(
      { ...base, adultLifeMs: ADULT_LIFESPAN_MS * 0.7 - 1_000 },
      T0 + 2_000,
    );
    expect(restless.diag.find((d) => d.kind === "retirement")?.note).toBe("restless");

    const ready = applyElapsedDecay(
      { ...base, adultLifeMs: ADULT_LIFESPAN_MS - 1_000 },
      T0 + 2_000,
    );
    expect(ready.diag.find((d) => d.kind === "retirement")?.note).toBe("ready");
  });

  it("logs an auto-departure at dawn", () => {
    const waiting = {
      ...asStage(createPet("Old Sport", at(22)), "adult"),
      lightsOn: false,
      asleep: true,
      adultLifeMs: ADULT_LIFESPAN_MS + AUTO_LEAVE_EXTRA_MS,
    };
    const morning = applyElapsedDecay(waiting, at(32, 5));
    expect(morning.diag.some((d) => d.kind === "retirement" && d.note?.startsWith("departed"))).toBe(
      true,
    );
  });

  it("enriches the adult-evolution log with the hidden inputs that decided the form", () => {
    const teen = {
      ...asStage(createPet("Milo", T0), "teen"),
      stageElapsedMs: TIMING.teen - 1_000,
    };
    const evolved = applyElapsedDecay(teen, T0 + 2_000);
    const stageEvent = evolved.diag.find((d) => d.kind === "stage" && d.note?.startsWith("adult"));
    expect(stageEvent?.note).toMatch(/mistakes/);
    expect(stageEvent?.note).toMatch(/discipline/);
    expect(stageEvent?.note).toMatch(new RegExp(evolved.form!));
  });
});
