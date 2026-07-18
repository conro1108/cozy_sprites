import { describe, expect, it } from "vitest";
import { determineAdultForm, explainForms, scoreForms } from "./evolution";
import { ADULTS, ADULT_ORDER } from "./roster";
import { emptyHidden } from "./types";
import type { AdultForm, HiddenStats } from "./types";

function hidden(overrides: Partial<HiddenStats>): HiddenStats {
  return { ...emptyHidden(), ...overrides };
}

describe("determineAdultForm", () => {
  // A fixed rng of 0 pins tie-breaks to the top scorer *and* skips the 1%
  // cosmic override (which only fires at the very top of the roll), so these
  // upbringing tests stay deterministic.
  const NO_LUCK = () => 0;

  it("defaults to the office creature from a blank slate", () => {
    expect(determineAdultForm(emptyHidden(), 100, NO_LUCK)).toBe("office");
  });

  it("produces a dog from lots of fetch and good care", () => {
    const h = hidden({
      gamePlays: { ...emptyHidden().gamePlays, fetch: 10 },
      careMistakes: 0,
    });
    expect(determineAdultForm(h, 90, NO_LUCK)).toBe("dog");
  });

  it("produces a blob from heavy cake consumption", () => {
    const h = hidden({ cakeEaten: 12, careMistakes: 3 });
    expect(determineAdultForm(h, 70, NO_LUCK)).toBe("blob");
  });

  it("lets a devoted fetch player sneak a few cakes and stay a dog", () => {
    // Five lifetime cakes used to hand the blob 7.5 points and steal an
    // otherwise-perfect dog run; diminishing returns keep devotion ahead.
    const h = hidden({
      gamePlays: { ...emptyHidden().gamePlays, fetch: 10 },
      careMistakes: 1,
      cakeEaten: 5,
    });
    expect(determineAdultForm(h, 85, NO_LUCK)).toBe("dog");
  });

  it("keeps the moderate-everything upbringing on the office default", () => {
    // A couple of cakes and a couple of slips is moderation, not a cake habit —
    // blob's mild-neglect bonus must not fire without ≥3 cakes, or the blob
    // steals the exact play style the office creature is for.
    const h = hidden({ cakeEaten: 2, careMistakes: 2, discipline: 8 });
    expect(determineAdultForm(h, 75, NO_LUCK)).toBe("office");
  });

  it("still fires blob's drama bonus once the cake habit is real", () => {
    const withHabit = explainForms(hidden({ cakeEaten: 4, careMistakes: 2 }), 70).blob.terms[2];
    expect(withHabit.active).toBe(true);
    expect(withHabit.value).toBe(2);
    const noHabit = explainForms(hidden({ cakeEaten: 3, careMistakes: 2 }), 70).blob.terms[2];
    expect(noHabit.active).toBe(false);
    expect(noHabit.value).toBe(0);
  });

  it("produces a gremlin from sustained care mistakes and no discipline", () => {
    const h = hidden({ careMistakes: 8, discipline: 0 });
    expect(determineAdultForm(h, 50, NO_LUCK)).toBe("gremlin");
  });

  it("treats the cube as neutral: a cube habit alone lands the office default", () => {
    const h = hidden({ cubeEaten: 6 });
    expect(determineAdultForm(h, 90, () => 0)).toBe("office");
  });

  it("keeps the office default under a light slip or two, cube and all", () => {
    const h = hidden({ cubeEaten: 3, careMistakes: 1, discipline: 0 });
    expect(determineAdultForm(h, 85, () => 0)).toBe("office");
  });

  it("does not push a cube-fed pet to gremlin without real neglect", () => {
    const h = hidden({ cubeEaten: 5, careMistakes: 2, discipline: 0 });
    expect(determineAdultForm(h, 80, () => 0)).not.toBe("gremlin");
  });

  it("produces a scholar from high discipline and no cake", () => {
    const h = hidden({
      discipline: 80,
      cakeEaten: 0,
      gamePlays: { ...emptyHidden().gamePlays, higherlower: 8 },
    });
    expect(determineAdultForm(h, 90, NO_LUCK)).toBe("scholar");
  });

  it("produces the secret ghost from dominant night care", () => {
    const h = hidden({ nightCare: 12 });
    expect(determineAdultForm(h, 80, NO_LUCK)).toBe("ghost");
  });

  it("produces the secret humming cube from a devoted, calm cube diet + its game", () => {
    const h = hidden({
      cubeEaten: 10,
      careMistakes: 0,
      gamePlays: { ...emptyHidden().gamePlays, cubehum: 8 },
    });
    expect(determineAdultForm(h, 90, NO_LUCK)).toBe("humcube");
  });

  it("keeps chaotic cube abuse on the gremlin path, not the humming cube", () => {
    // Same cube intake, but messy and undisciplined — this is the gremlin, and
    // the point of the rebalance is that cube alone no longer decides.
    const h = hidden({ cubeEaten: 15, careMistakes: 8, discipline: 0 });
    expect(determineAdultForm(h, 50, () => 0)).toBe("gremlin");
  });

  it("does not summon the humming cube from a casual cube taste", () => {
    const h = hidden({ cubeEaten: 2 });
    expect(determineAdultForm(h, 80, () => 0)).not.toBe("humcube");
  });

  it("a cube-game favorite with only a few plays does not open the hum path", () => {
    // Liking the cube game isn't devotion — the secret needs six plays.
    const h = hidden({
      cubeEaten: 5,
      gamePlays: { ...emptyHidden().gamePlays, cubehum: 4 },
    });
    expect(determineAdultForm(h, 90, () => 0)).not.toBe("humcube");
  });

  it("does not produce a ghost from casual night care", () => {
    // rng()=0 → deterministic top scorer, so a near-tie can't flake the test.
    const h = hidden({ nightCare: 2 });
    expect(determineAdultForm(h, 80, () => 0)).not.toBe("ghost");
  });

  it("produces the secret carrot from a perfectly pure carrot diet", () => {
    const h = hidden({ carrotEaten: 6, mealsEaten: 6 });
    expect(determineAdultForm(h, 90, NO_LUCK)).toBe("carrot");
  });

  it("outranks a disciplined vegetable-fed scholar when the diet is pure", () => {
    const h = hidden({
      carrotEaten: 8,
      mealsEaten: 8,
      discipline: 60,
      gamePlays: { ...emptyHidden().gamePlays, higherlower: 8 },
    });
    expect(determineAdultForm(h, 90, () => 0)).toBe("carrot");
  });

  it("one lapse breaks the carrot vow — no partial credit", () => {
    const h = hidden({ carrotEaten: 11, mealsEaten: 12 }); // one burger. ONE.
    expect(determineAdultForm(h, 90, () => 0)).not.toBe("carrot");
  });

  it("a technically-pure but barely-fed pet is not blessed", () => {
    const h = hidden({ carrotEaten: 2, mealsEaten: 2 });
    expect(determineAdultForm(h, 90, () => 0)).not.toBe("carrot");
  });

  it("ignores a 'favorite game' that is only tied for most-played", () => {
    // One play of everything is not a fetch enthusiasm — this used to count
    // whichever game iterated first and bias every run the same way.
    const plays = { ...emptyHidden().gamePlays };
    (Object.keys(plays) as (keyof typeof plays)[]).forEach((g) => (plays[g] = 2));
    const h = hidden({ gamePlays: plays });
    expect(determineAdultForm(h, 90, () => 0)).toBe("office");
  });

  it("breaks near-ties randomly instead of always the same way", () => {
    const h = emptyHidden(); // office baseline, several forms near zero
    const seen = new Set<string>();
    for (let r = 0; r < 10; r++) {
      seen.add(determineAdultForm(h, 100, () => r / 10));
    }
    // A blank slate is a clear office win — but rng must select within
    // candidates, so a single candidate always returns office.
    expect(seen).toEqual(new Set(["office"]));
  });

  it("hands any non-gremlin a 1% cosmic upset, no matter how it was raised", () => {
    // A blank-slate office pet — but the roll lands in the top 1%, so the sky
    // keeps it instead. Care never entered into it.
    expect(determineAdultForm(emptyHidden(), 100, () => 0.995)).toBe("cosmos");

    // Even a picture-perfect scholar upbringing is overtaken by the luck roll.
    const scholarly = hidden({
      discipline: 80,
      gamePlays: { ...emptyHidden().gamePlays, higherlower: 8 },
    });
    expect(determineAdultForm(scholarly, 90, () => 0.999)).toBe("cosmos");
  });

  it("never turns a would-be gremlin into the cosmos", () => {
    const h = hidden({ careMistakes: 8, discipline: 0 });
    // Top-of-the-roll luck, but gremlins are exempt from the sky's collection.
    expect(determineAdultForm(h, 50, () => 0.999)).toBe("gremlin");
  });

  it("leaves an ordinary roll well short of the cosmic 1%", () => {
    expect(determineAdultForm(emptyHidden(), 100, () => 0.5)).toBe("office");
  });

  it("a pet named Poppy is unconditionally the loyal dog thing", () => {
    // Blank-slate upbringing would otherwise be the office default.
    expect(determineAdultForm(emptyHidden(), 100, NO_LUCK, "Poppy")).toBe("dog");
    // Case-insensitive, and beats even a scholar-perfect upbringing.
    const scholarly = hidden({
      discipline: 80,
      cakeEaten: 0,
      gamePlays: { ...emptyHidden().gamePlays, higherlower: 8 },
    });
    expect(determineAdultForm(scholarly, 90, NO_LUCK, "poppy")).toBe("dog");
    // Overrides even the cosmic 1% luck roll.
    expect(determineAdultForm(emptyHidden(), 100, () => 0.999, "POPPY")).toBe("dog");
    // Stray whitespace in the name doesn't defeat the match.
    expect(determineAdultForm(emptyHidden(), 100, NO_LUCK, " Poppy ")).toBe("dog");
    // A different name doesn't trigger it.
    expect(determineAdultForm(emptyHidden(), 100, NO_LUCK, "Poppyseed")).not.toBe("dog");
  });

  describe("the software mole (easter egg)", () => {
    it("is summoned by the name Connor, and only by the name Connor", () => {
      expect(determineAdultForm(emptyHidden(), 100, NO_LUCK, "Connor")).toBe("mole");
      // Not case-sensitive, and stray whitespace doesn't defeat the match.
      expect(determineAdultForm(emptyHidden(), 100, NO_LUCK, "connor")).toBe("mole");
      expect(determineAdultForm(emptyHidden(), 100, NO_LUCK, "CONNOR")).toBe("mole");
      expect(determineAdultForm(emptyHidden(), 100, NO_LUCK, "  cOnNoR  ")).toBe("mole");
      // A name that merely contains it is not it.
      expect(determineAdultForm(emptyHidden(), 100, NO_LUCK, "Connors")).not.toBe("mole");
      expect(determineAdultForm(emptyHidden(), 100, NO_LUCK, "O'Connor")).not.toBe("mole");
    });

    it("beats every upbringing, and the cosmic luck roll can't take it away", () => {
      // A carrot-perfect diet is the strongest score in the game — still a mole.
      const devout = hidden({ mealsEaten: 10, carrotEaten: 10 });
      expect(determineAdultForm(devout, 90, NO_LUCK, "connor")).toBe("mole");
      // Top-of-the-roll luck would otherwise hand this pet to the night sky.
      expect(determineAdultForm(emptyHidden(), 100, () => 0.999, "connor")).toBe("mole");
    });

    it("is unreachable without the name — no upbringing ever scores it", () => {
      // It sits at zero in the score table and must never win a near-tie.
      expect(scoreForms(emptyHidden(), 100).mole).toBe(0);
      const chaotic = hidden({ careMistakes: 9, discipline: 0, cakeEaten: 6 });
      expect(scoreForms(chaotic, 20).mole).toBe(0);
      // Sweep the luck roll across its whole range with no name: never a mole.
      for (let r = 0; r < 1; r += 0.01) {
        expect(determineAdultForm(emptyHidden(), 100, () => r)).not.toBe("mole");
      }
    });

    it("never appears in the collection, even once raised", () => {
      // The whole point: no tile, no "???" slot, no gap in the grid to notice.
      expect(ADULTS.mole.hidden).toBe(true);
      // Every other form stays listable — this flag is the mole's alone.
      const listable = ADULT_ORDER.filter((f) => !ADULTS[f].hidden);
      expect(listable).not.toContain("mole");
      expect(listable).toHaveLength(ADULT_ORDER.length - 1);
    });
  });
});

describe("explainForms", () => {
  // The breakdown is the single source of truth; scoreForms is its totals.
  // Lock that so a term added to one but not reflected in the other can't slip
  // through. Sweep a spread of upbringings, including the gated paths.
  it("every form's terms sum to its scoreForms total", () => {
    const cases: HiddenStats[] = [
      emptyHidden(),
      hidden({ cakeEaten: 5, careMistakes: 3 }),
      hidden({ gamePlays: { ...emptyHidden().gamePlays, fetch: 9 }, careMistakes: 1 }),
      hidden({ discipline: 60, gamePlays: { ...emptyHidden().gamePlays, higherlower: 7 } }),
      hidden({ nightCare: 10 }),
      hidden({ cubeEaten: 4, gamePlays: { ...emptyHidden().gamePlays, cubehum: 6 } }),
      hidden({ mealsEaten: 6, carrotEaten: 6 }),
      hidden({ careMistakes: 8, discipline: 0, cakeEaten: 2, nightCare: 3 }),
    ];
    for (const h of cases) {
      for (const health of [20, 70, 100]) {
        const scores = scoreForms(h, health);
        const breakdown = explainForms(h, health);
        for (const form of Object.keys(scores) as AdultForm[]) {
          const summed = breakdown[form].terms.reduce((s, t) => s + t.value, 0);
          expect(breakdown[form].total).toBeCloseTo(scores[form], 10);
          expect(summed).toBeCloseTo(scores[form], 10);
        }
      }
    }
  });

  it("marks a term active exactly when it's contributing", () => {
    // Fetch as the clear top game fires the dog's first term; without it, the
    // term is listed but inactive and worth zero.
    const fetchy = hidden({ gamePlays: { ...emptyHidden().gamePlays, fetch: 5 } });
    const dogFetch = explainForms(fetchy, 90).dog.terms[0];
    expect(dogFetch.active).toBe(true);
    expect(dogFetch.value).toBe(4);
    const blank = explainForms(emptyHidden(), 90).dog.terms[0];
    expect(blank.active).toBe(false);
    expect(blank.value).toBe(0);
  });

  it("carries the name/luck overrides as notes, not score terms", () => {
    const b = explainForms(emptyHidden(), 100);
    expect(b.cosmos.terms).toHaveLength(0);
    expect(b.cosmos.notes.join(" ")).toMatch(/1%/);
    expect(b.mole.notes.join(" ")).toMatch(/Connor/);
    expect(b.dog.notes.join(" ")).toMatch(/Poppy/);
  });
});
