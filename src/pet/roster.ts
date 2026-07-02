// Static content tables: the five foods and the six adult forms.

import type { AdultForm, FoodId, GameId } from "./types";

export interface FoodDef {
  id: FoodId;
  name: string;
  icon: string; // emoji used on the Food menu buttons
  hunger: number; // hearts restored
  happiness: number; // hearts restored
  weight: number; // weight delta
}

export const FOODS: Record<FoodId, FoodDef> = {
  burger: { id: "burger", name: "Burger", icon: "🍔", hunger: 2, happiness: 0.2, weight: 2 },
  cake: { id: "cake", name: "Cake", icon: "🍰", hunger: 1, happiness: 1, weight: 3 },
  carrot: { id: "carrot", name: "Carrot", icon: "🥕", hunger: 1, happiness: 0, weight: 0.5 },
  noodles: { id: "noodles", name: "Noodles", icon: "🍜", hunger: 2, happiness: 0.3, weight: 2.5 },
  cube: { id: "cube", name: "Cube", icon: "🧊", hunger: 1, happiness: 0.5, weight: 1 },
};

export const FOOD_ORDER: FoodId[] = ["burger", "cake", "carrot", "noodles", "cube"];

export interface AdultDef {
  id: AdultForm;
  name: string;
  blurb: string; // vague collection-clue hint (SPEC §7)
  favorite: FoodId;
  disliked: FoodId | null;
  preferredGame: GameId;
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
    blurb: "Associated with disciplined pets, vegetables, and confidently incorrect research.",
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
};

export const ADULT_ORDER: AdultForm[] = [
  "dog",
  "blob",
  "gremlin",
  "scholar",
  "office",
  "menace",
];
