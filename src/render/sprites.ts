// Pixel-art sprite system. Creatures share one chunky 16×16 chibi silhouette
// recoloured per form, with a mood face + per-form accessory composited on top.
// Everything is authored as char grids; unknown chars / "." are transparent.

import type { AdultForm, Stage } from "../pet/types";

export const CELL = 16; // sprite grid is 16×16 cells

export type Palette = Record<string, string>;

const OUTLINE = "#402e3a";
const EYE = "#3a2b3f";

// Shared chibi body. B = body fill, S = shade, k = outline.
const BODY = [
  "................",
  ".....kkkkk......",
  "...kkBBBBBkk....",
  "..kBBBBBBBBBk...",
  "..kBBBBBBBBBk...",
  ".kBBBBBBBBBBBk..",
  ".kBBBBBBBBBBBk..",
  ".kBBBBBBBBBBBk..",
  ".kBBBBBBBBBBBk..",
  ".kBBBBBBBBBBBk..",
  "..kBBBBBBBBBk...",
  "..kSBBBBBBBSk...",
  "...kSSBBBSSk....",
  "....kSSSSSk.....",
  ".....kkkkk......",
  "................",
];

// Mood faces (e = eye, w = highlight). Drawn over the body.
const FACE_NEUTRAL = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "....we....we....",
  "....ee....ee....",
  "................",
  "................",
  ".......ee.......",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
];

const FACE_HAPPY = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "....ee....ee....",
  "....ee....ee....",
  "................",
  ".....e....e.....",
  "......eeee......",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
];

const FACE_SAD = [
  "................",
  "................",
  "................",
  "................",
  "...e........e...",
  "....we....we....",
  "....ee....ee....",
  "................",
  "......eeee......",
  ".....e....e.....",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
];

const FACE_SLEEP = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "....ee....ee....",
  "................",
  "..............z.",
  "............z...",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
];

// --- Per-form accessory overlays (own fixed palettes) -----------------------
const DOG_FEAT = [
  "................",
  "................",
  "................",
  ".DD..........DD.",
  ".DD..........DD.",
  ".DD..........DD.",
  ".DD..........DD.",
  "..D..........D..",
  "................",
  "................",
  ".......tt.......",
  ".......tt.......",
  "................",
  "................",
  "................",
  "................",
];

const GREMLIN_FEAT = [
  "................",
  "...G........G...",
  "..GG........GG..",
  ".GGG........GGG.",
  "................",
  "................",
  "................",
  "................",
  "................",
  ".......ww.......",
  ".......ww.......",
  "................",
  "................",
  "................",
  "................",
  "................",
];

// Big round nerdy glasses: light lens (w) with dark pupils (e), aligned to the
// face's eye positions so it reads as spectacles, not eyebrows.
const SCHOLAR_FEAT = [
  "................",
  "................",
  "................",
  "................",
  "..wwwww.wwwww...",
  "..wweew.wweew...",
  "..wweew.wweew...",
  "..wwwww.wwwww...",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
];

// Tired office creature: dark under-eye bags. A tie on a headless chibi reads
// as a tongue, so we lean on "exhausted" instead.
const OFFICE_FEAT = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "....bb....bb....",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
];

const MENACE_FEAT = [
  "................",
  ".....y.y.y......",
  ".....yyyyy......",
  "................",
  "................",
  ".........kkk....",
  ".........k.k....",
  ".........kkk....",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
  "................",
];

// The egg (its own art + palette).
export const EGG_SPRITE = [
  "................",
  "......kkkk......",
  "....kkccCCkk....",
  "...kcccccccCk...",
  "..kccooccccCk...",
  "..kccccccccCk...",
  ".kcccccccccCCk..",
  ".kccccooccccCk..",
  ".kcccccccccCCk..",
  ".kccooccccccCk..",
  ".kcccccccccCCk..",
  "..kCcccccccCk...",
  "..kCCcccccCCk...",
  "...kCCCCCCCk....",
  ".....kkkkkk.....",
  "................",
];

const EGG_PALETTE: Palette = {
  k: OUTLINE,
  c: "#f7e7c4",
  C: "#e3cb98",
  o: "#c69a6a",
};

// Body colour pairs [fill, shade] per creature key.
const BODY_COLORS: Record<string, [string, string]> = {
  generic: ["#ffd884", "#eab24a"],
  dog: ["#e8ad63", "#cf8a3f"],
  blob: ["#79c7d4", "#4fa2b0"],
  gremlin: ["#8fce76", "#5da84a"],
  scholar: ["#b6a1e2", "#8f77c6"],
  office: ["#c4c6d4", "#9a9cb0"],
  menace: ["#efa6cf", "#c977a6"],
};

const FEATURES: Record<string, { rows: string[]; palette: Palette }> = {
  dog: {
    rows: DOG_FEAT,
    palette: { D: "#a9702f", t: "#e8637a" },
  },
  gremlin: {
    rows: GREMLIN_FEAT,
    palette: { G: "#4c8f3c", w: "#ffffff" },
  },
  scholar: {
    rows: SCHOLAR_FEAT,
    palette: { e: EYE, w: "#dbe7ff" },
  },
  office: {
    rows: OFFICE_FEAT,
    palette: { b: "#6f6a80" },
  },
  menace: {
    rows: MENACE_FEAT,
    palette: { y: "#f5d572", k: OUTLINE },
  },
};

const FACE_PALETTE: Palette = { e: EYE, w: "#ffffff", z: "#9a9ab0" };

export type Mood = "neutral" | "happy" | "sad" | "sleep";

function faceFor(mood: Mood): string[] {
  switch (mood) {
    case "happy":
      return FACE_HAPPY;
    case "sad":
      return FACE_SAD;
    case "sleep":
      return FACE_SLEEP;
    default:
      return FACE_NEUTRAL;
  }
}

export interface PixelBuffer {
  w: number;
  h: number;
  data: Uint8ClampedArray; // RGBA
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Blit one char-grid over an RGBA buffer (later layers win). */
function blit(buf: PixelBuffer, rows: string[], palette: Palette): void {
  for (let y = 0; y < rows.length && y < buf.h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length && x < buf.w; x++) {
      const ch = row[x];
      if (ch === "." || ch === " ") continue;
      const color = palette[ch];
      if (!color) continue;
      const [r, g, b] = hexToRgb(color);
      const i = (y * buf.w + x) * 4;
      buf.data[i] = r;
      buf.data[i + 1] = g;
      buf.data[i + 2] = b;
      buf.data[i + 3] = 255;
    }
  }
}

/**
 * Composite a creature into a DOM-free RGBA pixel buffer: body + mood face +
 * accessory. Kept pure so it can be rendered off-screen or in tests.
 */
export function renderPixels(key: string, mood: Mood): PixelBuffer {
  const buf: PixelBuffer = { w: CELL, h: CELL, data: new Uint8ClampedArray(CELL * CELL * 4) };
  if (key === "egg") {
    blit(buf, EGG_SPRITE, EGG_PALETTE);
    return buf;
  }
  const [fill, shade] = BODY_COLORS[key] ?? BODY_COLORS.generic;
  blit(buf, BODY, { k: OUTLINE, B: fill, S: shade });
  blit(buf, faceFor(mood), FACE_PALETTE);
  const feat = FEATURES[key];
  if (feat) blit(buf, feat.rows, feat.palette);
  return buf;
}

/** The visual key for a pet at a given stage/form. */
export function creatureKey(stage: Stage, form: AdultForm | null): string {
  if (stage === "adult" && form) return form;
  if (stage === "egg") return "egg";
  return "generic";
}

/**
 * Composite a creature onto a fresh 16×16 canvas: body + mood face + accessory.
 * Returns the canvas so the scene can cache and blit it scaled.
 */
export function buildCreatureCanvas(key: string, mood: Mood): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CELL;
  canvas.height = CELL;
  const ctx = canvas.getContext("2d")!;
  const buf = renderPixels(key, mood);
  const imgData = ctx.createImageData(buf.w, buf.h);
  imgData.data.set(buf.data);
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
