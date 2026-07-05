// Pixel-art sprite system. Every life stage and adult form has its own 16×16
// silhouette (no more one-blob-fits-all): baby is a pebble, child a sprout,
// teen a lanky mess, and each adult reads distinctly even before recolour.
// Mood faces are shared grids ("standard" for wide faces, "small" for narrow
// bodies) blitted at a per-body offset; face-covering accessories (glasses,
// eye bags) come last.

import type { AdultForm, Stage } from "../pet/types";

export const CELL = 16; // sprite grid is 16×16 cells

export type Palette = Record<string, string>;

const OUTLINE = "#402e3a";
const EYE = "#3a2b3f";

// --- Mood faces ---------------------------------------------------------------
// Standard faces: eyes at cols 4-5 / 10-11, rows 5-6. Solid button eyes — the
// old white "highlight" pixel made everyone look dead-eyed; the cute newer
// sprites (ghost, cube) are all solid dots, so the wide faces match now.
const FACE_NEUTRAL = [
  "................",
  "................",
  "................",
  "................",
  "................",
  "....ee....ee....",
  "....ee....ee....",
  "................",
  "................",
  ".......ee.......",
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
];

const FACE_SAD = [
  "................",
  "................",
  "................",
  "................",
  "...e........e...",
  "....ee....ee....",
  "....ee....ee....",
  "................",
  "......eeee......",
  ".....e....e.....",
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
];

// Small faces for narrow bodies (5 wide). Blitted at each body's face offset.
const SMALL_NEUTRAL = ["e...e", ".....", "..ee."];
const SMALL_HAPPY = ["e...e", ".....", ".eee."];
const SMALL_SAD = ["e...e", ".....", ".e.e.", "..e.."];
const SMALL_SLEEP = ["ee.ee", ".....", "..e.."];

const FACE_PALETTE: Palette = { e: EYE, z: "#9a9ab0" };

export type Mood = "neutral" | "happy" | "sad" | "sleep";

type FaceKind = "standard" | "small";

function faceFor(kind: FaceKind, mood: Mood): string[] {
  if (kind === "standard") {
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
  switch (mood) {
    case "happy":
      return SMALL_HAPPY;
    case "sad":
      return SMALL_SAD;
    case "sleep":
      return SMALL_SLEEP;
    default:
      return SMALL_NEUTRAL;
  }
}

// --- Bodies -------------------------------------------------------------------
// B = fill, S = shade, k = outline; extra letters are per-body accents.
interface BodyDef {
  rows: string[];
  /** Accent colours beyond B/S/k. */
  extra?: Palette;
  fill: string;
  shade: string;
  face: FaceKind;
  faceDx: number;
  faceDy: number;
  /** Drawn after the face (glasses, eye bags…). */
  overlay?: { rows: string[]; palette: Palette };
}

const BABY: BodyDef = {
  rows: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "......kkkk......",
    ".....kBBBBk.....",
    "....kBBBBBBk....",
    "....kBBBBBBk....",
    "....kBBBBBBk....",
    "....kBBBBBBk....",
    "....kSBBBBSk....",
    ".....kSSSSk.....",
    "......kkkk......",
    "................",
  ],
  fill: "#ffd884",
  shade: "#eab24a",
  face: "small",
  faceDx: 6,
  faceDy: 9,
};

const CHILD: BodyDef = {
  rows: [
    "................",
    ".......L........",
    "......LGL.......",
    ".......G........",
    ".....kkkkk......",
    "....kBBBBBk.....",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "...kSBBBBBSk....",
    "....kSSSSSk.....",
    ".....kkkkk......",
    "................",
    "................",
  ],
  // A proper little leafy sprout (two leaves + a bud on a green stem), not the
  // old one-pixel nub that read as a hat.
  extra: { L: "#8fd06a", G: "#5fa347" },
  fill: "#ffcf70",
  shade: "#e8a94a",
  face: "small",
  faceDx: 5,
  faceDy: 7,
};

const TEEN: BodyDef = {
  rows: [
    "................",
    "....k...k.......",
    ".....k.k.k......",
    ".....kkkkk......",
    "....kSSBBBk.....",
    "....kBBBBBk.....",
    "....kBBBBBk.....",
    "....kBBBBBk.....",
    "....kBBBBBk.....",
    "....kBBBBBk.....",
    "....kBBBBBk.....",
    "....kBBBBBk.....",
    "....kSBBBSk.....",
    ".....kSSSk......",
    "......kkk.......",
    "................",
  ],
  fill: "#b9a8d8", // a rental body in an awkward colour
  shade: "#927cba",
  face: "small",
  faceDx: 5,
  faceDy: 6,
};

const DOG: BodyDef = {
  rows: [
    "................",
    "..kk......kk....",
    ".kDDk....kDDk...",
    ".kDDk....kDDk...",
    ".kkBBkkkkBBkk...",
    "..kBBBBBBBBk....",
    ".kBBBBBBBBBBk...",
    ".kBBBBBBBBBBk...",
    ".kBBBBBBBBBBk...",
    ".kBBBBBBBBBBk...",
    "..kBBBBBBBBk.kk.",
    "..kBBBBBBBBkkDk.",
    "..kSBBBBBBSkkk..",
    "...kSSSSSSk.....",
    "....kkkkkk......",
    "................",
  ],
  extra: { D: "#a9702f" }, // floppy ears + tail
  fill: "#e8ad63",
  shade: "#cf8a3f",
  face: "small",
  faceDx: 5,
  faceDy: 7,
  overlay: {
    rows: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      ".......nn.......",
      "................",
      "................",
      "................",
    ],
    palette: { n: "#6b4a2a" }, // puppy nose, right above the mouth
  },
};

const BLOB: BodyDef = {
  rows: [
    "................",
    "................",
    "................",
    "................",
    "......kkkk......",
    "....kkBBBBkk....",
    "...kBBBBBBBBk...",
    "..kBBBBBBBBBBk..",
    "..kBBBBBBBBBBk..",
    ".kBBBBBBBBBBBBk.",
    ".kBBBBBBBBBBBBk.",
    "kBBBBBBBBBBBBBBk",
    "kSBBBBBBBBBBBBSk",
    "kSSBBBBBBBBBBSSk",
    ".kkkkkkkkkkkkkk.",
    "................",
  ],
  fill: "#79c7d4",
  shade: "#4fa2b0",
  face: "small",
  faceDx: 5,
  faceDy: 8,
};

const GREMLIN: BodyDef = {
  rows: [
    "................",
    ".k..........k...",
    ".kGk........kGk.",
    ".kGGk......kGGk.",
    "..kGGkkkkkkGGk..",
    "...kGBBBBBBGk...",
    "....kBBBBBBk....",
    "....kBBBBBBk....",
    "....kBBBBBBk....",
    "....kBBBBBBk....",
    "....kBBBBBBk....",
    "....kBBBBBBk....",
    "....kSBBBBSk....",
    ".....kSSSSk.....",
    "......kkkk......",
    "................",
  ],
  extra: { G: "#4c8f3c" }, // big pointy ears
  fill: "#8fce76",
  shade: "#5da84a",
  face: "small",
  faceDx: 5,
  faceDy: 7,
  overlay: {
    rows: ["......w.w......"],
    palette: { w: "#ffffff" }, // tiny teeth, offset below the mouth
  },
};

const SCHOLAR: BodyDef = {
  rows: [
    "................",
    "....kkkkkkk.....",
    "...kBBBBBBBk....",
    "..kBBBBBBBBBk...",
    "..kBBBBBBBBBk...",
    "..kBBBBBBBBBk...",
    "..kBBBBBBBBBk...",
    "..kBBBBBBBBBk...",
    "...kBBBBBBBk....",
    "....kBBBBBk.....",
    "....kBBBBBk.....",
    "....kBBBBBk.....",
    "....kSBBBSk.....",
    ".....kSSSk......",
    "......kkk.......",
    "................",
  ],
  fill: "#b6a1e2",
  shade: "#8f77c6",
  face: "standard",
  faceDx: 0,
  faceDy: 0,
  overlay: {
    // Wire-rim glasses around the standard face's eyes. Hollow lenses: the
    // filled pale blocks used to read as huge bulging eyeballs, and they
    // stamped open eyes over every mood.
    rows: [
      "................",
      "................",
      "................",
      "................",
      "...wwww..wwww...",
      "...w..wwww..w...",
      "...w..w..w..w...",
      "...wwww..wwww...",
      "................",
      "................",
      "................",
      "................",
    ],
    palette: { w: "#dbe7ff" },
  },
};

const OFFICE: BodyDef = {
  rows: [
    "................",
    "................",
    "................",
    "...kkkkkkkkk....",
    "..kBBBBBBBBBk...",
    "..kBBBBBBBBBk...",
    "..kBBBBBBBBBk...",
    "..kBBBBBBBBBk...",
    "..kBBBBBBBBBk...",
    "..kBBTBBBBBBk...",
    "..kBBTBBBBBBk...",
    "..kBBBBBBBBBk...",
    "..kSBBBBBBBSk...",
    "..kSSSSSSSSSk...",
    "...kkkkkkkkk....",
    "................",
  ],
  extra: { T: "#6f6a80" }, // a sad little tie
  fill: "#c4c6d4",
  shade: "#9a9cb0",
  face: "standard",
  faceDx: 0,
  faceDy: 1,
  overlay: {
    rows: [
      "................",
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
    ],
    palette: { b: "#6f6a80" }, // the under-eye bags of the working world
  },
};

const MENACE: BodyDef = {
  rows: [
    "................",
    ".....y.y.y......",
    ".....yyyyy......",
    ".....kkkkk......",
    "....kBBBBBk.....",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "..wkBBBBBBBkw...",
    "..wwkSBBBSkww...",
    "...wkSSSSSkw....",
    "....kkkkkk......",
    "................",
    "................",
  ],
  extra: { y: "#f5d572", w: "#fdf3e0" }, // crown + frilled collar
  fill: "#efa6cf",
  shade: "#c977a6",
  face: "small",
  faceDx: 5,
  faceDy: 6,
};

const GHOST: BodyDef = {
  rows: [
    "................",
    ".....kkkkk......",
    "....kBBBBBk.....",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "...kBBBBBBBk....",
    "...kBkBBBkBk....",
    "....k.kBk.k.....",
    "......k.k.......",
    "................",
    "................",
  ],
  fill: "#dce8f4",
  shade: "#b0c4dc",
  face: "small",
  faceDx: 5,
  faceDy: 5,
};

// A translucent crystal cube-being — a true isometric cube (hexagonal
// silhouette: vertical left/right edges, points top and bottom). The bright
// glassy top face (T) dips to a point in the middle — the near-top corner — so
// the shadowed left face (fill B) and lit right face (S) meet in a "V" notch
// beneath it, which is what reads as a cube rather than a flat diamond. Cool
// glass-edge outline, a white specular glint (g), and a pale front-edge
// highlight (i) down the near vertical edge. Its face rides the front faces,
// one eye per side.
const HUMCUBE: BodyDef = {
  rows: [
    "................",
    ".......kk.......",
    ".....kTTTTk.....",
    "...kTgTTTTTTk...",
    ".kTTgTTTTTTTTTk.",
    ".kBTTTTTTTTTTSk.",
    ".kBBBTTTTTTSSSk.",
    ".kBBBBBTTSSSSSk.",
    ".kBBBBBBiSSSSSk.",
    ".kBBBBBBiSSSSSk.",
    ".kBBBBBBiSSSSSk.",
    "..kBBBBBiSSSSk..",
    "....kBBBiSSSk...",
    "......kBSk......",
    "................",
    "................",
  ],
  // Crystalline ice palette: fill = shadowed left face, shade = lit right face.
  // The three tones (top brightest, left darkest, right mid) are what read as a
  // solid cube seen on the diagonal. k overrides the default near-black outline
  // with a cool glass edge (extra is spread after k in renderPixels, so wins).
  extra: { k: "#3f6470", T: "#e2f6fc", g: "#ffffff", i: "#eafaff" },
  fill: "#6bb6cd",
  shade: "#a3d9ea",
  face: "small",
  faceDx: 5,
  faceDy: 8,
};

const BODIES: Record<string, BodyDef> = {
  baby: BABY,
  child: CHILD,
  teen: TEEN,
  dog: DOG,
  blob: BLOB,
  gremlin: GREMLIN,
  scholar: SCHOLAR,
  office: OFFICE,
  menace: MENACE,
  ghost: GHOST,
  humcube: HUMCUBE,
};

// --- Teen "audition" accents --------------------------------------------------
// A teen is still figuring out what it'll become. When it's leaning toward an
// adult form, a small tell leaks through — a crown nub, glasses, floppy ears —
// a slight clue to the eventual look, never a spoiler. Blitted over the teen
// body+face (see renderPixels). Full-frame 16-wide grids like standard overlays.
type Accent = { rows: string[]; palette: Palette };

const TEEN_ACCENTS: Partial<Record<AdultForm, Accent>> = {
  dog: {
    rows: [
      "................",
      "................",
      "................",
      "................",
      "..DD.....DD.....",
      "..DD.....DD.....",
      "...D.....D......",
    ],
    palette: { D: "#a9702f" }, // floppy ears starting to droop
  },
  gremlin: {
    rows: [
      "....G...G.......",
      "....G...G.......",
      "...GG...GG......",
    ],
    palette: { G: "#4c8f3c" }, // ears going pointy
  },
  scholar: {
    rows: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "....www.www.....",
      "....w.w.w.w.....",
      "....www.www.....",
    ],
    palette: { w: "#dbe7ff" }, // studious little glasses (eyes show through)
  },
  menace: {
    rows: [
      "....y.y.y.......",
      "....yyyyy.......",
    ],
    palette: { y: "#f5d572" }, // a crown, obviously
  },
  office: {
    rows: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "......T.........",
      ".....TTT........",
      "......T.........",
    ],
    palette: { T: "#6f6a80" }, // the tie forms early
  },
  blob: {
    rows: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      ".........d......",
      ".........d......",
    ],
    palette: { d: "#79c7d4" }, // a single dramatic tear
  },
  ghost: {
    rows: [
      ".......w.w......",
      "........w.......",
    ],
    palette: { w: "#dce8f4" }, // a faint wisp, already half-elsewhere
  },
  humcube: {
    rows: [
      "..ccc...........",
      "..c.c...........",
      "..ccc...........",
    ],
    palette: { c: "#9a8fd0" }, // a tiny hollow cube, quietly orbiting its head
  },
};

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

/** Blit one char-grid over an RGBA buffer at an offset (later layers win). */
function blit(
  buf: PixelBuffer,
  rows: string[],
  palette: Palette,
  dx = 0,
  dy = 0,
): void {
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    const by = y + dy;
    if (by < 0 || by >= buf.h) continue;
    for (let x = 0; x < row.length; x++) {
      const bx = x + dx;
      if (bx < 0 || bx >= buf.w) continue;
      const ch = row[x];
      if (ch === "." || ch === " ") continue;
      const color = palette[ch];
      if (!color) continue;
      const [r, g, b] = hexToRgb(color);
      const i = (by * buf.w + bx) * 4;
      buf.data[i] = r;
      buf.data[i + 1] = g;
      buf.data[i + 2] = b;
      buf.data[i + 3] = 255;
    }
  }
}

/**
 * Composite a creature into a DOM-free RGBA pixel buffer: body + mood face +
 * overlay accessory. Kept pure so it can be rendered off-screen or in tests.
 */
export function renderPixels(
  key: string,
  mood: Mood,
  variant?: AdultForm | null,
): PixelBuffer {
  const buf: PixelBuffer = { w: CELL, h: CELL, data: new Uint8ClampedArray(CELL * CELL * 4) };
  if (key === "egg") {
    blit(buf, EGG_SPRITE, EGG_PALETTE);
    return buf;
  }
  const body = BODIES[key] ?? BODIES.baby;
  blit(buf, body.rows, { k: OUTLINE, B: body.fill, S: body.shade, ...body.extra });
  const facePalette =
    body.face === "small" ? { ...FACE_PALETTE, e: EYE } : FACE_PALETTE;
  blit(buf, faceFor(body.face, mood), facePalette, body.faceDx, body.faceDy);
  if (body.overlay) {
    // Overlays for small-faced bodies sit relative to the face; standard ones
    // are authored full-frame.
    const isSmallOverlay = body.overlay.rows.length <= 2;
    blit(
      buf,
      body.overlay.rows,
      body.overlay.palette,
      isSmallOverlay ? 0 : 0,
      isSmallOverlay ? body.faceDy + 3 : 0,
    );
  }
  // Teen audition tell — a slight hint at the adult it's leaning toward.
  if (key === "teen" && variant) {
    const accent = TEEN_ACCENTS[variant];
    if (accent) blit(buf, accent.rows, accent.palette);
  }
  return buf;
}

/** The visual key for a pet at a given stage/form. */
export function creatureKey(stage: Stage, form: AdultForm | null): string {
  if (stage === "adult" && form) return form;
  if (stage === "egg") return "egg";
  return stage; // baby / child / teen each have their own body now
}

/**
 * Composite a creature onto a fresh 16×16 canvas: body + mood face + accessory.
 * Returns the canvas so the scene can cache and blit it scaled.
 */
export function buildCreatureCanvas(
  key: string,
  mood: Mood,
  variant?: AdultForm | null,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CELL;
  canvas.height = CELL;
  const ctx = canvas.getContext("2d")!;
  const buf = renderPixels(key, mood, variant);
  const imgData = ctx.createImageData(buf.w, buf.h);
  imgData.data.set(buf.data);
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
