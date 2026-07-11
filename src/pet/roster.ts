// Static content tables: the five foods and the six adult forms.

import type { AdultForm, FoodId, GameId } from "./types";

export interface FoodDef {
  id: FoodId;
  name: string;
  icon: string; // emoji used on the Food menu buttons
  hunger: number; // hearts restored
  happiness: number; // hearts restored
  weight: number; // weight delta
  fiber: number; // roughage → poop pressure. What goes in must come out.
}

// Fiber drives digestion (see stepEvents). Carrot is basically a plumbing
// service; noodles/burger are middling; cake is dessert, not roughage; the
// cube passes through mostly unbothered by biology. Weight values are tuned
// against the real-clock metabolism (~0.15/awake-hour drift + games): a varied
// diet hovers near the baseline, a cake habit visibly does not.
export const FOODS: Record<FoodId, FoodDef> = {
  burger: { id: "burger", name: "Burger", icon: "🍔", hunger: 2, happiness: 0.2, weight: 1, fiber: 0.35 },
  cake: { id: "cake", name: "Cake", icon: "🍰", hunger: 1, happiness: 1, weight: 1.5, fiber: 0.15 },
  carrot: { id: "carrot", name: "Carrot", icon: "🥕", hunger: 1, happiness: 0, weight: 0.2, fiber: 0.6 },
  noodles: { id: "noodles", name: "Noodles", icon: "🍜", hunger: 2, happiness: 0.3, weight: 1.2, fiber: 0.4 },
  cube: { id: "cube", name: "Cube", icon: "🧊", hunger: 1, happiness: 0.5, weight: 0.4, fiber: 0.12 },
  // The comfort food: light, warm, and the one dish that actively heals —
  // doubly so when sick. Even a fainted pet will take soup.
  soup: { id: "soup", name: "Soup", icon: "🍲", hunger: 1.5, happiness: 0.4, weight: 0.5, fiber: 0.3 },
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
];
