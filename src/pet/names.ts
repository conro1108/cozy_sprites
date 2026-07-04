// A big bank of starting-name suggestions. The egg screen proposes a random one
// each time (and lets you reroll) instead of always defaulting to "Milo". Tone
// matches the game: cosy, a little dry, occasionally cursed. Every entry is <= 12
// characters to fit the name input's maxlength.

export const STARTER_NAMES: readonly string[] = [
  // Snacks & suppers
  "Biscuit", "Waffle", "Pudding", "Pickle", "Noodle", "Muffin", "Peanut",
  "Pumpkin", "Dumpling", "Nugget", "Crumpet", "Scone", "Toast", "Custard",
  "Truffle", "Gnocchi", "Pierogi", "Wonton", "Ramen", "Tofu", "Congee",
  "Gumbo", "Brisket", "Pesto", "Basil", "Thyme", "Ginger", "Nutmeg",
  "Saffron", "Cocoa", "Latte", "Mocha", "Cannoli", "Gelato", "Sorbet",
  "Pancake", "Cinnamon", "Rosemary", "Marmalade", "Biscotti", "Honey",
  "Syrup", "Mochi",
  // Produce
  "Fig", "Plum", "Cherry", "Berry", "Apricot", "Quince", "Guava", "Lychee",
  "Mango", "Papaya", "Melon", "Gourd", "Squash", "Zucchini", "Okra", "Leek",
  "Chard", "Kale", "Beet", "Yam", "Turnip", "Radish", "Olive", "Tater",
  // Cosy little things
  "Marbles", "Clover", "Maple", "Hazel", "Poppy", "Sprout", "Gizmo", "Widget",
  "Button", "Pebble", "Cricket", "Acorn", "Chestnut", "Walnut", "Almond",
  "Cashew", "Bramble", "Pinecone",
  // Regal & old-fashioned
  "Duchess", "Baron", "Countess", "Empress", "Pharaoh", "Regent", "Vizier",
  "Consul", "Sultan", "Majesty", "Reginald", "Mortimer", "Percival", "Winston",
  "Gideon", "Barnaby", "Ignatius", "Cornelius", "Archibald", "Montgomery",
  "Wilhelmina", "Gwendolyn", "Clementine", "Persephone", "Bartholomew",
  // Faintly cursed
  "Omen", "Hex", "Wraith", "Cinder", "Ember", "Dusk", "Gloom", "Mothman",
  "Cryptid", "Void", "Echo", "Static", "Anomaly", "Portent", "Effigy", "Relic",
  "Rune", "Sigil", "Specter", "Phantom", "Banshee", "Wendigo", "Basilisk",
  "Grendel", "Mimic", "Grimoire", "Talisman", "Amulet", "Oracle", "Cipher",
  "Enigma", "Whisper", "Shadow", "Nocturne", "Requiem", "Beelzebub", "Ghast",
  "Lich", "Kraken", "Yeti", "Goblin", "Gremlin", "Idol",
  // Celestial & twilight
  "Vesper", "Eclipse", "Solstice", "Equinox", "Zenith", "Abyss", "Fathom",
  "Dirge", "Umbra", "Seer", "Augur", "Riddle", "Aurora", "Comet", "Nebula",
  // Plants & greenery
  "Willow", "Fern", "Ivy", "Moss", "Thistle", "Nettle", "Aster", "Dahlia",
  "Zinnia", "Marigold", "Petunia", "Juniper", "Cedar", "Birch", "Aspen",
  "Rowan", "Alder", "Cypress", "Fennel", "Sorrel", "Heather", "Lichen",
  "Bracken", "Toadstool",
  // Creatures
  "Goose", "Moose", "Walrus", "Otter", "Badger", "Weasel", "Ferret", "Newt",
  "Toad", "Snail", "Beetle", "Mantis", "Moth", "Tadpole", "Axolotl", "Pangolin",
  "Quokka", "Wombat", "Numbat", "Capybara", "Tapir", "Okapi", "Gecko",
  "Firefly", "Ladybug",
  // Objects & titles
  "Lantern", "Kettle", "Quilt", "Mitten", "Thimble", "Bobbin", "Spindle",
  "Ladle", "Kindling", "Hearth", "Cobweb", "Tallow", "Flint", "Tinder", "Anvil",
  "Bellows", "Professor", "Captain", "Admiral", "Warden", "Sheriff", "Marshal",
  "Bishop", "Jester", "Milo",
];

/** A random starting-name suggestion for the egg screen. */
export function randomName(rng: () => number = Math.random): string {
  return STARTER_NAMES[Math.floor(rng() * STARTER_NAMES.length)];
}
