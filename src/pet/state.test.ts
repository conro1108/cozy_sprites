import { describe, expect, it } from "vitest";
import {
  ADULT_LIFESPAN_MS,
  AUTO_LEAVE_EXTRA_MS,
  CALL_EXPIRE_MS,
  DEATH_AFTER_ZERO_HEALTH_MS,
  MAX_HEARTS,
  OVERWEIGHT,
  PAT_SATIATION,
  TAP_ANNOY_THRESHOLD,
  TAP_WINDOW_MS,
  TIMING,
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
  tooSickToPlay,
} from "./state";
import { migratePet } from "./persistence";
import type { PetState } from "./types";

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
    expect(later.hunger).toBe(pet.hunger);
  });

  it("decays hunger over time once hatched", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const later = applyElapsedDecay(pet, T0 + 30 * 60_000);
    expect(later.hunger).toBeLessThan(pet.hunger);
  });

  it("empties a full bowl in roughly 3.5 awake hours (adult)", () => {
    const pet = asStage({ ...createPet("Milo", T0), hunger: MAX_HEARTS }, "adult");
    const nearly = applyElapsedDecay(pet, T0 + 3.4 * HOUR);
    expect(nearly.hunger).toBeGreaterThan(0);
    const done = applyElapsedDecay(pet, T0 + 3.6 * HOUR);
    expect(done.hunger).toBe(0);
  });

  it("clamps stats at zero after a long absence", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const later = applyElapsedDecay(pet, T0 + 5 * 24 * HOUR);
    expect(later.hunger).toBe(0);
    expect(later.happiness).toBe(0);
    // Five ignored days is also, correctly, fatal (see the death suite).
    expect(later.deadAt).not.toBeNull();
  });
});

describe("starvation grace window", () => {
  const emptyBowl = () =>
    asStage(
      { ...createPet("Milo", T0), hunger: 0, happiness: 4, health: 80 },
      "adult",
    );

  it("an hour at zero hunger is not yet neglect", () => {
    const later = applyElapsedDecay(emptyBowl(), T0 + 1 * HOUR);
    expect(later.health).toBe(80); // no drain, no regen — just an empty bowl
    expect(later.hidden.careMistakes).toBe(0);
  });

  it("three hours at zero hunger drains health and racks mistakes", () => {
    const later = applyElapsedDecay(emptyBowl(), T0 + 3 * HOUR);
    // ~1.5h past grace at −15/h.
    expect(later.health).toBeLessThan(60);
    expect(later.health).toBeGreaterThan(50);
    expect(later.hidden.careMistakes).toBeGreaterThanOrEqual(2.5);
    expect(later.hidden.careMistakes).toBeLessThanOrEqual(3.5);
  });

  it("feeding resets the grace clock", () => {
    const hungryAWhile = applyElapsedDecay(emptyBowl(), T0 + 1 * HOUR);
    expect(hungryAWhile.hungerZeroMs).toBeCloseTo(1 * HOUR);
    const fed = feed(hungryAWhile, "burger", T0 + 1 * HOUR + 60_000).state;
    const later = applyElapsedDecay(fed, T0 + 2 * HOUR);
    expect(later.hungerZeroMs).toBe(0);
  });
});

describe("night: sleep, all-nighters, and the bedtime bonus", () => {
  /** Tucked in properly at 10pm: fed, content, clean, well. */
  function tuckedIn(): PetState {
    return asStage(
      {
        ...createPet("Milo", at(22)),
        hunger: 4,
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
    expect(later.hunger).toBeGreaterThan(2); // breakfast ritual, not rescue
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
      { ...createPet("Milo", at(19, 50)), hunger: 4, happiness: 4, health: 100 },
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
    expect(later.hunger).toBeLessThanOrEqual(2);
    expect(later.happiness).toBeLessThanOrEqual(2);
  });

  it("decays the baby portion of a span that crosses the egg→baby boundary", () => {
    const pet = createPet("Milo", T0);
    const past = applyElapsedDecay(pet, T0 + 61_000 + 60_000);
    expect(past.stage).toBe("baby");
    expect(past.hunger).toBeLessThan(MAX_HEARTS);
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
  it("restores hunger, clamped to max", () => {
    const pet = asStage({ ...createPet("Milo", T0), hunger: 1 }, "child");
    const { state } = feed(pet, "burger", T0);
    expect(state.hunger).toBe(3);
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
    const pet = asStage({ ...createPet("Milo", T0), hunger: MAX_HEARTS }, "child");
    const { state, note } = feed(pet, "burger", T0);
    expect(note).toBe("full");
    expect(state.hunger).toBe(MAX_HEARTS);
    expect(state.weight).toBe(pet.weight);
  });

  it("still accepts a treat when full", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { note, state } = feed(pet, "cake", T0);
    expect(note).not.toBe("full");
    expect(state.hidden.cakeEaten).toBe(1);
  });
});

describe("soup, the comfort food", () => {
  it("heals a little when well", () => {
    const pet = asStage({ ...createPet("Milo", T0), hunger: 1, health: 50 }, "child");
    const { state } = feed(pet, "soup", T0);
    expect(state.health).toBe(52);
    expect(state.hunger).toBeCloseTo(2.5);
  });

  it("heals properly on a sickbed", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), hunger: 1, health: 50, sick: true, illness: "goblinflu" as const },
      "child",
    );
    const { state } = feed(pet, "soup", T0);
    expect(state.health).toBe(56);
  });
});

describe("illness particulars", () => {
  it("dysentery: meals only half stick", () => {
    const well = asStage({ ...createPet("Milo", T0), hunger: 1 }, "adult");
    expect(feed(well, "burger", T0).state.hunger).toBe(3);
    const runs = { ...well, sick: true, illness: "dysentery" as const };
    expect(feed(runs, "burger", T0).state.hunger).toBe(2);
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
      { ...createPet("Milo", T0), hunger: 4, sick: true, illness: "sniffles" as const },
      "adult",
    );
    const later = applyElapsedDecay(sniffly, T0 + 4.5 * HOUR);
    expect(later.sick).toBe(false);
    expect(later.illness).toBeNull();
  });

  it("the sniffles are too mild to count as neglect", () => {
    const sniffly = asStage(
      { ...createPet("Milo", T0), hunger: 4, happiness: 4, sick: true, illness: "sniffles" as const },
      "adult",
    );
    const later = applyElapsedDecay(sniffly, T0 + 1 * HOUR);
    expect(later.hidden.careMistakes).toBe(0);
  });

  it("untreated dysentery IS neglect", () => {
    const runs = asStage(
      { ...createPet("Milo", T0), hunger: 4, happiness: 4, sick: true, illness: "dysentery" as const },
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
      { ...createPet("Milo", T0), hunger: 4, lightsOn: false, sick: true, illness: "vapors" as const },
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
      { ...createPet("Milo", T0), hunger: 4, happiness: 4, health: 50 },
      "adult",
    );
    const skinny = { ...wellFed, weight: 2 };
    expect(applyElapsedDecay(wellFed, T0 + 1 * HOUR).health).toBeGreaterThan(50);
    expect(applyElapsedDecay(skinny, T0 + 1 * HOUR).health).toBe(50);
  });
});

describe("death", () => {
  function doomed(t = T0): PetState {
    return asStage(
      { ...createPet("Milo", t), health: 0, hunger: 0, happiness: 0 },
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
      { ...createPet("Milo", at(8, 30)), hunger: 4, happiness: 4, health: 100 },
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
      { ...createPet("Old Sport", t), hunger: 4, happiness: 4, health: 100 },
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
        hunger: 4,
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
      { ...createPet("Milo", T0), hunger: 3, wantsAttention: true, fakeCall: false, attentionWant: "snack" as const },
      "teen",
    );
    const { state, note } = discipline(pet, T0);
    expect(note).toBe("correct");
    expect(state.hidden.discipline).toBeGreaterThan(0);
    expect(state.wantsAttention).toBe(false);
  });

  it("penalises disciplining a genuine need", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), hunger: 0.5, wantsAttention: true, fakeCall: false, attentionWant: "snack" as const },
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
      { ...createPet("Milo", T0), hunger: 0.5, wantsAttention: true, fakeCall: false, attentionWant: "snack" as const },
      "child",
    );
    const { state, call } = feed(pet, "burger", T0);
    expect(call).toBe("satisfied");
    expect(state.wantsAttention).toBe(false);
  });

  it("feeding a fake snack call rewards the con", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), hunger: 1, wantsAttention: true, fakeCall: true, attentionWant: "snack" as const },
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
      { ...createPet("Milo", T0), hunger: 3, wantsAttention: true, fakeCall: false, attentionWant: "snack" as const },
      "child",
    );
    const { state, call } = feed(pet, "burger", T0);
    expect(call).toBe("spoiled");
    expect(state.hidden.careMistakes).toBe(1);
  });

  it("playing when it isn't bored spoils, even on a genuine call", () => {
    const pet = asStage(
      { ...createPet("Milo", T0), happiness: 3, wantsAttention: true, fakeCall: false, attentionWant: "play" as const },
      "child",
    );
    const { state, call } = applyGameResult(pet, "fetch", true, T0);
    expect(call).toBe("spoiled");
    expect(state.hidden.careMistakes).toBe(1);
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

  it("night is quiet time — no messes, plots, or demands", () => {
    // Awake (lights blazing) at midnight, but the world itself is asleep.
    const pet = asStage(createPet("Milo", new Date(2026, 5, 16, 0).getTime()), "child");
    const { events } = stepEvents(pet, 1 * HOUR, () => 0);
    expect(events).toEqual([]);
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
});

describe("fiber-driven pooping", () => {
  const quiet = () => 0.999;

  it("accumulates poop pressure when fed, scaled by fiber", () => {
    const child = asStage(createPet("Milo", T0), "child");
    const carrot = feed(child, "carrot", T0).state;
    const cube = feed(child, "cube", T0).state;
    expect(carrot.poopPressure).toBeGreaterThan(0);
    expect(carrot.poopPressure).toBeGreaterThan(cube.poopPressure);
  });

  it("digests faster as a baby than as an adult", () => {
    const babyFed = feed(asStage(createPet("Milo", T0), "baby"), "carrot", T0).state;
    const adultFed = feed(asStage(createPet("Milo", T0), "adult"), "carrot", T0).state;
    expect(babyFed.poopPressure).toBeGreaterThan(adultFed.poopPressure);
  });

  it("caps pressure so a backlog can't re-cover a swept meadow", () => {
    let pet = asStage({ ...createPet("Milo", T0), poops: 4 }, "baby");
    for (let i = 0; i < 20; i++) pet = feed(pet, "cake", T0).state;
    expect(pet.poopPressure).toBeGreaterThan(1);
    expect(pet.poopPressure).toBeLessThanOrEqual(2);

    pet = { ...pet, poops: 0 };
    for (let i = 0; i < 6; i++) pet = stepEvents(pet, 60_000, quiet).state;
    expect(pet.poops).toBeLessThanOrEqual(2);
  });

  it("fires exactly one poop when pressure crosses 1.0", () => {
    const pet = asStage({ ...createPet("Milo", T0), poopPressure: 1.2 }, "child");
    const { state, events } = stepEvents(pet, 60_000, quiet);
    expect(events.filter((e) => e === "poop")).toHaveLength(1);
    expect(state.poops).toBe(1);
  });

  it("keeps the remainder so a big meal queues the next poop", () => {
    const pet = asStage({ ...createPet("Milo", T0), poopPressure: 1.2 }, "child");
    const once = stepEvents(pet, 60_000, quiet).state;
    expect(once.poopPressure).toBeCloseTo(0.2);

    const glutton = asStage({ ...createPet("Milo", T0), poopPressure: 2.5 }, "child");
    const t1 = stepEvents(glutton, 60_000, quiet);
    const t2 = stepEvents(t1.state, 60_000, quiet);
    expect(t1.events).toContain("poop");
    expect(t2.events).toContain("poop");
    expect(t2.state.poops).toBe(2);
    expect(t2.state.poopPressure).toBeCloseTo(0.5);
  });

  it("still honours the poops cap even when pressure is high", () => {
    const pet = asStage({ ...createPet("Milo", T0), poops: 8, poopPressure: 5 }, "child");
    const { state, events } = stepEvents(pet, 60_000, quiet);
    expect(events).not.toContain("poop");
    expect(state.poops).toBe(8);
  });

  it("still poops ambiently on a pet that hasn't eaten", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    expect(pet.poopPressure).toBe(0);
    const { events } = stepEvents(pet, 60_000, () => 0);
    expect(events).toContain("poop");
  });

  it("does not poop with no pressure and an unfavourable roll", () => {
    const pet = asStage(createPet("Milo", T0), "child");
    const { events } = stepEvents(pet, 60_000, quiet);
    expect(events).not.toContain("poop");
  });
});

describe("save migration", () => {
  it("backfills poopPressure on a save that predates the field", () => {
    const { poopPressure: _drop, ...legacy } = createPet("Ancient", T0);
    const migrated = migratePet(legacy as unknown as PetState);
    expect(migrated.poopPressure).toBe(0);

    const fed = feed(asStage(migrated, "child"), "carrot", T0).state;
    expect(Number.isNaN(fed.poopPressure)).toBe(false);
    expect(fed.poopPressure).toBeGreaterThan(0);
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
      hungerZeroMs: _a,
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
    expect(migrated.hungerZeroMs).toBe(0);
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
    expect(Number.isNaN(later.hungerZeroMs)).toBe(false);
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
