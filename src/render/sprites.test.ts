import { describe, expect, it } from "vitest";
import { renderPixels, CELL } from "./sprites";
import type { PixelBuffer } from "./sprites";

/** [r, g, b, a] at a pixel. */
function px(buf: PixelBuffer, x: number, y: number): [number, number, number, number] {
  const i = (y * buf.w + x) * 4;
  return [buf.data[i], buf.data[i + 1], buf.data[i + 2], buf.data[i + 3]];
}

const NOSE: [number, number, number] = [0x6b, 0x4a, 0x2a];
const EYE: [number, number, number] = [0x3a, 0x2b, 0x3f];
const TAIL: [number, number, number] = [0xa9, 0x70, 0x2f];
const OUTLINE: [number, number, number] = [0x40, 0x2e, 0x3a];

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

describe("dog muzzle", () => {
  const dog = renderPixels("dog", "neutral");
  it("puts the nose between the eyes with a stem down to the mouth", () => {
    expect(rgb(px(dog, 7, 7))).toEqual(NOSE); // nose
    expect(rgb(px(dog, 8, 7))).toEqual(NOSE);
    expect(rgb(px(dog, 7, 8))).toEqual(NOSE); // philtrum stem
    expect(rgb(px(dog, 7, 9))).toEqual(EYE); // mood mouth below
    expect(rgb(px(dog, 8, 9))).toEqual(EYE);
  });
  it("keeps the eyes clear of the muzzle", () => {
    expect(rgb(px(dog, 5, 7))).toEqual(EYE);
    expect(rgb(px(dog, 9, 7))).toEqual(EYE);
  });
  it("completes a symmetric 工 in the neutral mood — all on col 7", () => {
    // Nose bar cols 6-8, philtrum stem col 7, mouth bar cols 6-8: three bars
    // sharing centre column 7. A 2px mouth used to sit half a pixel off.
    expect(rgb(px(dog, 6, 7))).toEqual(NOSE);
    expect(rgb(px(dog, 7, 7))).toEqual(NOSE);
    expect(rgb(px(dog, 8, 7))).toEqual(NOSE);
    expect(rgb(px(dog, 7, 8))).toEqual(NOSE);
    expect(rgb(px(dog, 6, 9))).toEqual(EYE);
    expect(rgb(px(dog, 7, 9))).toEqual(EYE);
    expect(rgb(px(dog, 8, 9))).toEqual(EYE);
    // The bar is exactly 3px — its flanking columns are not eyes.
    expect(isEye(px(dog, 5, 9))).toBe(false);
    expect(isEye(px(dog, 9, 9))).toBe(false);
  });
  it("gives happy an upturned smile clearly distinct from the neutral bar", () => {
    // Corners lift a row above the bar (cols 5/9 on row 9), mirroring the wide
    // FACE_HAPPY, with the 3px bar one row lower (cols 6-8 on row 10).
    const happy = renderPixels("dog", "happy");
    expect(rgb(px(happy, 5, 9))).toEqual(EYE);
    expect(rgb(px(happy, 9, 9))).toEqual(EYE);
    expect(rgb(px(happy, 6, 10))).toEqual(EYE);
    expect(rgb(px(happy, 7, 10))).toEqual(EYE);
    expect(rgb(px(happy, 8, 10))).toEqual(EYE);
    // Neutral has no lifted corners, so the two moods can't be confused.
    expect(isEye(px(dog, 5, 9))).toBe(false);
    expect(isEye(px(dog, 9, 9))).toBe(false);
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

describe("alt frame (dog tail up)", () => {
  const base = renderPixels("dog", "neutral");
  const alt = renderPixels("dog", "neutral", null, "alt");
  it("erases the resting tail and raises it", () => {
    expect(rgb(px(base, 13, 11))).toEqual(TAIL); // resting tail present…
    expect(px(alt, 13, 11)[3]).toBe(0); // …vacated in the alt pose
    expect(rgb(px(alt, 14, 8))).toEqual(TAIL); // raised tail up over the rump
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
