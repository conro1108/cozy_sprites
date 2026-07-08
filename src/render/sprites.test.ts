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

const rgb = (p: [number, number, number, number]) => p.slice(0, 3);

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
});

describe("blink frame", () => {
  it("closes small-face eyes but keeps the mood mouth", () => {
    const base = renderPixels("blob", "neutral");
    const blink = renderPixels("blob", "neutral", null, "blink");
    // blob face at (5, 8): open eyes are 1px at cols 5/9; closed are 2px pairs.
    expect(rgb(px(base, 5, 8))).toEqual(EYE);
    expect(rgb(px(base, 6, 8))).not.toEqual(EYE);
    expect(rgb(px(blink, 6, 8))).toEqual(EYE);
    // mouth (row faceDy+2 = 10, cols 7-8) identical in both frames
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

describe("egg", () => {
  it("has no animation frames — every frame is the egg", () => {
    const base = renderPixels("egg", "neutral");
    const blink = renderPixels("egg", "neutral", null, "blink");
    expect(blink.data).toEqual(base.data);
  });
});
