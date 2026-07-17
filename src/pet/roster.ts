// Static content tables: the five foods and the six adult forms.

import type { AdultForm, FoodId, GameId } from "./types";

export interface FoodDef {
  id: FoodId;
  name: string;
  icon: string; // emoji used on the Food menu buttons
  energy: number; // hearts restored
  happiness: number; // hearts restored
  weight: number; // weight delta
  fiber: number; // roughage → poop pressure. What goes in must come out.
}

// Six foods, two per health tier — healthy (carrot, salad) actually help the
// body, neutral (soup, burger) are plain fuel, unhealthy (cake, cube) are
// the treats: the only two with happiness ≥ 0.5, so they're always accepted
// even on a full stomach (see feed()'s isTreat check). Weight-per-energy
// climbs tier by tier (~0.1 → ~0.6/1.5) and each tier has a light and a heavy
// option, so a varied healthy-leaning diet hovers near the baseline metabolism
// (~0.15/awake-hour drift + games) while leaning on the unhealthy pair is what
// visibly tips a pet overweight.
export const FOODS: Record<FoodId, FoodDef> = {
  // Healthy — light everyday health food (carrot) vs. heartier, actively
  // healing (salad) — doubly so when sick. Discipline works even when you
  // feel awful; see feed()'s health bonus.
  carrot: { id: "carrot", name: "Carrot", icon: "🥕", energy: 1, happiness: 0, weight: 0.1, fiber: 0.6 },
  salad: { id: "salad", name: "Salad", icon: "🥗", energy: 2, happiness: 0.3, weight: 0.7, fiber: 0.4 },
  // Neutral — plain fuel, no health effect either way. Soup's just a warm
  // bowl now; burger's the heartier, more indulgent pick.
  soup: { id: "soup", name: "Soup", icon: "🍲", energy: 1.5, happiness: 0.4, weight: 0.25, fiber: 0.3 },
  burger: { id: "burger", name: "Burger", icon: "🍔", energy: 2, happiness: 0.2, weight: 0.5, fiber: 0.35 },
  // Unhealthy — both treats, both a bad idea to lean on, in different ways.
  // Cube isn't food at all — mostly vibes and a path to the Humming Cube —
  // so it actually costs energy instead of restoring any; that impracticality
  // is the point, not a health penalty. Cake is the real junk food: the
  // biggest happiness hit in the roster, with the weight and health cost to match.
  cube: { id: "cube", name: "Cube", icon: "🧊", energy: -0.5, happiness: 0.5, weight: 0.3, fiber: 0.12 },
  cake: { id: "cake", name: "Cake", icon: "🍰", energy: 1, happiness: 1, weight: 1.5, fiber: 0.15 },
};

export const FOOD_ORDER: FoodId[] = ["burger", "cake", "carrot", "salad", "cube", "soup"];

export interface AdultDef {
  id: AdultForm;
  name: string;
  blurb: string; // vague collection-clue hint
  favorite: FoodId;
  disliked: FoodId | null;
  preferredGame: GameId;
  /** Secret forms don't appear in the collection until discovered. */
  secret?: boolean;
  /** The one double-secret form: even rarer than a secret, and given its own
   *  cosmic collection treatment when finally caught. */
  ultra?: boolean;
  /** Never appears in the collection at all — not as a tile, not as a "???"
   *  slot, not even after you've raised one. There is no in-game trace that it
   *  exists; you either know the name or you don't. */
  hidden?: boolean;
}

export const ADULTS: Record<AdultForm, AdultDef> = {
  dog: {
    id: "dog",
    name: "Loyal Dog Thing",
    blurb: "Often appears when an active, well-cared-for teen develops an enthusiasm for fetch.",
    favorite: "burger",
    disliked: "cube",
    preferredGame: "fetch",
  },
  blob: {
    id: "blob",
    name: "Dramatic Blob",
    blurb: "Tends to emerge from a pampered life of cake and mild neglect.",
    favorite: "cake",
    disliked: "carrot",
    preferredGame: "higherlower",
  },
  gremlin: {
    id: "gremlin",
    name: "Gremlin",
    blurb: "Reports suggest an irresponsible relationship with geometry and the truth.",
    favorite: "cube",
    disliked: null,
    preferredGame: "fetch",
  },
  scholar: {
    id: "scholar",
    name: "Little Scholar",
    blurb: "Associated with discipline, vegetables, and confidently incorrect research.",
    favorite: "carrot",
    disliked: "cake",
    preferredGame: "higherlower",
  },
  office: {
    id: "office",
    name: "Tired Office Creature",
    blurb: "Develops from a steady, unremarkable, slightly under-loved upbringing.",
    favorite: "salad",
    disliked: "cube",
    preferredGame: "wouldyou",
  },
  menace: {
    id: "menace",
    name: "Fancy Little Menace",
    blurb: "Cultivated by high discipline, refined taste, and quiet judgment.",
    favorite: "cake",
    disliked: "burger",
    preferredGame: "higherlower",
  },
  ghost: {
    id: "ghost",
    name: "Quiet Ghost",
    blurb: "Nobody remembers raising one. It remembers being raised. In the dark.",
    favorite: "cube",
    disliked: "burger",
    preferredGame: "hideseek",
    secret: true,
  },
  humcube: {
    id: "humcube",
    name: "Humming Cube",
    blurb: "Reportedly the result of feeding the cube to something patient until it agreed.",
    favorite: "cube",
    disliked: null, // it holds no grudge against any food. Or anything.
    preferredGame: "cubehum",
    secret: true,
  },
  carrot: {
    id: "carrot",
    name: "Blessed Carrot",
    blurb: "You are what you eat, if you never once waver.",
    favorite: "carrot", // it prefers not to discuss it
    disliked: "burger",
    preferredGame: "hideseek", // root vegetables are naturals underground
    secret: true,
  },
  cosmos: {
    id: "cosmos",
    name: "Stray Cosmos",
    blurb: "No upbringing summons it. Once in a great while, the night sky simply keeps one.",
    favorite: "soup", // a warm bowl, swirled like a small galaxy
    disliked: null, // it holds nothing against anything down here
    preferredGame: "hideseek", // it is, after all, mostly somewhere else
    secret: true,
    ultra: true,
  },
  // Not a personality you can raise — an easter egg. Only a pet named "connor"
  // ever becomes one (see determineAdultForm), and it never shows up in the
  // collection, so nobody who doesn't already know is left staring at a gap.
  mole: {
    id: "mole",
    name: "Maverick Mole",
    blurb: "Undocumented. Ships anyway.", // never rendered — see `hidden`
    favorite: "cube", // a well-specified shape. Finally, a food with no edge cases
    disliked: "soup", // cannot be eaten over a keyboard. Non-starter
    preferredGame: "higherlower", // it is, professionally, a binary search
    hidden: true,
  },
};

export const ADULT_ORDER: AdultForm[] = [
  "dog",
  "blob",
  "gremlin",
  "scholar",
  "office",
  "menace",
  "ghost",
  "humcube",
  "carrot",
  "cosmos",
  "mole",
];
