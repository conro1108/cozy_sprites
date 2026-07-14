// Pixel-art sprite system. Every life stage and adult form has its own 16×16
// silhouette (no more one-blob-fits-all): baby is a pebble, child a sprout,
// teen a lanky mess, and each adult reads distinctly even before recolour.
// Mood faces are shared grids ("standard" for wide faces, "small" for narrow
// bodies) blitted at a per-body offset. Accessories (glasses, eye bags) go on
// before the face so mood eyes always win — a sleeping scholar shows its
// closed "- -" eyes across the lenses instead of the rims clipping them.

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
// Neutral and happy share the same centred 3px mouth — a 2px bar can't centre
// in an odd-width grid, so it used to read half a pixel off.
const SMALL_NEUTRAL = ["e...e", ".....", ".eee."];
const SMALL_HAPPY = SMALL_NEUTRAL;
const SMALL_SAD = ["e...e", ".....", ".e.e.", "..e.."];
const SMALL_SLEEP = ["ee.ee", ".....", "..e.."];

// The dog's face: the one creature with real anatomy — nose bar, philtrum,
// mouth (drawn from the owner's sketch). The snout rows stay identical across
// moods so only the eyes and mouth emote; the face sits one row higher than
// the other small faces to make room.
const DOG_NEUTRAL = ["e...e", ".nnn.", "..e..", ".eee."];
const DOG_HAPPY = DOG_NEUTRAL;
const DOG_SAD = ["e...e", ".nnn.", "..e..", ".e.e.", "..e.."];
const DOG_SLEEP = ["ee.ee", ".nnn.", "..e..", ".eee."];

// The mole: eyes and a nose, no mouth. A mood-mouth drawn across a snout reads
// as a lolling tongue, not an expression, so the mole doesn't get one — what
// little it emotes, it emotes through its eyes (heavy lids when miserable).
// The nose lives in the face grid rather than the body so it travels with the
// gaze: the whole snout swings when the mole looks to one side.
// A dark nose tucked right under the glasses, sitting on a pink muzzle that
// bulges below it and tapers off. (`n` is the shared dark nose colour the dog
// already uses.) Nose-on-top is the whole trick: run it the other way — pink
// first, dark tip at the bottom — and the snout stops reading as a face and
// starts reading as a beak.
const MOLE_SNOUT = [".nnn.", "ppppp", ".ppp."];
const MOLE_NEUTRAL = [".....", "e...e", ".....", ...MOLE_SNOUT];
const MOLE_HAPPY = MOLE_NEUTRAL;
// Hooded, not wide: a 1px lid directly over a 1px eye just makes a tall bar,
// which reads as alarm. A 2px lid drooping *inward* over the eye below is what
// reads as miserable.
const MOLE_SAD = ["ee.ee", "e...e", ".....", ...MOLE_SNOUT];
const MOLE_SLEEP = [".....", "ee.ee", ".....", ...MOLE_SNOUT];

const FACE_PALETTE: Palette = { e: EYE, z: "#9a9ab0", n: "#2b2030" };

export type Mood = "neutral" | "happy" | "sad" | "sleep";

type FaceKind = "standard" | "small" | "dog" | "mole";

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
  if (kind === "dog") {
    switch (mood) {
      case "happy":
        return DOG_HAPPY;
      case "sad":
        return DOG_SAD;
      case "sleep":
        return DOG_SLEEP;
      default:
        return DOG_NEUTRAL;
    }
  }
  if (kind === "mole") {
    switch (mood) {
      case "happy":
        return MOLE_HAPPY;
      case "sad":
        return MOLE_SAD;
      case "sleep":
        return MOLE_SLEEP;
      default:
        return MOLE_NEUTRAL;
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
  /** Extra colours available to the face grid (the mole's nose is part of its
   *  face, not its body, so it can travel with the gaze). */
  faceExtra?: Palette;
  /** Drawn after the face (glasses, eye bags…). */
  overlay?: { rows: string[]; palette: Palette };
  /** Full-frame patch for the "alt" pose frame (the dog's tail, flicked). Blitted
   *  over the body; "ERASE" palette entries remove pixels the pose vacates. */
  alt?: { rows: string[]; palette: Palette };
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
    "..k........k....",
    ".kDk......kDk...",
    "kDDDk....kDDDk..",
    ".kkBBkkkkBBkk...",
    "..kBBBBBBBBk....",
    ".kBBBBBBBBBBk...",
    ".kBBBBBBBBBBk...",
    ".kBBBBBBBBBBk...",
    ".kBBBBBBBBBBk...",
    "..kBBBBBBBBk.kk.",
    "..kBBWWWWBBkkDk.",
    "..kSBWWWWBSkkk..",
    "...kSSWWSSk.....",
    "....kkkkkk......",
    "................",
  ],
  extra: { D: "#4a4a56", W: "#eef0f2" }, // pointy ears + tail; white chest patch
  fill: "#7a7a8a",
  shade: "#5a5a68",
  face: "dog",
  faceDx: 5,
  faceDy: 6,
  // The wag frame. Not a different tail — the SAME nub, mirrored top to bottom
  // about its middle row, so it cocks up instead of hanging down. The fill (D)
  // sits on the mirror line and never moves; only the outline swaps corners,
  // which is the whole flick. Anything bigger (a tail that extends, or streams
  // up while trotting) reads as the dog growing a fin.
  alt: {
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
      "................",
      "............kkx.",
      "................",
      "............x.k.",
    ],
    palette: { k: OUTLINE, x: "ERASE" },
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
  face: "small",
  faceDx: 5,
  faceDy: 4,
  overlay: {
    // Little wire-rim glasses around the dot eyes, hollow so every mood's
    // eyes show through — same style the scholar-leaning teen wears.
    rows: [
      "................",
      "................",
      "................",
      "....www.www.....",
      "....w.w.w.w.....",
      "....www.www.....",
      "................",
      "................",
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

// The Blessed Carrot — dietary purity made flesh. A plump taper balancing
// improbably on its tip, with a proud spray of greens on top.
const CARROT: BodyDef = {
  rows: [
    "......L...L.....",
    "......LL.LL.....",
    ".......GGG......",
    "....kkkkkkkk....",
    "...kSBBBBBBBk...",
    "...kSBBBBBBBk...",
    "...kSBBBBBBBk...",
    "....kSBBBBBk....",
    "....kSBBBBBk....",
    ".....kSBBBk.....",
    ".....kSBBBk.....",
    "......kSBk......",
    "......kSBk......",
    ".......kk.......",
    "................",
    "................",
  ],
  extra: { L: "#8fd06a", G: "#5fa347" }, // the greens it was so loyal to
  fill: "#f08c3a",
  shade: "#d06a24",
  face: "small",
  faceDx: 5,
  faceDy: 6,
};

// The Little Cosmos — a pet-shaped piece of the night sky: a swirling nebula of
// indigo (I), amethyst (U) and rose (N), freckled with white stars (w). The
// engine's face rides in the swirl; the whole thing shimmers in the scene (see
// scene.ts). Kept mid-toned so the shared dark eyes still read on the swirl.
const COSMOS: BodyDef = {
  rows: [
    "................",
    "................",
    ".....kkkkkk.....",
    "...kkIUUUUIkk...",
    "..kIUUNNNNUUIk..",
    ".kIUNNwNNUUNIk..",
    ".kIUNUUUwNNUUk..",
    ".kIwUNUUUNUUwk..",
    ".kIUNUUwUNUNIk..",
    "..kIUNNNUUwIIk..",
    "..kIIUwNNUUIk...",
    "...kkIUUNUIk....",
    "...kSIUUUISk....",
    "....kSSSSSk.....",
    ".....kkkkkk.....",
    "................",
  ],
  extra: {
    I: "#3c3478", // deep indigo
    U: "#7a52ac", // amethyst
    N: "#d46eb6", // rose nebula
    w: "#ffffff", // stars
    k: "#241d47", // night outline
  },
  fill: "#7a52ac",
  shade: "#3c3478",
  face: "small",
  faceDx: 6,
  faceDy: 7,
};

// The Software Mole (easter egg) — a velvety taupe loaf with no visible ears,
// a pink snout (p) that the shared mood-mouth lands right on top of, and two
// pale digging claws (c) it uses, exclusively, for typing. The wire-rim glasses
// are an overlay, hollow like the scholar's so every mood's eyes show through.
const MOLE: BodyDef = {
  rows: [
    "................",
    "................",
    ".....kkkkkk.....",
    "...kkBBBBBBkk...",
    "..kBBBBBBBBBBk..",
    "..kBBBBBBBBBBk..",
    "..kBBBBBBBBBBk..",
    "..kBBBBBBBBBBk..",
    "..kBBBBBBBBBBk..",
    "..kBBBBBBBBBBk..",
    "..kBBBBBBBBBBk..",
    ".kBBBBBBBBBBBBk.",
    ".kSBBBBBBBBBBSk.",
    ".kcccSSSSSSccck.",
    "..kkkkkkkkkkkk..",
    "................",
  ],
  extra: { c: "#f0dfc6" },
  // The snout is drawn by the face grid, not the body — see MOLE_SNOUT.
  faceExtra: { p: "#d7a9a4" },
  fill: "#8a7466",
  shade: "#6b584c",
  face: "mole",
  faceDx: 5,
  faceDy: 4,
  overlay: {
    // Plain filled lenses, no frame. They must be *filled*, not hollow rings:
    // glanceL/glanceR slide the eyes one column (to 4/6 and 8/10), and a ring
    // would leave the vacated centre showing bare fur through the lens.
    rows: [
      "................",
      "................",
      "................",
      "................",
      "....www.www.....",
      "....www.www.....",
      "....www.www.....",
    ],
    palette: { w: "#dbe7ff" },
  },
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
  carrot: CARROT,
  cosmos: COSMOS,
  mole: MOLE,
};

// --- Teen "audition" accents --------------------------------------------------
// A teen is still figuring out what it'll become. When it's leaning toward an
// adult form, a small tell leaks through — a wagging tail, a blobbier butt, a
// fleck of crown — just a few pixels, never a spoiler. Blitted over the teen
// body (before the face — see renderPixels). Full-frame 16-wide grids.
type Accent = { rows: string[]; palette: Palette };

const TEEN_ACCENTS: Partial<Record<AdultForm, Accent>> = {
  dog: {
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
      "............D...",
      "...........DD...",
    ],
    palette: { D: "#4a4a56" }, // a little tail, already wagging
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
      "................",
      "................",
      "................",
      "................",
      "................",
      "...kSBBBBBSk....",
      "....kSSSSSk.....",
      ".....kkkkk......",
    ],
    // A slightly wider, blobbier butt — in the teen's own colours, the
    // silhouette does the telling.
    palette: { k: OUTLINE, B: "#b9a8d8", S: "#927cba" },
  },
  gremlin: {
    rows: [
      "................",
      "................",
      ".....G...G......",
    ],
    palette: { G: "#4c8f3c" }, // the first hint of pointy ears
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
      "......y.y.......",
      "......yyy.......",
    ],
    palette: { y: "#f5d572" }, // a fleck of crown, obviously
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
      ".....b...b......",
    ],
    palette: { b: "#6f6a80" }, // under-eye shadows setting in early
  },
  ghost: {
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
      "................",
      "................",
      "................",
      "................",
      "......w.w.......",
      ".....w.w.w......",
    ],
    palette: { w: "#dce8f4" }, // the hem going wavy, already half-elsewhere
  },
  humcube: {
    rows: [
      "................",
      "..gc............",
      "..cc............",
    ],
    palette: { c: "#9a8fd0", g: "#cfc8ec" }, // a tiny cube, quietly orbiting
  },
  carrot: {
    rows: [
      "......L.........",
      "......LL........",
    ],
    palette: { L: "#8fd06a" }, // something green taking root in the hair
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

/** Blit one char-grid over an RGBA buffer at an offset (later layers win).
 *  A palette entry of "ERASE" clears the pixel instead — lets an alt-frame
 *  patch remove pixels (a resting tail) as well as add them. */
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
      const i = (by * buf.w + bx) * 4;
      if (color === "ERASE") {
        buf.data[i] = 0;
        buf.data[i + 1] = 0;
        buf.data[i + 2] = 0;
        buf.data[i + 3] = 0;
        continue;
      }
      const [r, g, b] = hexToRgb(color);
      buf.data[i] = r;
      buf.data[i + 1] = g;
      buf.data[i + 2] = b;
      buf.data[i + 3] = 255;
    }
  }
}

/** The animation micro-frames every creature has. `base` is the resting pose;
 *  `blink` closes the eyes; `glanceL`/`glanceR` slide the gaze one pixel;
 *  `peek` cracks one eye open (only meaningful over the sleep mood — a poked
 *  sleeper); `alt` is a per-body pose patch (the dog's tail, flipped mid-wag) and
 *  falls back to `base` for bodies without one. */
export type SpriteFrame = "base" | "blink" | "glanceL" | "glanceR" | "peek" | "alt";
export const SPRITE_FRAMES: SpriteFrame[] = [
  "base",
  "blink",
  "glanceL",
  "glanceR",
  "peek",
  "alt",
];

/** First row of the face grid that belongs to the mouth (not the gaze) —
 *  everything above it shifts on a glance / closes on a blink. The dog's
 *  snout (nose/philtrum/mouth) is all below the split, so it stays anchored
 *  while the eyes glance and blink. The mole is the opposite: it has no mouth
 *  at all, and its whole face — nose included — rides above the split, so the
 *  snout swings across with the gaze instead of sitting there while the eyes
 *  slide out from under it. */
function eyeSplit(kind: FaceKind): number {
  if (kind === "standard") return 8;
  if (kind === "mole") return MOLE_NEUTRAL.length;
  return 1;
}

/**
 * Composite a creature into a DOM-free RGBA pixel buffer: body + mood face +
 * overlay accessory. Kept pure so it can be rendered off-screen or in tests.
 */
export function renderPixels(
  key: string,
  mood: Mood,
  variant?: AdultForm | null,
  frame: SpriteFrame = "base",
): PixelBuffer {
  const buf: PixelBuffer = { w: CELL, h: CELL, data: new Uint8ClampedArray(CELL * CELL * 4) };
  if (key === "egg") {
    blit(buf, EGG_SPRITE, EGG_PALETTE);
    return buf;
  }
  const body = BODIES[key] ?? BODIES.baby;
  blit(buf, body.rows, { k: OUTLINE, B: body.fill, S: body.shade, ...body.extra });
  if (frame === "alt" && body.alt) blit(buf, body.alt.rows, body.alt.palette);
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
  // Face goes last so mood eyes/mouths always read over accessories.
  const facePalette = {
    ...(body.face === "small" ? { ...FACE_PALETTE, e: EYE } : FACE_PALETTE),
    ...body.faceExtra,
  };
  let rows = faceFor(body.face, mood);
  const split = eyeSplit(body.face);
  if (frame === "blink") {
    // Borrow the sleep face's closed eyes, keep the current mood's mouth.
    const sleep = faceFor(body.face, "sleep");
    rows = rows.map((r, i) => (i < split ? (sleep[i] ?? r) : r));
  } else if (frame === "peek") {
    // A poke mid-sleep: splice the neutral face's open eye onto the near
    // (left) half of each eye row, leaving the far eye shut.
    const neutral = faceFor(body.face, "neutral");
    rows = rows.map((r, i) => {
      if (i >= split) return r;
      const open = neutral[i] ?? r;
      const mid = Math.ceil(r.length / 2);
      return open.slice(0, mid) + r.slice(mid);
    });
  }
  const shift = frame === "glanceL" ? -1 : frame === "glanceR" ? 1 : 0;
  if (shift === 0) {
    blit(buf, rows, facePalette, body.faceDx, body.faceDy);
  } else {
    // Slide the gaze in the glance direction — but the 5-wide face puts an eye at
    // each extreme column, so on a narrow body an eye can be flush to the edge.
    // Eye colour and outline are near-identical: a gaze pixel landing on the
    // outline vanishes into the edge and eats the k. So each eye moves only if
    // its target is clear; a blocked eye holds while its partner slides. The
    // pair bunches, and even a gaze that can't travel still reads as a glance
    // because the spacing shifts — no eye ever overwrites an outline.
    const shifted = rows.slice(0, split).map((r, gy) => {
      const brow = body.rows[body.faceDy + gy] ?? "";
      const cells = Array.from({ length: CELL }, () => ".");
      for (let x = 0; x < r.length; x++) {
        const ch = r[x];
        if (ch === "." || ch === " ") continue;
        const from = body.faceDx + x;
        const to = from + shift;
        const col = brow[to] === "k" ? from : to;
        if (col >= 0 && col < CELL) cells[col] = ch;
      }
      return cells.join("");
    });
    blit(buf, shifted, facePalette, 0, body.faceDy);
    // The mouth stays anchored to the body.
    blit(buf, rows.slice(split), facePalette, body.faceDx, body.faceDy + split);
  }
  return buf;
}

/** All animation frames for a creature, keyed by SpriteFrame. Bodies without
 *  an alt pose reuse their base canvas there. The egg never blinks. */
export function buildCreatureFrames(
  key: string,
  mood: Mood,
  variant?: AdultForm | null,
): Record<SpriteFrame, HTMLCanvasElement> {
  const base = buildCreatureCanvas(key, mood, variant, "base");
  if (key === "egg") {
    return { base, blink: base, glanceL: base, glanceR: base, peek: base, alt: base };
  }
  const body = BODIES[key] ?? BODIES.baby;
  return {
    base,
    blink: buildCreatureCanvas(key, mood, variant, "blink"),
    glanceL: buildCreatureCanvas(key, mood, variant, "glanceL"),
    glanceR: buildCreatureCanvas(key, mood, variant, "glanceR"),
    peek: buildCreatureCanvas(key, mood, variant, "peek"),
    alt: body.alt ? buildCreatureCanvas(key, mood, variant, "alt") : base,
  };
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
  frame: SpriteFrame = "base",
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = CELL;
  canvas.height = CELL;
  const ctx = canvas.getContext("2d")!;
  const buf = renderPixels(key, mood, variant, frame);
  const imgData = ctx.createImageData(buf.w, buf.h);
  imgData.data.set(buf.data);
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}
