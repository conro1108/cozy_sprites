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

// Six foods, two per health tier — healthy (carrot, soup) actually help the
// body, neutral (burger, noodles) are plain fuel, unhealthy (cake, cube) are
// the treats: the only two with happiness ≥ 0.5, so they're always accepted
// even on a full stomach (see feed()'s isTreat check). Weight-per-energy
// climbs tier by tier (~0.1 → ~0.6/1.5) and each tier has a light and a heavy
// option, so a varied healthy-leaning diet hovers near the baseline metabolism
// (~0.15/awake-hour drift + games) while leaning on the unhealthy pair is what
// visibly tips a pet overweight.
export const FOODS: Record<FoodId, FoodDef> = {
  // Healthy — light everyday health food vs. heartier, actively healing.
  carrot: { id: "carrot", name: "Carrot", icon: "🥕", energy: 1, happiness: 0, weight: 0.1, fiber: 0.6 },
  // The comfort food: warm, and the one dish that actively heals — doubly so
  // when sick. Even a fainted pet will take soup.
  soup: { id: "soup", name: "Soup", icon: "🍲", energy: 1.5, happiness: 0.4, weight: 0.25, fiber: 0.3 },
  // Neutral — plain fuel, no health effect either way. Noodles are the
  // heartier, more indulgent pick: same energy as a burger, more happiness,
  // more weight to show for it.
  burger: { id: "burger", name: "Burger", icon: "🍔", energy: 2, happiness: 0.2, weight: 0.5, fiber: 0.35 },
  noodles: { id: "noodles", name: "Noodles", icon: "🍜", energy: 2, happiness: 0.3, weight: 0.7, fiber: 0.4 },
  // Unhealthy — both treats. Cube is the mild, mysterious one: modest
  // happiness, a small health cost, weird instead of rich. Cake is the real
  // junk food: the biggest happiness hit in the roster, and the weight and
  // health cost to match.
  cube: { id: "cube", name: "Cube", icon: "🧊", energy: 1, happiness: 0.5, weight: 0.6, fiber: 0.12 },
  cake: { id: "cake", name: "Cake", icon: "🍰", energy: 1, happiness: 1, weight: 1.5, fiber: 0.15 },
};

export const FOOD_ORDER: FoodId[] = ["burger", "cake", "carrot", "noodles", "cube", "soup"];

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
    favorite: "noodles",
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
    name: "The Humming Cube",
    blurb: "Reportedly the result of feeding the cube to something patient until it agreed.",
    favorite: "cube",
    disliked: null, // it holds no grudge against any food. Or anything.
    preferredGame: "cubehum",
    secret: true,
  },
  carrot: {
    id: "carrot",
    name: "The Blessed Carrot",
    blurb: "You are what you eat, if you never once waver.",
    favorite: "carrot", // it prefers not to discuss it
    disliked: "burger",
    preferredGame: "hideseek", // root vegetables are naturals underground
    secret: true,
  },
  cosmos: {
    id: "cosmos",
    name: "The Little Cosmos",
    blurb: "No upbringing summons it. Once in a great while, the night sky simply keeps one.",
    favorite: "soup", // a warm bowl, swirled like a small galaxy
    disliked: null, // it holds nothing against anything down here
    preferredGame: "hideseek", // it is, after all, mostly somewhere else
    secret: true,
    ultra: true,
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
];
