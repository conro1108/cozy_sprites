// Pixel-art UI icons — replaces every emoji in the interface. Authored as
// 12×12 char grids with tiny fixed palettes, rendered once to data URLs and
// cached, so they can be used both as elements and inside innerHTML templates.

export type IconName =
  | "status"
  | "burger"
  | "play"
  | "broom"
  | "bandage"
  | "bulb"
  | "bulboff"
  | "moon"
  | "heart"
  | "heartgold"
  | "hearthalf"
  | "heartempty"
  | "smiley"
  | "medcross"
  | "cake"
  | "carrot"
  | "salad"
  | "cube"
  | "soup"
  | "dice"
  | "dice1"
  | "dice2"
  | "dice3"
  | "dice4"
  | "dice6"
  | "ball"
  | "magnifying"
  | "question"
  | "pill"
  | "hand"
  | "barn"
  | "book"
  | "disk"
  | "egg"
  | "grave"
  | "star"
  | "sparkle"
  | "alert"
  | "speechdots"
  | "thermometer"
  | "rock"
  | "paper"
  | "scissors"
  | "fist"
  | "whistle";

interface IconDef {
  rows: string[];
  palette: Record<string, string>;
}

const K = "#402e3a"; // shared outline ink

const ICONS: Record<IconName, IconDef> = {
  status: {
    // clipboard — text lines in soft brown so they read as writing, not bars
    rows: [
      "....kkkkk...",
      "..kkkccckkk.",
      "..kpppppppk.",
      "..kplllllpk.",
      "..kpppppppk.",
      "..kplllllpk.",
      "..kpppppppk.",
      "..kplllllpk.",
      "..kpppppppk.",
      "..kpppppppk.",
      "..kkkkkkkkk.",
      "............",
    ],
    palette: { k: K, p: "#fdf3e0", c: "#c9a96a", l: "#c9b896" },
  },
  burger: {
    // Sized to fill the cell like the heart glyph, so it reads the same size as
    // the care-meter hearts sitting beside it in the HUD.
    rows: [
      "............",
      "...kkkkkk...",
      "..kbbbbbbk..",
      ".kbsbbbsbbk.",
      "kbbbbbbbbbbk",
      "kLLLLLLLLLLk",
      "kttttttttttk",
      "kmmmmmmmmmmk",
      "kbbbbbbbbbbk",
      ".kbbbbbbbbk.",
      "..kkkkkkkk..",
      "............",
    ],
    palette: { k: K, b: "#eeb060", s: "#fbe6b6", L: "#7fc45e", t: "#e05c48", m: "#8a5030" },
  },
  soup: {
    // a warm bowl: steam curls over a golden broth with a veg fleck
    rows: [
      "...t..t.....",
      "....t..t....",
      "...t..t.....",
      "............",
      ".kkkkkkkkkk.",
      "kssssnsssssk",
      "kbbbbbbbbbbk",
      "kbbbbbbbbbbk",
      ".kbbbbbbbbk.",
      "..kbbbbbbk..",
      "...kkkkkk...",
      "............",
    ],
    palette: { k: K, t: "#e8e0d0", s: "#f0b840", n: "#e05c48", b: "#c05848" },
  },
  play: {
    // a little gamepad: d-pad left, button diamond right
    rows: [
      "............",
      "............",
      ".kkkkkkkkkk.",
      "kggggggggggk",
      "kggdggggrggk",
      "kgdddggrgrgk",
      "kggdggggrggk",
      "kggggggggggk",
      ".kkkkkkkkkk.",
      "............",
      "............",
      "............",
    ],
    palette: { k: K, g: "#ddd0b0", d: "#5c4a38", r: "#e05c48" },
  },
  broom: {
    // a dustpan: narrow handle with a grab-hole, flaring straight into a
    // wide domed pan with a bright flat lip along the bottom edge.
    rows: [
      "....kkkk....",
      "....kbbk....",
      "....k..k....",
      "....kbbk....",
      "...kbbbbk...",
      "..kbbbbbbk..",
      ".kbbbbbbbbk.",
      ".kbbbbbbbbk.",
      ".kwwwwwwwwk.",
      ".kkkkkkkkkk.",
      "............",
      "............",
    ],
    palette: { k: K, b: "#b9bcc3", w: "#eef0f4" },
  },
  bandage: {
    // a proper plaster: tan wings, pale pad, dotted texture
    rows: [
      "............",
      "............",
      "............",
      "..kkkkkkkk..",
      ".kbbppppbbk.",
      ".kbbpddpbbk.",
      ".kbbpddpbbk.",
      ".kbbppppbbk.",
      "..kkkkkkkk..",
      "............",
      "............",
      "............",
    ],
    palette: { k: K, b: "#f0c896", p: "#fdf3e0", d: "#e8b088" },
  },
  bulb: {
    rows: [
      "....kkkk....",
      "...kyyyyk...",
      "..kyyyyyyk..",
      "..kyywyyyk..",
      "..kyywyyyk..",
      "..kyyyyyyk..",
      "...kyyyyk...",
      "....kyyk....",
      "....kggk....",
      "....kggk....",
      ".....kk.....",
      "............",
    ],
    palette: { k: K, y: "#ffd884", w: "#fff7dc", g: "#9a9cb0" },
  },
  // Same silhouette as bulb, but a cold dead-glass grey instead of a glow —
  // the light-switch icon when the lights are off.
  bulboff: {
    rows: [
      "....kkkk....",
      "...kddddk...",
      "..kddddddk..",
      "..kddedddk..",
      "..kddedddk..",
      "..kddddddk..",
      "...kddddk...",
      "....kddk....",
      "....kggk....",
      "....kggk....",
      ".....kk.....",
      "............",
    ],
    palette: { k: K, d: "#c3c5d2", e: "#a7aabb", g: "#7d7f92" },
  },
  moon: {
    rows: [
      "............",
      "....kkkk....",
      "...kmmmmk...",
      "..kmmkkkk...",
      ".kmmk.......",
      ".kmmk...w...",
      ".kmmk.......",
      ".kmmk.....w.",
      "..kmmkkkk...",
      "...kmmmmk...",
      "....kkkk....",
      "............",
    ],
    palette: { k: K, m: "#f3edd0", w: "#fffef0" },
  },
  heart: {
    rows: [
      "............",
      "..kk....kk..",
      ".krrk..krrk.",
      "krwrrkkrrrrk",
      "krrrrrrrrrrk",
      "krrrrrrrrrrk",
      ".krrrrrrrrk.",
      "..krrrrrrk..",
      "...krrrrk...",
      "....krrk....",
      ".....kk.....",
      "............",
    ],
    palette: { k: K, r: "#ff5c7a", w: "#ffc2cf" },
  },
  heartgold: {
    rows: [
      "............",
      "..kk....kk..",
      ".krrk..krrk.",
      "krwrrkkrrrrk",
      "krrrrrrrrrrk",
      "krrrrrrrrrrk",
      ".krrrrrrrrk.",
      "..krrrrrrk..",
      "...krrrrk...",
      "....krrk....",
      ".....kk.....",
      "............",
    ],
    palette: { k: K, r: "#f0b840", w: "#ffe9b0" },
  },
  // Half-full heart for the care meters: left lobe pink, right lobe hollow, so a
  // half tick reads as a clean split rather than a vaguely-drained glyph.
  hearthalf: {
    rows: [
      "............",
      "..kk....kk..",
      ".krrk..keek.",
      "krwrrkkeeeek",
      "krrrrreeeeek",
      "krrrrreeeeek",
      ".krrrreeeek.",
      "..krrreeek..",
      "...krreek...",
      "....krek....",
      ".....kk.....",
      "............",
    ],
    palette: { k: K, r: "#ff5c7a", w: "#ffc2cf", e: "#d9c3a3" },
  },
  heartempty: {
    rows: [
      "............",
      "..kk....kk..",
      ".keek..keek.",
      "keeeekkeeeek",
      "keeeeeeeeeek",
      "keeeeeeeeeek",
      ".keeeeeeeek.",
      "..keeeeeek..",
      "...keeeek...",
      "....keek....",
      ".....kk.....",
      "............",
    ],
    palette: { k: K, e: "#d9c3a3" },
  },
  // A round grin for the happiness meter — friendlier than a second heart.
  // Sized to fill the cell like the heart glyph so it matches the hearts beside
  // it in the HUD.
  smiley: {
    rows: [
      "............",
      "...kkkkkk...",
      "..kyyyyyyk..",
      ".kyyyyyyyyk.",
      "kyykyyyykyyk",
      "kyyyyyyyyyyk",
      "kyyyyyyyyyyk",
      "kykyyyyyykyk",
      ".kykkkkkkyk.",
      "..kyyyyyyk..",
      "...kkkkkk...",
      "............",
    ],
    palette: { k: K, y: "#f0b840" },
  },
  // A first-aid cross for the health meter — cream box, dark outline, red plus.
  // Sized to fill the cell like the heart glyph, with clipped corners, so it
  // carries the same visual weight as the hearts beside it in the HUD.
  medcross: {
    rows: [
      "............",
      ".kkkkkkkkkk.",
      "kwwwwrrwwwwk",
      "kwwwwrrwwwwk",
      "kwwwwrrwwwwk",
      "kwrrrrrrrrwk",
      "kwrrrrrrrrwk",
      "kwwwwrrwwwwk",
      "kwwwwrrwwwwk",
      "kwwwwrrwwwwk",
      ".kkkkkkkkkk.",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0", r: "#e05c48" },
  },
  cake: {
    rows: [
      ".....c......",
      ".....f......",
      "....kkkk....",
      "...kppppk...",
      "..kppppppk..",
      "..kwwwwwwk..",
      "..kssssssk..",
      "..kwwwwwwk..",
      "..kssssssk..",
      "..kkkkkkkk..",
      "............",
      "............",
    ],
    palette: { k: K, p: "#f2a0bc", w: "#fdf3e0", s: "#e8b088", c: "#ffd884", f: "#e05c48" },
  },
  carrot: {
    rows: [
      "...g.g.g....",
      "...ggggg....",
      "....ggg.....",
      "...kkkkk....",
      "...koook....",
      "...kowok....",
      "...koook....",
      "....kok.....",
      "....kok.....",
      ".....k......",
      "............",
      "............",
    ],
    palette: { k: K, o: "#f08030", w: "#ffb066", g: "#5aa85a" },
  },
  salad: {
    rows: [
      "............",
      "............",
      "..g.gg.g....",
      ".gggrgogg...",
      "..ggggrg....",
      "kkkkkkkkkk..",
      "kbbbbbbbbk..",
      "kbbbbbbbbk..",
      ".kbbbbbbk...",
      "..kkkkkk....",
      "............",
      "............",
    ],
    palette: { k: K, b: "#e07a4a", g: "#5aa85a", r: "#e05c48", o: "#b06bb0" },
  },
  cube: {
    // A box in three-quarter view: a flat square front face, a lighter top face
    // slanting up-right, and a darker side face — so it reads as a solid cube,
    // not a gem. F = front, T = top, R = right side.
    rows: [
      "............",
      "....kkkkkkkk",
      "...kTTTTTTkk",
      "..kTTTTTTkRk",
      ".kkkkkkkkRRk",
      ".kFFFFFFkRRk",
      ".kFFFFFFkRRk",
      ".kFFFFFFkRRk",
      ".kFFFFFFkRRk",
      ".kFFFFFFkRk.",
      ".kFFFFFFkk..",
      ".kkkkkkkk...",
    ],
    palette: { k: K, T: "#d6f2fa", F: "#a3ddec", R: "#6fb8cc" },
  },
  dice: {
    rows: [
      "............",
      "..kkkkkkkk..",
      ".kwwwwwwwwk.",
      ".kwpwwwwpwk.",
      ".kwwwwwwwwk.",
      ".kwwwppwwwk.",
      ".kwwwppwwwk.",
      ".kwwwwwwwwk.",
      ".kwpwwwwpwk.",
      ".kwwwwwwwwk.",
      "..kkkkkkkk..",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0", p: "#402e3a" },
  },
  // Extra die faces the name-reroll button flashes through mid-tumble.
  dice2: {
    rows: [
      "............",
      "..kkkkkkkk..",
      ".kwwwwwwwwk.",
      ".kwppwwwwwk.",
      ".kwppwwwwwk.",
      ".kwwwwwwwwk.",
      ".kwwwwwwwwk.",
      ".kwwwwwppwk.",
      ".kwwwwwppwk.",
      ".kwwwwwwwwk.",
      "..kkkkkkkk..",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0", p: "#402e3a" },
  },
  dice6: {
    rows: [
      "............",
      "..kkkkkkkk..",
      ".kwwwwwwwwk.",
      ".kwpwwwwpwk.",
      ".kwwwwwwwwk.",
      ".kwpwwwwpwk.",
      ".kwwwwwwwwk.",
      ".kwpwwwwpwk.",
      ".kwwwwwwwwk.",
      ".kwwwwwwwwk.",
      "..kkkkkkkk..",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0", p: "#402e3a" },
  },
  dice1: {
    rows: [
      "............",
      "..kkkkkkkk..",
      ".kwwwwwwwwk.",
      ".kwwwwwwwwk.",
      ".kwwwwwwwwk.",
      ".kwwwppwwwk.",
      ".kwwwppwwwk.",
      ".kwwwwwwwwk.",
      ".kwwwwwwwwk.",
      ".kwwwwwwwwk.",
      "..kkkkkkkk..",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0", p: "#402e3a" },
  },
  dice3: {
    rows: [
      "............",
      "..kkkkkkkk..",
      ".kwwwwwwwwk.",
      ".kwppwwwwwk.",
      ".kwppwwwwwk.",
      ".kwwwppwwwk.",
      ".kwwwppwwwk.",
      ".kwwwwwppwk.",
      ".kwwwwwppwk.",
      ".kwwwwwwwwk.",
      "..kkkkkkkk..",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0", p: "#402e3a" },
  },
  dice4: {
    rows: [
      "............",
      "..kkkkkkkk..",
      ".kwwwwwwwwk.",
      ".kwppwwppwk.",
      ".kwppwwppwk.",
      ".kwwwwwwwwk.",
      ".kwwwwwwwwk.",
      ".kwppwwppwk.",
      ".kwppwwppwk.",
      ".kwwwwwwwwk.",
      "..kkkkkkkk..",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0", p: "#402e3a" },
  },
  ball: {
    rows: [
      "............",
      "....kkkk....",
      "...kyyyyk...",
      "..kyywyyyk..",
      ".kyywyyyyyk.",
      ".kywyyyyyyk.",
      ".kyyyyyywyk.",
      ".kyyyyyywyk.",
      "..kyyyywyk..",
      "...kyyyyk...",
      "....kkkk....",
      "............",
    ],
    palette: { k: K, y: "#a8d84a", w: "#f0f8d0" },
  },
  magnifying: {
    // a magnifying glass: round lens ring with pale glass and a glint,
    // handle running diagonally off the bottom-right of the ring
    rows: [
      "............",
      "...kkkk.....",
      "..kwwwwk....",
      ".kwwwwwwk...",
      ".khwwwwwk...",
      ".kwwwwwwk...",
      ".kwwwwwwk...",
      "..kwwwwk....",
      "...kkkk.....",
      ".......kk...",
      "........kk..",
      ".........kk.",
    ],
    palette: { k: K, w: "#fdf3e0", h: "#ffffff" },
  },
  question: {
    // the mystery card: an outlined tile with the question on it
    rows: [
      "............",
      ".kkkkkkkkkk.",
      ".kwwqqqwwwk.",
      ".kwqqwqqwwk.",
      ".kwwwwqqwwk.",
      ".kwwwqqwwwk.",
      ".kwwwqqwwwk.",
      ".kwwwwwwwwk.",
      ".kwwwqqwwwk.",
      ".kkkkkkkkkk.",
      "............",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0", q: "#5e3e29" },
  },
  pill: {
    // longer and flatter than a round tablet — a horizontal capsule.
    rows: [
      "............",
      "............",
      "............",
      "..kkkkkkkk..",
      ".krrrrwwwwk.",
      "krrrrrwwwwwk",
      "krrrrrwwwwwk",
      ".krrrrwwwwk.",
      "..kkkkkkkk..",
      "............",
      "............",
      "............",
    ],
    palette: { k: K, r: "#e05c48", w: "#fdf3e0" },
  },
  hand: {
    // an open, raised palm — three finger grooves and a thumb. The universal
    // "that's enough" gesture.
    rows: [
      "............",
      "..kkkkkkkk..",
      ".khhkhhkhhk.",
      ".khhkhhkhhk.",
      ".khhkhhkhhk.",
      ".khhhhhhhhk.",
      "kkhhhhhhhhk.",
      "kthhhhhhhhk.",
      ".kthhhhhhk..",
      "..khhhhhk...",
      "...kkkkk....",
      "............",
    ],
    palette: { k: K, h: "#f0c896", t: "#d9a86f" },
  },
  whistle: {
    // a coach's whistle in profile: a bold mouthpiece bar off the top (with a
    // chrome highlight along it) meeting a round bell. The "that's enough"
    // gesture, upgraded.
    rows: [
      "............",
      "............",
      "............",
      "kkkkkkk.....",
      "khhhhhhkkk..",
      "ksssssssssk.",
      "kkkkkksssssk",
      ".....ksssssk",
      ".....kssssdk",
      "......kssdk.",
      ".......kkk..",
      "............",
    ],
    palette: { k: K, s: "#b9bcc3", h: "#eef0f4", d: "#8b8f97" },
  },
  barn: {
    // a gambrel roof and hayloft door read as "the farm" at any size,
    // where the tractor needed too many small distinguishable parts.
    rows: [
      ".....kk.....",
      "....kddk....",
      "...kddddk...",
      "..kddddddk..",
      "..krrrrrrk..",
      "..krrrrrrk..",
      "..krrwwrrk..",
      "..krrwwrrk..",
      "..krrkkrrk..",
      "..kkkkkkkk..",
      "............",
      "............",
    ],
    palette: { k: K, d: "#5e3e29", r: "#c0492f", w: "#fdf3e0" },
  },
  book: {
    rows: [
      "............",
      "..kkkkkkkk..",
      ".kbbbbbbbbk.",
      ".kbwwwwwwbk.",
      ".kbwbbbbwbk.",
      ".kbwwwwwwbk.",
      ".kbwbbbwwbk.",
      ".kbwwwwwwbk.",
      ".kbbbbbbbbk.",
      "..kkkkkkkk..",
      "............",
      "............",
    ],
    palette: { k: K, b: "#8f77c6", w: "#fdf3e0" },
  },
  disk: {
    rows: [
      "............",
      ".kkkkkkkkk..",
      ".kbbwwwbbkk.",
      ".kbbwwwbbbk.",
      ".kbbbbbbbbk.",
      ".kbbbbbbbbk.",
      ".kbwwwwwwbk.",
      ".kbwwwwwwbk.",
      ".kbwwwwwwbk.",
      ".kkkkkkkkkk.",
      "............",
      "............",
    ],
    palette: { k: K, b: "#5b88a0", w: "#fdf3e0" },
  },
  egg: {
    rows: [
      "............",
      "....kkkk....",
      "...kccck....",
      "..kcccccck..",
      "..koccccck..",
      ".kcccccccck.",
      ".kccoccccck.",
      ".kcccccccck.",
      ".kccccoccck.",
      "..kcccccck..",
      "...kkkkkk...",
      "............",
    ],
    palette: { k: K, c: "#f7e7c4", o: "#c69a6a" },
  },
  grave: {
    rows: [
      "............",
      "....kkkk....",
      "...ksssck...",
      "..kssssssk..",
      "..kscccssk..",
      "..ksscsssk..",
      "..ksscsssk..",
      "..kssssssk..",
      "..kssssssk..",
      ".kkkkkkkkkk.",
      ".gggggggggg.",
      "............",
    ],
    palette: { k: K, s: "#b0b4c4", c: "#7c8094", g: "#5aa85a" },
  },
  star: {
    // a solid five-point star for the rare/secret badge — gold fill with a
    // single lighter glint, no black outline so it stays clean at badge size
    rows: [
      "............",
      ".....yy.....",
      ".....yy.....",
      "....ywyy....",
      ".yyyyyyyyyy.",
      "..yyyyyyyy..",
      "...yyyyyy...",
      "..yyyyyyyy..",
      "..yyy..yyy..",
      ".yy......yy.",
      "............",
      "............",
    ],
    palette: { y: "#f0b840", w: "#ffe9b0" },
  },
  sparkle: {
    // a clean four-point star with two glints
    rows: [
      "............",
      ".....y......",
      ".....y......",
      "....ywy.....",
      "..yywwwyy...",
      "....ywy.....",
      ".....y......",
      ".....y......",
      "..w......w..",
      "............",
      "............",
      "............",
    ],
    palette: { y: "#ffd884", w: "#fff7dc" },
  },
  alert: {
    rows: [
      "....rrrr....",
      "....rrrr....",
      "....rrrr....",
      "....rrrr....",
      "....rrrr....",
      "....rrrr....",
      ".....rr.....",
      "............",
      "....rrrr....",
      "....rrrr....",
      "............",
      "............",
    ],
    palette: { r: "#e05c48" },
  },
  speechdots: {
    // a speech bubble with a three-dot ellipsis — "there's something to
    // say," not an alarm. Tail is solid ink so it reads as fused to the
    // bubble rather than a floating chip; dots match the outline ink.
    // Spans rows 1-10, same as the other meter-row icons, so it doesn't
    // look undersized next to them.
    rows: [
      "............",
      ".kkkkkkkkkk.",
      "kwwwwwwwwwwk",
      "kwwwwwwwwwwk",
      "kwwkwwkwwkwk",
      "kwwwwwwwwwwk",
      "kwwwwwwwwwwk",
      ".kkkkkkkkkk.",
      "..kkk.......",
      "...kk.......",
      "....k.......",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0" },
  },
  thermometer: {
    rows: [
      "............",
      ".....kk.....",
      "....kwwk....",
      "....kwrk....",
      "....kwrk....",
      "....kwrk....",
      "....kwrk....",
      "...krrrrk...",
      "...krrrrk...",
      "....krrk....",
      ".....kk.....",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0", r: "#e05c48" },
  },
  rock: {
    // Same 9-row vertical footprint as paper (1 blank row top, 2 bottom) —
    // it used to stop after 7 rows, floating small in the top half.
    rows: [
      "............",
      "...kkkkkk...",
      "..kswssssk..",
      ".kswwsssssk.",
      ".kssssssssk.",
      ".kssssssssk.",
      ".kssssssssk.",
      ".kssssssssk.",
      "..kssssssk..",
      "...kkkkkk...",
      "............",
      "............",
    ],
    palette: { k: K, s: "#9a9cb0", w: "#c8cbe0" },
  },
  paper: {
    rows: [
      "............",
      "..kkkkkkkk..",
      "..kwwwwwwk..",
      "..kwllllwk..",
      "..kwwwwwwk..",
      "..kwllllwk..",
      "..kwwwwwwk..",
      "..kwllllwk..",
      "..kwwwwwwk..",
      "..kkkkkkkk..",
      "............",
      "............",
    ],
    palette: { k: K, w: "#fdf3e0", l: "#c9b896" },
  },
  fist: {
    // the RPS countdown pump — a fist, knuckles forward
    rows: [
      "............",
      "............",
      "...kkkkk....",
      "..khhhhhk...",
      ".khhhhhhhk..",
      ".khkhkhkhk..",
      ".khhhhhhhk..",
      ".kthhhhhhk..",
      ".kthhhhhk...",
      "..kkkkkk....",
      "............",
      "............",
    ],
    palette: { k: K, h: "#f0c896", t: "#d9a86f" },
  },
  scissors: {
    // blades in the outline ink itself; open (transparent) handle loops so
    // whatever's behind the icon shows through instead of a fixed fill.
    rows: [
      "............",
      ".kk......kk.",
      "..kk....kk..",
      "...kk..kk...",
      "....kkkk....",
      ".....kk.....",
      "....kkkk....",
      "..kkk..kkk..",
      "..k.k..k.k..",
      "..k.k..k.k..",
      "..kkk..kkk..",
      "............",
    ],
    palette: { k: K },
  },
};

const CELL = 12;
const urlCache = new Map<string, string>();
const canvasCache = new Map<string, HTMLCanvasElement>();

/** A raw 12×12 canvas for drawing into other canvases (the scene uses this). */
export function iconCanvas(name: IconName): HTMLCanvasElement {
  const cached = canvasCache.get(name);
  if (cached) return cached;
  const canvas = renderIcon(name);
  canvasCache.set(name, canvas);
  return canvas;
}

function renderIcon(name: IconName): HTMLCanvasElement {
  const def = ICONS[name];
  const canvas = document.createElement("canvas");
  canvas.width = CELL;
  canvas.height = CELL;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(CELL, CELL);
  for (let y = 0; y < def.rows.length && y < CELL; y++) {
    const row = def.rows[y];
    for (let x = 0; x < row.length && x < CELL; x++) {
      const color = def.palette[row[x]];
      if (!color) continue;
      const i = (y * CELL + x) * 4;
      img.data[i] = parseInt(color.slice(1, 3), 16);
      img.data[i + 1] = parseInt(color.slice(3, 5), 16);
      img.data[i + 2] = parseInt(color.slice(5, 7), 16);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Render an icon to a cached data URL (drawn 1px per cell, scaled by CSS). */
export function iconUrl(name: IconName): string {
  const cached = urlCache.get(name);
  if (cached) return cached;
  const url = iconCanvas(name).toDataURL();
  urlCache.set(name, url);
  return url;
}

/** `<img>` markup for innerHTML templates. Size in CSS px. */
export function iconHTML(name: IconName, size = 20): string {
  return `<img class="pxicon" src="${iconUrl(name)}" width="${size}" height="${size}" alt="" />`;
}

/** An `<img>` element for programmatic composition. */
export function iconEl(name: IconName, size = 20): HTMLImageElement {
  const img = document.createElement("img");
  img.className = "pxicon";
  img.src = iconUrl(name);
  img.width = size;
  img.height = size;
  img.alt = "";
  return img;
}

// --- Pixel digits -----------------------------------------------------------
// A tiny 5×7 bitmap font, so numbers on screen read in the same hand-placed
// pixel style as the icons instead of a jarring system typeface. Rendered as an
// alpha mask (see digitMaskUrl) so the colour is driven by CSS `currentColor` —
// that lets a card tint its number green/red/muted without re-rendering.
const DIGIT_GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "00100", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
};

const digitCache = new Map<string, string>();

/** A digit (or "?") as an alpha-mask data URL, drawn in crisp blocks. Consumers
 *  set it as a CSS mask-image and fill it with `currentColor`. */
export function digitMaskUrl(ch: string): string {
  const cached = digitCache.get(ch);
  if (cached) return cached;
  const g = DIGIT_GLYPHS[ch] ?? DIGIT_GLYPHS["?"];
  const S = 8; // block size — big enough that CSS scaling stays crisp
  const w = g[0].length;
  const h = g.length;
  const canvas = document.createElement("canvas");
  canvas.width = w * S;
  canvas.height = h * S;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000"; // opaque where the glyph is on; colour comes from CSS
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y][x] !== "0") ctx.fillRect(x * S, y * S, S, S);
    }
  }
  const url = canvas.toDataURL();
  digitCache.set(ch, url);
  return url;
}
