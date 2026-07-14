import { describe, expect, it } from "vitest";
import { renderPixels, CELL } from "./sprites";
import type { PixelBuffer } from "./sprites";

/** [r, g, b, a] at a pixel. */
function px(buf: PixelBuffer, x: number, y: number): [number, number, number, number] {
  const i = (y * buf.w + x) * 4;
  return [buf.data[i], buf.data[i + 1], buf.data[i + 2], buf.data[i + 3]];
}

const EYE: [number, number, number] = [0x3a, 0x2b, 0x3f];
const NOSE: [number, number, number] = [0x2b, 0x20, 0x30];
const TAIL: [number, number, number] = [0x4a, 0x4a, 0x56];
const OUTLINE: [number, number, number] = [0x40, 0x2e, 0x3a];
const DOG_FILL: [number, number, number] = [0x7a, 0x7a, 0x8a];
const DOG_PATCH: [number, number, number] = [0xee, 0xf0, 0xf2];

const rgb = (p: [number, number, number, number]) => p.slice(0, 3);
const isOutline = (p: [number, number, number, number]) =>
  p[3] !== 0 && p[0] === OUTLINE[0] && p[1] === OUTLINE[1] && p[2] === OUTLINE[2];
const isEye = (p: [number, number, number, number]) =>
  p[3] !== 0 && p[0] === EYE[0] && p[1] === EYE[1] && p[2] === EYE[2];

const BODY_KEYS = [
  "baby", "child", "teen", "dog", "blob", "gremlin",
  "scholar", "office", "menace", "ghost", "humcube", "carrot",
] as const;
// Every body whose face is drawn from the 5-wide "small" grids.
const SMALL_FACE_KEYS = [
  "baby", "child", "teen", "dog", "blob", "gremlin",
  "scholar", "menace", "ghost", "humcube", "carrot",
] as const;
const MOODS = ["neutral", "happy", "sad", "sleep"] as const;

describe("dog chest patch", () => {
  const dog = renderPixels("dog", "neutral");
  it("leaves a gap row of coat colour between the mouth and the patch", () => {
    expect(rgb(px(dog, 7, 10))).toEqual(DOG_FILL); // gap row
    expect(rgb(px(dog, 7, 11))).toEqual(DOG_PATCH); // patch starts one row down
  });
  it("keeps coat visible down both sides of the patch", () => {
    expect(rgb(px(dog, 4, 12))).toEqual(DOG_FILL);
    expect(rgb(px(dog, 9, 12))).toEqual(DOG_FILL);
  });
  it("keeps the eye row clear of any marking", () => {
    expect(rgb(px(dog, 5, 6))).toEqual(EYE);
    expect(rgb(px(dog, 9, 6))).toEqual(EYE);
    expect(rgb(px(dog, 6, 6))).not.toEqual(DOG_PATCH);
    expect(rgb(px(dog, 7, 6))).not.toEqual(DOG_PATCH);
    expect(rgb(px(dog, 8, 6))).not.toEqual(DOG_PATCH);
  });
});

describe("dog snout", () => {
  it("draws nose, philtrum, and mouth on the neutral face", () => {
    const dog = renderPixels("dog", "neutral");
    for (const x of [6, 7, 8]) expect(rgb(px(dog, x, 7))).toEqual(NOSE); // nose bar
    expect(rgb(px(dog, 7, 8))).toEqual(EYE); // philtrum
    for (const x of [6, 7, 8]) expect(rgb(px(dog, x, 9))).toEqual(EYE); // mouth
  });

  it("keeps the snout identical across every mood", () => {
    const moods = ["neutral", "happy", "sad", "sleep"] as const;
    for (const mood of moods) {
      const buf = renderPixels("dog", mood);
      for (const x of [6, 7, 8]) {
        expect(rgb(px(buf, x, 7)), `${mood} nose`).toEqual(NOSE);
      }
      expect(rgb(px(buf, 7, 8)), `${mood} philtrum`).toEqual(EYE);
    }
  });

  it("anchors the snout while the eyes glance and blink", () => {
    const base = renderPixels("dog", "neutral");
    for (const frame of ["glanceL", "glanceR", "blink"] as const) {
      const f = renderPixels("dog", "neutral", null, frame);
      for (const y of [7, 8, 9]) {
        for (let x = 0; x < CELL; x++) {
          expect(px(f, x, y), `${frame} row ${y}`).toEqual(px(base, x, y));
        }
      }
    }
  });
});

describe("blink frame", () => {
  it("closes small-face eyes but keeps the mood mouth", () => {
    const base = renderPixels("blob", "neutral");
    const blink = renderPixels("blob", "neutral", null, "blink");
    // blob face at (5, 8): open eyes are 1px at cols 5/9; closed are 2px pairs.
    expect(rgb(px(base, 5, 8))).toEqual(EYE);
    expect(rgb(px(base, 6, 8))).not.toEqual(EYE);
    expect(rgb(px(blink, 6, 8))).toEqual(EYE);
    // mouth (row faceDy+2 = 10, 3px bar cols 6-8) identical in both frames
    expect(px(blink, 7, 10)).toEqual(px(base, 7, 10));
    expect(px(blink, 8, 10)).toEqual(px(base, 8, 10));
  });
  it("closes standard-face eyes to a single row", () => {
    const base = renderPixels("office", "neutral");
    const blink = renderPixels("office", "neutral", null, "blink");
    // office face at (0, 1): open eyes fill rows 6-7; closed keep only row 7.
    expect(rgb(px(base, 4, 6))).toEqual(EYE);
    expect(rgb(px(blink, 4, 6))).not.toEqual(EYE);
    expect(rgb(px(blink, 4, 7))).toEqual(EYE);
  });
});

describe("glance frames", () => {
  it("shifts the gaze without moving the mouth", () => {
    const base = renderPixels("blob", "neutral");
    const left = renderPixels("blob", "neutral", null, "glanceL");
    const right = renderPixels("blob", "neutral", null, "glanceR");
    expect(rgb(px(left, 4, 8))).toEqual(EYE); // eyes slid one px left
    expect(rgb(px(right, 6, 8))).toEqual(EYE); // …and right
    expect(px(left, 7, 10)).toEqual(px(base, 7, 10)); // mouth anchored
    expect(px(right, 7, 10)).toEqual(px(base, 7, 10));
  });

  // The eye colour and the outline are near-identical, so a gaze that slides
  // onto the silhouette edge vanishes and eats the k. A glance must never paint
  // over an outline pixel — the shift is clamped toward 0 until it clears.
  it("never overwrites an outline pixel, for every body and mood", () => {
    for (const key of BODY_KEYS) {
      for (const mood of MOODS) {
        const base = renderPixels(key, mood);
        for (const frame of ["glanceL", "glanceR"] as const) {
          const g = renderPixels(key, mood, null, frame);
          for (let y = 0; y < CELL; y++) {
            for (let x = 0; x < CELL; x++) {
              if (isOutline(px(base, x, y))) {
                expect(isOutline(px(g, x, y))).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  // A glance must never go silent — the outline clamp used to zero the shift on
  // cramped bodies (the teen could never move its gaze for a whole life stage).
  // Even when the pair can't travel, bunching the eyes still moves the gaze, so
  // every body + mood must differ from base in both directions.
  it("visibly moves the gaze in both directions, for every body and mood", () => {
    for (const key of BODY_KEYS) {
      for (const mood of MOODS) {
        const base = renderPixels(key, mood);
        for (const frame of ["glanceL", "glanceR"] as const) {
          const g = renderPixels(key, mood, null, frame);
          expect([...g.data], `${key}/${mood}/${frame} is identical to base`).not.toEqual([
            ...base.data,
          ]);
        }
      }
    }
  });
});

describe("alt frame (the dog's tail, flipped)", () => {
  const base = renderPixels("dog", "neutral");
  const alt = renderPixels("dog", "neutral", null, "alt");
  // The wag inverts the same nub end over end about the hinge where it meets
  // the body, rather than swapping in a second, bigger tail. Guards the flick
  // against creeping back into a fin.
  it("hinges on the body: the two pixels where the tail attaches never move", () => {
    for (const y of [11, 12]) {
      expect(px(alt, 12, y), `the hinge moved at (12,${y})`).toEqual(px(base, 12, y));
      expect(px(base, 12, y)[3]).toBe(255); // and it's really there to begin with
    }
  });

  it("swings the tip to the other side of the hinge", () => {
    expect(rgb(px(base, 13, 11))).toEqual(TAIL); // tip rides high at rest…
    expect(px(alt, 13, 11)[3]).not.toBe(0); // …and drops a row on the wag,
    expect(rgb(px(alt, 13, 12))).toEqual(TAIL); // landing under the hinge line
    expect(px(base, 13, 10)[3]).toBe(255); // its outline cap follows it over:
    expect(px(alt, 13, 10)[3]).toBe(0); // vacated above…
    expect(px(alt, 13, 13)[3]).toBe(255); // …and drawn below
  });

  it("never reaches above the rump — no fin on the dog's back", () => {
    for (let y = 0; y < 10; y++) {
      for (let x = 12; x < CELL; x++) {
        expect(px(alt, x, y), `alt paints (${x},${y}), above the tail`).toEqual(px(base, x, y));
      }
    }
  });

  it("is the same size tail, not a bigger one", () => {
    const lit = (b: ReturnType<typeof renderPixels>) => {
      let n = 0;
      for (let y = 0; y < CELL; y++) for (let x = 12; x < CELL; x++) if (px(b, x, y)[3] > 0) n++;
      return n;
    };
    expect(lit(alt)).toBe(lit(base));
  });
  it("leaves the body untouched", () => {
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < 11; x++) {
        expect(px(alt, x, y)).toEqual(px(base, x, y));
      }
    }
  });
});

describe("small face symmetry", () => {
  // The bug that shipped: a 2px mouth can't centre in the 5-wide grid, so the
  // resting neutral face read half a pixel off. Pin every mood's mouth centred
  // under the eyes — measured by horizontal centre of mass over EYE pixels.
  const centreX = (pts: { x: number; y: number }[]) =>
    pts.reduce((s, p) => s + p.x, 0) / pts.length;

  it("centres each mood's mouth under the eyes, for every small-faced body", () => {
    for (const key of SMALL_FACE_KEYS) {
      for (const mood of MOODS) {
        const buf = renderPixels(key, mood);
        const eyePx: { x: number; y: number }[] = [];
        for (let y = 0; y < CELL; y++) {
          for (let x = 0; x < CELL; x++) {
            if (isEye(px(buf, x, y))) eyePx.push({ x, y });
          }
        }
        // Eyes are the topmost EYE row; the mouth is everything below it.
        const top = Math.min(...eyePx.map((p) => p.y));
        const eyes = eyePx.filter((p) => p.y === top);
        const mouth = eyePx.filter((p) => p.y > top);
        expect(mouth.length, `${key}/${mood} has no mouth`).toBeGreaterThan(0);
        expect(
          centreX(mouth),
          `${key}/${mood} mouth centre ${centreX(mouth)} != eye centre ${centreX(eyes)}`,
        ).toBeCloseTo(centreX(eyes), 10);
      }
    }
  });
});

describe("egg", () => {
  it("has no animation frames — every frame is the egg", () => {
    const base = renderPixels("egg", "neutral");
    const blink = renderPixels("egg", "neutral", null, "blink");
    expect(blink.data).toEqual(base.data);
  });
});
