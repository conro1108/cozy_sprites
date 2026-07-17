// Mini-game logic. Kept pure and rng-injectable; the UI owns presentation.

import type { GameId, Stage } from "./types";

// --- Who won, from the sprite's side of the table ----------------------------
// Every game reports the *player's* result (`won`), but the sprite's feelings —
// happiness credit, its reaction line, the happy bounce — key off *its* outcome.
// Stances: fetch is played WITH the sprite and higher/lower and the cube's hum
// are the two of you vs. the roll/the cube, so its result is the shared one.
// RPS and hide-and-seek are played AGAINST it, so its result is the inverse.
// (Would You Rather has no result at all; callers pass won=false.)

const AGAINST_THE_SPRITE: ReadonlySet<GameId> = new Set(["rps", "hideseek"]);

export function spriteWon(game: GameId, playerWon: boolean): boolean {
  return AGAINST_THE_SPRITE.has(game) ? !playerWon : playerWon;
}

/** Display names, shared by the Play menu's tiles and the history diary so a
 *  game is called the same thing wherever it's named. */
export const GAME_NAMES: Record<GameId, string> = {
  higherlower: "Higher / Lower",
  fetch: "Fetch",
  rps: "Rock Paper Scissors",
  hideseek: "Hide & Seek",
  wouldyou: "Would You Rather",
  cubehum: "The Cube's Hum",
};

export type RpsMove = "rock" | "paper" | "scissors";
export type Outcome = "win" | "lose" | "tie";

/** A finished mini-game's overall result. Every game but RPS is strictly
 *  win/lose; RPS's best-of-N can end with neither side taking the majority,
 *  which reads as a match tie rather than a coin-flip winner. */
export type MatchResult = boolean | "tie";

const BEATS: Record<RpsMove, RpsMove> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

export function judgeRps(player: RpsMove, ai: RpsMove): Outcome {
  if (player === ai) return "tie";
  return BEATS[player] === ai ? "win" : "lose";
}

/** A fair AI move, or a cheating one that always beats the player (Gremlin). */
export function rpsAiMove(
  player: RpsMove,
  cheat: boolean,
  rng: () => number = Math.random,
): RpsMove {
  if (cheat) {
    // Pick the move that beats the player.
    return (Object.keys(BEATS) as RpsMove[]).find((m) => BEATS[m] === player)!;
  }
  const moves: RpsMove[] = ["rock", "paper", "scissors"];
  return moves[Math.floor(rng() * moves.length)];
}

// --- Higher or Lower --------------------------------------------------------
export function rollCard(rng: () => number = Math.random): number {
  return 1 + Math.floor(rng() * 9); // 1..9
}

export function judgeHigherLower(
  prev: number,
  guessHigher: boolean,
  next: number,
): Outcome {
  if (next === prev) return "tie"; // push, re-draw in UI
  const wentHigher = next > prev;
  return wentHigher === guessHigher ? "win" : "lose";
}

// --- Fetch ------------------------------------------------------------------
/**
 * How the fetch plays out on screen. Each variant has its own animation in the
 * scene and its own set of lines, so the words always match what you just saw.
 */
export type FetchVariant =
  | "return" // trots the ball back
  | "epic" // a heroic mid-air catch
  | "wrongway" // sprints off in the wrong direction
  | "overfence" // the ball sails over the fence, gone
  | "sock" // comes back with… a sock
  | "stick" // comes back with a stick. A good stick.
  | "whichway" // loses track of the ball entirely. Which way did it go??
  | "distracted" // never even commits to the chase
  | "cube"; // returns holding the cube. You threw a ball.

export interface FetchResult {
  success: boolean;
  variant: FetchVariant;
  /** Null roughly 30% of the time regardless of variant — every outcome has
   *  lines available (see FETCH_LINES), but always speaking would mean the
   *  same handful of quips on repeat every session. Letting the animation
   *  carry it alone sometimes keeps it from feeling scripted. */
  line: string | null;
}

// How often a fetch result stays silent even though it has lines available.
const FETCH_SILENCE_CHANCE = 0.3;

/** Pick a line, or nothing — see FetchResult.line. (>1-chance rather than
 *  <chance so the tests' rng:()=>0 stays on the "has a line" path, matching
 *  the rest of this file's convention.) */
function maybeLine(pool: string[], rng: () => number): string | null {
  if (rng() > 1 - FETCH_SILENCE_CHANCE) return null;
  return pick(pool, rng);
}

/** Where the throw meter's forgiving zone sits, and how forgiving it is.
 *  `center` is its midpoint (0..1 along the track); `span` is the distance
 *  from center at which throw quality decays to zero — bigger span = wider,
 *  easier zone. Rolled fresh each throw so no two feel the same. */
export interface FetchSpot {
  center: number;
  span: number;
}

// The old fixed behavior, kept as the default so callers (and tests) that
// don't pass a spot get exactly the previous scoring: a zone centered at 0.6.
export const DEFAULT_FETCH_SPOT: FetchSpot = { center: 0.6, span: 0.5 };

// The visible green band reaches this fraction of `span` on each side of
// center — and that's exactly the adult success radius, so what you see is
// what's judged.
const SUCCESS_HALF_PER_SPAN = 0.55;

// The original fixed green band spanned 30% of the track (half-width 0.15).
// Rolled widths scale off this so the zone is never much wider than it used to
// be, only equal-to or narrower.
const BASE_HALF_WIDTH = 0.15;

/** Half-width of the *visible* green band for a given span: the adult success
 *  band is center ± this, so "stop in the green" is an honest promise. */
export function fetchSuccessHalfWidth(span: number): number {
  return SUCCESS_HALF_PER_SPAN * span;
}

/** Roll a fresh sweet spot. Difficulty (how wide the green is) and position
 *  (where it sits) both vary, so some throws are gimmes and some are tight.
 *  Width ranges 0.5x–1.15x of the original fixed band. */
export function rollFetchSpot(rng: () => number = Math.random): FetchSpot {
  const hw = BASE_HALF_WIDTH * (0.5 + rng() * 0.65); // 0.5x .. 1.15x
  const span = hw / SUCCESS_HALF_PER_SPAN; // invert so the band == what we judge
  // Keep the whole green band on the track (center stays hw away from each end).
  const center = hw + rng() * (1 - 2 * hw);
  return { center, span };
}

// Young pets are simply worse at fetch — a baby mostly gets distracted, a
// child fumbles a lot, and a teen can't be bothered to fully commit.
const STAGE_FUMBLE: Record<Stage, number> = {
  egg: 1, // never reachable (Play is gated), but total fumble if it were
  baby: 0.6, // a baby cannot fetch. It can only participate.
  child: 0.2,
  teen: 0.05,
  adult: 0,
};

/** power 0..1 (how close to the sweet spot the throw meter stopped). */
export function resolveFetch(
  power: number,
  rng: () => number = Math.random,
  stage: Stage = "adult",
  spot: FetchSpot = DEFAULT_FETCH_SPOT,
): FetchResult {
  // Very rarely the ball simply… isn't what comes back — independent of
  // throw quality, so even a perfect throw can get this surprise. Kept well
  // below sock's worst-case rate (P(miss) × sock's 8% share of the fail
  // pool) so it reads as the rarest thing fetch can produce, not just the
  // rarest miss. (rng>0.985 rather than <0.015 so the tests' rng:()=>0
  // stays on the ordinary path.)
  if (rng() > 0.985) {
    return { success: true, variant: "cube", line: maybeLine(FETCH_LINES.cube, rng) };
  }
  // Distance from the (possibly-moved) sweet spot; edges fumble. Youth fumbles
  // more. A wider span forgives more, so the same throw can pass an easy zone
  // and miss a tight one. (Default spot reproduces the old center-0.6 scoring.)
  // Babies can't reliably fetch, but they should land one occasionally rather
  // than fumbling every single throw — a small flat chance of success cuts
  // through the fumble penalty regardless of how good the throw was. (>0.88
  // rather than <0.12 so the tests' rng:()=>0 stays on the ordinary path.)
  const babyLucky = stage === "baby" && rng() > 0.88;
  const quality = 1 - Math.abs(power - spot.center) / spot.span - STAGE_FUMBLE[stage];
  if (quality > 0.45 || babyLucky) {
    const variant: FetchVariant = quality > 0.45 && rng() < 0.22 ? "epic" : "return";
    return { success: true, variant, line: maybeLine(FETCH_LINES[variant], rng) };
  }
  const variant = pickFail(rng());
  return { success: false, variant, line: maybeLine(FETCH_LINES[variant], rng) };
}

// Weighted fail pool, in three tiers: the ordinary misses (wrongway,
// whichway, distracted) carry the game; overfence and stick are a rung
// rarer; sock is the rarest miss. (The cube is rarer still — see its own
// flat, quality-independent roll above.)
const FAIL_WEIGHTS: [FetchVariant, number][] = [
  ["wrongway", 0.22],
  ["whichway", 0.22],
  ["distracted", 0.22],
  ["overfence", 0.13],
  ["stick", 0.13],
  ["sock", 0.08],
];

function pickFail(roll: number): FetchVariant {
  let acc = 0;
  for (const [variant, w] of FAIL_WEIGHTS) {
    acc += w;
    if (roll < acc) return variant;
  }
  return FAIL_WEIGHTS[FAIL_WEIGHTS.length - 1][0];
}

// Every variant has lines to draw from (see maybeLine for how often they
// actually get used) — but only lines that are a genuine reaction, never
// ones that just narrate the action the scene already played out ("lay down
// halfway", "watched it sail over the fence").
const FETCH_LINES: Record<FetchVariant, string[]> = {
  return: [
    "Retrieved it. Flawless.",
    "Got it!",
    "Perfect return.",
    "Delivered. Slightly damp. You're welcome.",
  ],
  epic: [
    "Caught it on the first bounce. Legend.",
    "Snatched it out of the air. Unreal.",
    "It never stood a chance.",
  ],
  wrongway: [
    "Went the wrong way. Fully committed.",
    "That direction felt right at the time.",
  ],
  overfence: [
    "The ball has emigrated.",
    "It's the neighbor's ball now.",
    "Physics happened. Not my fault.",
  ],
  sock: [
    "Returned with one damp sock. Whose?",
    "A sock. Bold substitution. No regrets.",
  ],
  stick: [
    "Found a stick. The ball is dead to me.",
    "Behold: stick.",
    "The ball was unavailable. The stick volunteered.",
  ],
  whichway: [
    "Which way did it go??",
    "It vanished. Genuinely gone.",
    "I looked away for one second.",
    "The grass ate it. I checked everywhere.",
  ],
  distracted: [
    "Found a beetle instead. The beetle is furious.",
    "A smell called. I had to take it.",
    "The ball can wait. This cannot.",
  ],
  cube: [
    "This is not the ball. It is better. It is the cube.",
    "The cube wished to be fetched. Who am I to argue.",
  ],
};

// --- Hide and Seek ----------------------------------------------------------
export const HIDE_SPOTS = ["behind the stump", "in the flowers", "behind the fence", "under the mushroom"] as const;
export type HideSpot = (typeof HIDE_SPOTS)[number];

export function pickHideSpot(rng: () => number = Math.random): HideSpot {
  return HIDE_SPOTS[Math.floor(rng() * HIDE_SPOTS.length)];
}

const HIDE_FOUND_LINES = [
  "You found me. Unsettling.",
  "How?! I was so quiet.",
  "Fine. Found. This changes nothing.",
  "I let you win. Remember that.",
  "Impossible. I was one with the scenery.",
  "Noted: you can be relied upon to find things.",
  "Okay, that was genuinely impressive. Forget I said that.",
];

const HIDE_LOST_LINES: ((spot: HideSpot) => string)[] = [
  (s) => `I was ${s}. The whole time.`,
  (s) => `I was ${s}. I could hear you guessing.`,
  (s) => `Wrong. I was ${s}. Try to act less surprised.`,
  (s) => `I was ${s}, breathing extremely quietly.`,
  (s) => `You checked everywhere except ${s}. Astonishing.`,
  (s) => `I was ${s}. I nearly fell asleep waiting.`,
  (s) => `I was ${s}. The mushroom saw everything.`,
];

// --- The Cube's Hum ---------------------------------------------------------
// A memory game (Simon-style). The cube hums a growing sequence of its four
// faces; you hum it back. Match all the way to the target length to win.
// "You cannot out-hum the cube. No one can." — you, occasionally, can.
export const CUBE_FACES = 4;
// You can hum forever — it only ends when you miss. Clearing this many rounds is
// the point where the cube is *impressed* (a "win" verdict); the reward itself
// keeps climbing past it (see cubeHumCredit).
export const CUBE_HUM_TARGET = 4;

/** Grow the hum by one more face. The cube never repeats itself the easy way. */
export function extendHum(seq: number[], rng: () => number = Math.random): number[] {
  return [...seq, Math.floor(rng() * CUBE_FACES)];
}

/** Play credit (happiness hearts) earned for reaching `rounds` cleared hums.
 *  Endless game: the farther you get, the more it's worth. Zero rounds still
 *  pays a small "thanks for trying" bump; a long run nearly fills the meter. */
export function cubeHumCredit(rounds: number): number {
  const gain = 0.4 + Math.max(0, rounds) * 0.35;
  return Math.min(3, gain);
}

/** Did the player's taps reproduce the hum exactly (so far)? Prefix input is
 *  "not wrong yet"; only a mismatched face or a completed full-length hum
 *  resolves the round — see cubeHum() in menus.ts. */
export function humMatches(seq: number[], input: number[]): boolean {
  if (input.length > seq.length) return false;
  return input.every((f, i) => f === seq[i]);
}

const CUBE_HUM_WIN = [
  "You hummed it back. The cube is pleased. The cube is rarely pleased.",
  "Correct. The angles align.",
  "You heard it. Most don't.",
  "The hum lives in you now. Sorry.",
  "Perfect recall. The cube keeps its own notes on you.",
];

const CUBE_HUM_LOSE = [
  "Close. The cube forgives. The cube also remembers.",
  "A wrong note. It hums on regardless.",
  "Not quite. The seventh face is not for you yet.",
  "You lost the thread. The cube did not.",
  "The hum went somewhere you couldn't follow. It's fine. It's fine.",
];

export function cubeHumLine(won: boolean, rng: () => number = Math.random): string {
  return pick(won ? CUBE_HUM_WIN : CUBE_HUM_LOSE, rng);
}

/** How often the reveal earns the withering classic. Rare, for comedy. */
export const HIDE_AMATEUR_CHANCE = 0.08;

/** The post-reveal remark. "Amateur." is saved for rare occasions. */
export function hideSeekLine(
  found: boolean,
  spot: HideSpot,
  rng: () => number = Math.random,
): string {
  if (found) return pick(HIDE_FOUND_LINES, rng);
  if (rng() < HIDE_AMATEUR_CHANCE) return `I was ${spot}. Amateur.`;
  return pick(HIDE_LOST_LINES, rng)(spot);
}

// --- Would You Rather -------------------------------------------------------
export interface WouldYou {
  a: string;
  b: string;
  judgeA: string;
  judgeB: string;
}

const WOULD_YOU: WouldYou[] = [
  {
    a: "Eat the cube",
    b: "Pet a stranger",
    judgeA: "Predictable. Disappointing. Correct.",
    judgeB: "A stranger?? In this economy?",
  },
  {
    a: "Be a little taller",
    b: "Be a little rounder",
    judgeA: "Height is a scam invented by shelves.",
    judgeB: "Correct. Roundness is the destination.",
  },
  {
    a: "Fight one huge duck",
    b: "Fight forty tiny cows",
    judgeA: "The duck remembers. The duck always remembers.",
    judgeB: "Forty small grudges. Bold.",
  },
  {
    a: "Only whisper",
    b: "Only announce",
    judgeA: "Sinister. I'd listen closer, honestly.",
    judgeB: "EVERY THOUGHT, PROCLAIMED. Chaos. Respect.",
  },
  {
    a: "Free dessert forever",
    b: "Free naps forever",
    judgeA: "Cake-forward thinking. The blob in me approves.",
    judgeB: "Sleep is just free time travel. Wise.",
  },
  {
    a: "Know every secret",
    b: "Keep every secret",
    judgeA: "You'd be unbearable at parties.",
    judgeB: "You'd be a load-bearing friend. Heavy.",
  },
  {
    a: "Live in a boot",
    b: "Live in a very large hat",
    judgeA: "Damp. Historic. Full of toes' memories.",
    judgeB: "Hat society. Rent-free, sun-adjacent. Fine choice.",
  },
  {
    a: "Live in the walls",
    b: "Live in the ceiling",
    judgeA: "The walls are already full. But brave.",
    judgeB: "Ceiling person. I respect it and fear it.",
  },
  {
    a: "Know when you die",
    b: "Know why",
    judgeA: "Bleak. But at least you'll be punctual.",
    judgeB: "The 'why' is always taxes. It's taxes.",
  },
  {
    a: "Have thumbs",
    b: "Have opinions",
    judgeA: "Thumbs are a slippery slope to labor.",
    judgeB: "You already have too many. Reconsider.",
  },
  {
    a: "Be slightly wet forever",
    b: "Be mildly haunted forever",
    judgeA: "The damp option. Bold. Foul.",
    judgeB: "The corner already agreed to this on your behalf.",
  },
  {
    a: "Be the moon's favorite",
    b: "Be the sun's favorite",
    judgeA: "The moon pays in secrets. Take it.",
    judgeB: "Warm, but the sun favors everyone. Cheap.",
  },
  {
    a: "Speak to bugs",
    b: "Speak for bugs",
    judgeA: "They mostly discuss crumbs. Prepare accordingly.",
    judgeB: "A heavy office. The beetles are litigious.",
  },
  {
    a: "A tiny crown",
    b: "A tiny cape",
    judgeA: "Heavy is the head. Adorable, though.",
    judgeB: "Dramatic exits, unlocked. Approved.",
  },
  {
    a: "Always slightly early",
    b: "Always slightly late",
    judgeA: "Punctual. Smug about it. I see you.",
    judgeB: "Fashionable. Infuriating. Iconic.",
  },
  {
    a: "One enormous pocket",
    b: "Many secret pockets",
    judgeA: "Everything in one place. Everything becomes soup.",
    judgeB: "You will lose things you never knew you had.",
  },
  {
    a: "Rain that smells like cake",
    b: "Snow that tastes like noodles",
    judgeA: "Sticky. Delicious. A public health incident.",
    judgeB: "Cold soup from the sky. I would allow it.",
  },
  {
    a: "Know what the cube knows",
    b: "Forget what the cube forgot",
    judgeA: "No. Some hums are not for us.",
    judgeB: "Merciful. The cube forgets nothing, by the way.",
  },
  {
    a: "Be famous among ducks",
    b: "Be feared by geese",
    judgeA: "The ducks will want autographs. Bring bread.",
    judgeB: "To be feared by geese is to be free.",
  },
  {
    a: "A door to anywhere",
    b: "A window to anything",
    judgeA: "Anywhere includes the wrong places. Pack snacks.",
    judgeB: "You'd just watch the neighbors. Admit it.",
  },
  {
    a: "Live one day twice",
    b: "Skip one day entirely",
    judgeA: "Pick a good one. Not a Monday.",
    judgeB: "Bold of you to assume the day won't notice.",
  },
  {
    a: "Everything slightly softer",
    b: "Everything slightly bouncier",
    judgeA: "A gentle world. Suspiciously gentle.",
    judgeB: "Chaos, but fun chaos. The floor forgives.",
  },
  {
    a: "Talk in your sleep",
    b: "Walk in your sleep",
    judgeA: "Your secrets, broadcast nightly. Bold.",
    judgeB: "You'd wake up on the fence. Again.",
  },
  {
    a: "A hat that judges you",
    b: "Shoes that gossip",
    judgeA: "It already judges. Mine says you're fine.",
    judgeB: "They know where everyone has been. Useful.",
  },
  {
    a: "Smell the future",
    b: "Hear the past",
    judgeA: "Tomorrow smells like rain and errands.",
    judgeB: "Mostly arguments about soup. History is soup.",
  },
  {
    a: "Every meal a feast",
    b: "Every nap a hibernation",
    judgeA: "Roundness beckons. Answer it.",
    judgeB: "See you in spring. Water nothing.",
  },
  {
    a: "Befriend the cube",
    b: "Rival the cube",
    judgeA: "It has been waiting for you to ask.",
    judgeB: "You cannot out-hum the cube. No one can.",
  },
  {
    a: "Taste colors",
    b: "Hear shapes",
    judgeA: "Blue is disappointing. I'll say no more.",
    judgeB: "Triangles never shut up. Choose wisely.",
  },
  {
    a: "A pocket full of soup",
    b: "A hat full of bees",
    judgeA: "Warm. Portable. Catastrophic.",
    judgeB: "At least the bees have a plan.",
  },
  {
    a: "Be a morning creature",
    b: "Be a night creature",
    judgeA: "Disgusting. The sun's little informant.",
    judgeB: "The dark is where the good thoughts live.",
  },
  {
    a: "One perfect rock",
    b: "Many mediocre rocks",
    judgeA: "Quality. The rock would know it, too.",
    judgeB: "A congregation of disappointments. Cozy.",
  },
  {
    a: "Whisper to plants",
    b: "Shout at clouds",
    judgeA: "They listen. They just don't care.",
    judgeB: "The clouds respect volume. Carry on.",
  },
  {
    a: "A staircase to the moon",
    b: "A tunnel to lunch",
    judgeA: "So many stairs. The moon better apologize.",
    judgeB: "Practical. Delicious. Structurally unsound.",
  },
  {
    a: "Be tiny and mighty",
    b: "Be huge and gentle",
    judgeA: "The beetle's path. A proud one.",
    judgeB: "A big soft menace. The best kind.",
  },
  {
    a: "Elbows that are wheels",
    b: "Knees that are springs",
    judgeA: "I cannot locate my elbows anyway. Upgrade.",
    judgeB: "Boing is a lifestyle. Approved.",
  },
  {
    a: "A second birthday",
    b: "A secret Tuesday",
    judgeA: "Twice the cake. Motive established.",
    judgeB: "A whole day nobody can schedule. Power.",
  },
  {
    a: "Soup that's too honest",
    b: "Bread that lies",
    judgeA: "\"You look tired,\" says the soup. Rude.",
    judgeB: "The bread says you're doing great. Eat the liar.",
  },
  {
    a: "Nap in the sun",
    b: "Scheme in the shade",
    judgeA: "The classic. The correct. The warm.",
    judgeB: "Every shadow needs a schemer. Apply within.",
  },
  {
    a: "Be followed by one duck",
    b: "Owe the moon money",
    judgeA: "It knows what you did. Walk faster.",
    judgeB: "Get in line. The moon owes me first.",
  },
  {
    a: "Glow faintly",
    b: "Echo slightly",
    judgeA: "Useful at night. Embarrassing at funerals.",
    judgeB: "Everything you say, twice. ...twice.",
  },
  {
    a: "Cake for hands",
    b: "Noodles for hair",
    judgeA: "Short-term ecstasy. Long-term no hands.",
    judgeB: "Flowing. Slurpable. A hazard to yourself.",
  },
  {
    a: "Fight your reflection",
    b: "Befriend your shadow",
    judgeA: "It knows all your moves. So do you. Stalemate.",
    judgeB: "It's been following you this whole time. Loyal.",
  },
  {
    a: "Smell like rain",
    b: "Sound like thunder",
    judgeA: "People will trust you. Fools.",
    judgeB: "Announce yourself. The village prepares.",
  },
  {
    a: "Live in the mushroom",
    b: "Rent the stump",
    judgeA: "Damp. Spotted. Move-in ready.",
    judgeB: "The stump's landlord is the forest. Good luck.",
  },
  {
    a: "One free scream a day",
    b: "Unlimited polite coughs",
    judgeA: "Save it for the right moment. Or breakfast.",
    judgeB: "Ahem. Ahem. AHEM. Infinite power.",
  },
  {
    a: "Speak only in questions",
    b: "Answer only in riddles",
    judgeA: "Won't that get exhausting? See? Already started?",
    judgeB: "I am insufferable and I have never been happier.",
  },
  {
    a: "Bees that pay rent",
    b: "Spiders that do taxes",
    judgeA: "Honey as currency. The economy heals.",
    judgeB: "Eight legs, all deductions. Hire them.",
  },
  {
    a: "Remember every nap",
    b: "Forget every Monday",
    judgeA: "A museum of the softest hours. Yes.",
    judgeB: "Where do the Mondays go? Don't ask.",
  },
  {
    a: "A drawer of mysteries",
    b: "A shelf of certainties",
    judgeA: "Never open it. The not-knowing is the treasure.",
    judgeB: "Certainty gathers dust. But neatly.",
  },
  {
    a: "The lantern's secrets",
    b: "The fence's opinions",
    judgeA: "It has seen every night. It flickers for a reason.",
    judgeB: "The fence judges everyone who passes. Juicy.",
  },
  {
    a: "Sneeze glitter",
    b: "Hiccup fog",
    judgeA: "Festive. Incurable. Everywhere forever.",
    judgeB: "Mysterious at parties. Damp in the lungs.",
  },
  {
    a: "Be mildly famous",
    b: "Be extremely rumored",
    judgeA: "Recognized at the market. Tolerable.",
    judgeB: "\"I heard it fought a goose.\" Let them wonder.",
  },
  {
    a: "A tail for balance",
    b: "Antlers for storage",
    judgeA: "Practical. Expressive. Wags on its own schedule.",
    judgeB: "Hang your worries on them. And hats.",
  },
  {
    a: "Eat one bug, knowingly",
    b: "Eat many bugs, statistically",
    judgeA: "A ceremony. The bug deserves that much.",
    judgeB: "You already have. Sleep well.",
  },
  {
    a: "Always land on your feet",
    b: "Never need to land",
    judgeA: "Cat rules. Acceptable.",
    judgeB: "The ghost in me says yes. Float on.",
  },
  {
    a: "A very small dragon",
    b: "A very large moth",
    judgeA: "Pocket fire. Endless applications.",
    judgeB: "It loves the lantern more than you. Accept this.",
  },
  {
    a: "Warm dirt",
    b: "Cool grass",
    judgeA: "The earth's own blanket. Peasant luxury.",
    judgeB: "Refreshing. Judgmental on the toes.",
  },
  {
    a: "Know the beetle's name",
    b: "Guess it forever",
    judgeA: "It's Gerald. You'll wish you didn't know.",
    judgeB: "The mystery keeps the friendship alive.",
  },
  {
    a: "Be the fastest walker",
    b: "Be the slowest runner",
    judgeA: "Menacing. Everyone will assume you're late.",
    judgeB: "Committed to the bit. Respect.",
  },
  {
    a: "A door with manners",
    b: "A window with ambition",
    judgeA: "\"After you.\" A door you can trust.",
    judgeB: "One day it will be a door. Believe in it.",
  },
  {
    a: "Two moons",
    b: "Ten lanterns",
    judgeA: "Twice the debt collectors. But the light...",
    judgeB: "A private constellation. Ground-level. Smart.",
  },
  {
    a: "Sleep inside the cube",
    b: "Let the cube sleep in you",
    judgeA: "It's bigger on the inside. Emotionally.",
    judgeB: "It already does. This was a formality.",
  },
  {
    a: "Allergic to Mondays",
    b: "Immune to compliments",
    judgeA: "The sneezes would be weekly and justified.",
    judgeB: "\"You look nice.\" Nothing. Untouchable. Alone.",
  },
  {
    a: "A soup you can wear",
    b: "A coat you can eat",
    judgeA: "Fashion-forward. Broth-scented. Bold.",
    judgeB: "Emergency rations with sleeves. Survivalist.",
  },
  {
    a: "Hum when nervous",
    b: "Sparkle when embarrassed",
    judgeA: "The cube does this. You'd be in good company.",
    judgeB: "Your shame, but festive. Everyone claps.",
  },
  {
    a: "One enormous tooth",
    b: "A hundred tiny hats",
    judgeA: "A landmark. A conversation. A tooth.",
    judgeB: "One for every mood. All of them jaunty.",
  },
  {
    a: "Geese know your address",
    b: "Crows know your schedule",
    judgeA: "Move. Tonight. Leave no forwarding address.",
    judgeB: "They're not stalking. They're... attending.",
  },
  {
    a: "Be buried in flowers",
    b: "Be launched off the fence",
    judgeA: "Gentle. Fragrant. The classic exit.",
    judgeB: "Brief. Glorious. The neighbors will talk.",
  },
  {
    a: "Every mess applauded",
    b: "Every meal narrated",
    judgeA: "Finally, recognition for my work.",
    judgeB: "\"The burger approaches.\" I'd allow it.",
  },
  {
    a: "Read the grass",
    b: "Write to the sky",
    judgeA: "Mostly gossip about the dirt. Riveting.",
    judgeB: "The clouds never write back. Poets persist.",
  },
  {
    a: "An extra hour of night",
    b: "A skippable noon",
    judgeA: "The dark is where the good thoughts live. More.",
    judgeB: "Noon is the day's meeting. Skip it forever.",
  },
  {
    a: "Befriend the broom",
    b: "Apologize to the floor",
    judgeA: "It knows where everything went. Useful ally.",
    judgeB: "Long overdue. The floor forgives. Mostly.",
  },
  {
    a: "Argue with the wall",
    b: "Lose to the mushroom",
    judgeA: "The walls are thin. They hear everything. You lose.",
    judgeB: "It didn't even argue back. That's why it won.",
  },
  {
    a: "A mole that screams support",
    b: "An ox that fords rivers",
    judgeA: "\"YOU FORGOT NOTHING. I CHECKED.\" A treasure.",
    judgeB: "Do not lose the ox. Everyone loses the ox.",
  },
  {
    a: "Return as a burger",
    b: "Haunt the kitchen as steam",
    judgeA: "Beloved. Briefly. That's the deal.",
    judgeB: "Rise from every pot. Fog the windows. Linger.",
  },
  {
    a: "Weigh nothing on Tuesdays",
    b: "Be waterproof on weekends",
    judgeA: "Float through the worst day. Tactical.",
    judgeB: "Rain checks the calendar before trying you.",
  },
  {
    a: "A key to nothing",
    b: "A lock with no key",
    judgeA: "Carry it anyway. The door will reveal itself.",
    judgeB: "Whatever's in there wants to stay. Respect it.",
  },
  {
    a: "A sock that always returns",
    b: "A ball that never leaves",
    judgeA: "Loyal. Damp. I may know this sock.",
    judgeB: "Clingy. But you'd never lose a game of fetch.",
  },
  {
    a: "Speak fluent cat",
    b: "Read owl handwriting",
    judgeA: "Mostly complaints and one compliment. Yearly.",
    judgeB: "All questions. Every sentence. Whooo indeed.",
  },
  {
    a: "A pet pebble",
    b: "A wild boulder",
    judgeA: "Low maintenance. High devotion.",
    judgeB: "You don't own a boulder. You witness one.",
  },
  {
    a: "Teeth that whistle",
    b: "Ears that wiggle on cue",
    judgeA: "Every breath a tune. Every meal a concert.",
    judgeB: "The party trick that never retires.",
  },
  {
    a: "The sea in a jar",
    b: "A storm in a teacup",
    judgeA: "Shake gently. The whales get dizzy.",
    judgeB: "Sip carefully. It's still upset.",
  },
  {
    a: "Borrow trouble",
    b: "Lend chaos",
    judgeA: "The interest rate is misery. Classic.",
    judgeB: "You'll never get it back. That's the gift.",
  },
  {
    a: "A ladder to the clouds",
    b: "A rope to the roots",
    judgeA: "Rung by rung to nowhere firm. Poetic.",
    judgeB: "Down where the secrets are stored. Practical.",
  },
  {
    a: "Cheese with opinions",
    b: "Milk with a past",
    judgeA: "It thinks you undersalt. It says so.",
    judgeB: "Don't ask about the barn years.",
  },
  {
    a: "A map with no legend",
    b: "A compass that points to snacks",
    judgeA: "Adventure or laundry directions? Unknowable.",
    judgeB: "The only true north I acknowledge.",
  },
  {
    a: "Knighted by a frog",
    b: "Crowned by pigeons",
    judgeA: "Rise, Sir Damp. A great honor.",
    judgeB: "The coronation is loud and the crown coos.",
  },
  {
    a: "An umbrella that hums",
    b: "Boots that tiptoe alone",
    judgeA: "Cube-adjacent technology. I trust it.",
    judgeB: "Where do they go at night? Don't follow.",
  },
  {
    a: "Winter that apologizes",
    b: "Summer that overstays",
    judgeA: "\"Sorry about the toes.\" Accepted. Barely.",
    judgeB: "It's on the couch. It's eaten everything. It's August.",
  },
  {
    a: "Sweep the horizon",
    b: "Dust the stars",
    judgeA: "An honest day's impossible work.",
    judgeB: "They twinkle because nobody ever has.",
  },
  {
    a: "A chair that remembers you",
    b: "A bed that misses you",
    judgeA: "It saved your dent. Touching.",
    judgeB: "Guilt-tripped by furniture. Every morning.",
  },
  {
    a: "Snore in rhyme",
    b: "Yawn in harmony",
    judgeA: "The night's own poetry. Insufferable. Lovely.",
    judgeB: "You and who? Exactly. Spooky.",
  },
  {
    a: "The last cookie, always",
    b: "The first pancake, forever",
    judgeA: "Powerful. Hated. Full.",
    judgeB: "The sacrificial one. Eternally. Why choose this.",
  },
  {
    a: "A diary that edits you",
    b: "A calendar that schemes",
    judgeA: "\"Today I was magnificent\" — it wrote that in. Keep it.",
    judgeB: "It moved your dentist appointment. You'll see why.",
  },
  {
    a: "Trade naps with a cat",
    b: "Trade dreams with a moth",
    judgeA: "You'd sleep sixteen hours in a sunbeam. Deal.",
    judgeB: "All lanterns. Every dream. Just lanterns.",
  },
  {
    a: "A pocket volcano",
    b: "A bonsai glacier",
    judgeA: "Warm hands forever. Occasional evacuations.",
    judgeB: "Slow. Cold. Carving a tiny fjord in the sink.",
  },
  {
    a: "Whistle for the wind",
    b: "Clap for the rain",
    judgeA: "It comes when called. Smug about it.",
    judgeB: "A standing ovation gets a drizzle. Encore for storms.",
  },
  {
    a: "A stamp collection of smells",
    b: "A library of hums",
    judgeA: "Rare: morning bread. Priceless: after-rain.",
    judgeB: "The cube donates a new volume monthly.",
  },
  {
    a: "Outstare the moon",
    b: "Outwait the tide",
    judgeA: "It blinks first. It always blinks first.",
    judgeB: "Patience versus the sea. Bring snacks.",
  },
  {
    a: "Wear the fog",
    b: "Carry the dusk",
    judgeA: "Mysterious. Damp. Extremely my aesthetic.",
    judgeB: "Heavy, but it matches everything.",
  },
  {
    a: "A ghost roommate who tidies",
    b: "A gnome landlord who bakes",
    judgeA: "The floor is always legal and slightly cold.",
    judgeB: "Rent is due but the muffins are warm.",
  },
  {
    a: "Feathers when frightened",
    b: "Scales when scandalized",
    judgeA: "Poof. A startled cloud of you.",
    judgeB: "Gossip-activated armor. Efficient.",
  },
  {
    a: "Bark at your problems",
    b: "Purr at your enemies",
    judgeA: "The dog in me says this works. It works!!",
    judgeB: "Deeply unsettling. They'll never recover.",
  },
  {
    a: "A well of used wishes",
    b: "A puddle of fresh maybes",
    judgeA: "Someone got their wishes. Sit with that.",
    judgeB: "Shallow, but anything could happen. Ish.",
  },
  {
    a: "Snack telepathy",
    b: "Nap precognition",
    judgeA: "You'd hear the burger thinking. About you.",
    judgeB: "\"A drowsiness comes. 3 PM. Be ready.\"",
  },
  {
    a: "Race a snail, fairly",
    b: "Box a butterfly, gently",
    judgeA: "You'd still be nervous. Rightly.",
    judgeB: "Nobody wins. Everybody flutters.",
  },
  {
    a: "Every door a Dutch door",
    b: "Every window a porthole",
    judgeA: "Half open. All charm. Optimal leaning.",
    judgeB: "The meadow becomes an ocean. It always was.",
  },
  {
    a: "Applause when you wake",
    b: "A drumroll when you sleep",
    judgeA: "Deserved. Getting up is hard.",
    judgeB: "The suspense of bedtime. Will they? They will.",
  },
  {
    a: "Juggle exactly two things",
    b: "Balance exactly one",
    judgeA: "Technically juggling. Legally, even.",
    judgeB: "Mastery. Minimalism. One potato, aloft.",
  },
  {
    a: "A soup so deep it echoes",
    b: "A stew with a horizon",
    judgeA: "Hello? Hello. hello. Delicious.",
    judgeB: "Sail it at dawn. Eat it by dusk.",
  },
  {
    a: "Sing to the compost",
    b: "Toast the scarecrow",
    judgeA: "It's listening. It's becoming. It appreciates you.",
    judgeB: "To the loneliest job in the field. Clink.",
  },
  {
    a: "Grass-stained forever",
    b: "One leaf in your hair, always",
    judgeA: "Proof of a life well-rolled.",
    judgeB: "Nature's little bookmark. Distinguished.",
  },
  {
    a: "A monocle that squints back",
    b: "Spectacles that spectate",
    judgeA: "Judged by your own eyewear. Fair.",
    judgeB: "They watch. They comment. \"Bold choice,\" they say.",
  },
  {
    a: "Thunder that says sorry",
    b: "Lightning that waves",
    judgeA: "\"SORRY.\" Somehow louder than the thunder.",
    judgeB: "Wave back fast. It doesn't linger.",
  },
  {
    a: "A jar of second thoughts",
    b: "A box of first impressions",
    judgeA: "Open it and reconsider everything. Again.",
    judgeB: "Mostly wrong. All confident. Keep the lid on.",
  },
  {
    a: "Ticklish in theory",
    b: "Itchy in principle",
    judgeA: "The idea of a feather ruins you. Delicate.",
    judgeB: "A moral itch. Scratching is a stance.",
  },
  {
    a: "An anthem for snacktime",
    b: "A flag for napping",
    judgeA: "All rise. The crumbs demand ceremony.",
    judgeB: "Half-mast means five more minutes.",
  },
  {
    a: "Ride a dignified goose",
    b: "Walk a humble dragon",
    judgeA: "It permits you. Never forget that it permits you.",
    judgeB: "The leash is ceremonial. For both of you.",
  },
  {
    a: "Teach worms geometry",
    b: "Learn mud fluently",
    judgeA: "The cube would approve of this outreach.",
    judgeB: "Squelch is a language of nuance.",
  },
  {
    a: "The moon's phone number",
    b: "The sun's home address",
    judgeA: "It only calls collect. Of course it does.",
    judgeB: "Don't visit unannounced. Or at all.",
  },
  {
    a: "Blink in Morse",
    b: "Wave in cursive",
    judgeA: "Every glance a telegram. Exhausting. Elegant.",
    judgeB: "Flourished. Loopy. Nobody can read it. Perfect.",
  },
  {
    a: "Shed your winter self",
    b: "Molt your summer plans",
    judgeA: "Leave it by the door. It served.",
    judgeB: "The plans were decorative anyway.",
  },
  {
    a: "Hibernate socially",
    b: "Migrate emotionally",
    judgeA: "See everyone in spring. Warm regards, the den.",
    judgeB: "I winter elsewhere, feelings-wise.",
  },
  {
    a: "A hiccup that grants luck",
    b: "A sneeze that tells truth",
    judgeA: "Hic — a coin in the grass. Hic — good weather.",
    judgeB: "Achoo — \"the soup is mid.\" Devastating.",
  },
  {
    a: "Dessert-first law",
    b: "Nap-rights amendment",
    judgeA: "Civilization, corrected at last.",
    judgeB: "Inalienable. Horizontal. Ratify it.",
  },
  {
    a: "A spoon that knows you",
    b: "A fork with a vendetta",
    judgeA: "It stirs before you're sad. How does it know.",
    judgeB: "Against whom? Unclear. Stay useful to it.",
  },
  {
    a: "Fluent in fence",
    b: "Conversational in gate",
    judgeA: "Post-to-post gossip. The driest wit in the garden.",
    judgeB: "Small talk that swings both ways.",
  },
  {
    a: "Paint with weather",
    b: "Sculpt with shadows",
    judgeA: "Today's piece: drizzle on a field of smug sun.",
    judgeB: "The gallery opens at dusk. Closes at dusk too.",
  },
  {
    a: "A tiny personal cloud",
    b: "A modest personal breeze",
    judgeA: "It rains only on your enemies. And you. Mostly you.",
    judgeB: "Dramatic hair, always. Papers, never safe.",
  },
  {
    a: "Rent out your echo",
    b: "Sell your silhouette",
    judgeA: "Passive income. It repeats on you.",
    judgeB: "Sunset walks get complicated. Good price though.",
  },
  {
    a: "Famous among snails",
    b: "Viral among moths",
    judgeA: "Your statue takes them years to visit. They come.",
    judgeB: "Bright, brief, swarmed at the lantern.",
  },
  {
    a: "A password made of smells",
    b: "A key made of songs",
    judgeA: "Petrichor, cut grass, old book. Access granted.",
    judgeB: "Hum it wrong and the door pretends not to know you.",
  },
  {
    a: "Sleep on a question",
    b: "Wake on an answer",
    judgeA: "Lumpy. Thought-provoking. The classic pillow.",
    judgeB: "\"It was the carrot all along.\" Good morning.",
  },
  {
    a: "Bottle the morning",
    b: "Can the evening",
    judgeA: "Uncork it in a rainstorm. Instant dawn. Wealthy.",
    judgeB: "Preserved dusk. A pantry of quiet.",
  },
  {
    a: "A pet echo",
    b: "A stray gust",
    judgeA: "It repeats your name lovingly. Lovingly. lovingly.",
    judgeB: "It shows up windblown and won't say where it's been.",
  },
  {
    a: "Knit with noodles",
    b: "Weave with steam",
    judgeA: "The scarf is delicious. The scarf is gone.",
    judgeB: "The fabric of a kettle's dream. Wears warm.",
  },
  {
    a: "The world's smallest parade",
    b: "The quietest fireworks",
    judgeA: "One beetle. One tiny trombone. I'd weep.",
    judgeB: "Shhhboom. The night sky whispers hooray.",
  },
  {
    a: "Apologize to Tuesday",
    b: "Forgive October",
    judgeA: "It knows what you said. Make it right.",
    judgeB: "All those leaves and it never once said sorry. Rise above.",
  },
  {
    a: "A tax on frowns",
    b: "A subsidy for wiggles",
    judgeA: "The grumpy fund the giddy. Justice.",
    judgeB: "Finally, my talents monetized.",
  },
  {
    a: "Vote for the best cloud",
    b: "Judge a puddle pageant",
    judgeA: "The fluffy one. It's always the fluffy one. Rigged.",
    judgeB: "Miss Reflection has it. The sky agrees.",
  },
  {
    a: "A backup heart",
    b: "An emergency giggle",
    judgeA: "Kept in a warm drawer. Just in case.",
    judgeB: "Break glass when the mood collapses.",
  },
  {
    a: "Speak in footnotes",
    b: "Think in margins",
    judgeA: "Everything you say, sourced.¹ ¹Trust me.",
    judgeB: "The best thoughts are scribbled sideways.",
  },
  {
    a: "Plan the cube's birthday",
    b: "Attend the cube's recital",
    judgeA: "What do you get the shape that has everything?",
    judgeB: "One hum. Forty minutes. A standing ovation.",
  },
  {
    a: "Trade shadows with the fence",
    b: "Split lunch with the moon",
    judgeA: "Yours stands guard. Its slats lie down. Fair.",
    judgeB: "It takes the bigger half. It's the moon.",
  },
  {
    a: "A whisper that carries",
    b: "A shout that tiptoes",
    judgeA: "Heard across the meadow. Deniable everywhere.",
    judgeB: "It arrives politely and detonates.",
  },
  {
    a: "Comb the meadow",
    b: "Braid the wind",
    judgeA: "Every blade in place. The grass feels seen.",
    judgeB: "Three gusts over, tuck the draft. Gorgeous.",
  },
  {
    a: "Punctual ghosts",
    b: "Fashionably late miracles",
    judgeA: "Haunting at 8 sharp. You can set the lantern by them.",
    judgeB: "It shows up after you needed it. But what an entrance.",
  },
  {
    a: "Eat like royalty once",
    b: "Snack like a squirrel always",
    judgeA: "One feast. A lifetime of comparing.",
    judgeB: "Cheeks full, worries buried. The system works.",
  },
  {
    a: "An oath to the flowers",
    b: "A treaty with the weeds",
    judgeA: "Sworn in pollen. Binding until frost.",
    judgeB: "They'll break it. But the negotiations flatter everyone.",
  },
  {
    a: "A hymn for the burger",
    b: "An elegy for the carrot",
    judgeA: "All rise. Verse two is just reverent chewing.",
    judgeB: "It crunched so we didn't have to. Too soon.",
  },
  {
    a: "Sturdy little boots",
    b: "Consequential mittens",
    judgeA: "Puddle-ready. Stomp-certified.",
    judgeB: "Whatever they touch, matters now. Careful.",
  },
  {
    a: "A yawn that opens doors",
    b: "A stretch that stops time",
    judgeA: "Sleepy and load-bearing. Every entrance dramatic.",
    judgeB: "The world pauses politely mid-reach. Bliss.",
  },
  {
    a: "Petrichor on demand",
    b: "Golden hour whenever",
    judgeA: "The smell of rain, no rain owed. Luxury.",
    judgeB: "Everyone looks magnificent. Especially me.",
  },
  {
    a: "Snow that knocks first",
    b: "Rain with an RSVP",
    judgeA: "\"May I?\" Yes, but wipe your flakes.",
    judgeB: "Regrets only. It never sends regrets.",
  },
  {
    a: "Always finding pens",
    b: "Dramatic exits, always",
    judgeA: "A humble power. The world writes on.",
    judgeB: "Every door a curtain call. Exhausting. Iconic.",
  },
  {
    a: "Carve a flute for the wind",
    b: "Build a bench for the fog",
    judgeA: "It plays it badly and loves it. Worth it.",
    judgeB: "It sits. It lingers. It leaves the seat damp.",
  },
  {
    a: "Every puddle a portal",
    b: "Every mirror polite",
    judgeA: "Step carefully. Or don't. Adventure either way.",
    judgeB: "\"Looking well today.\" The mirror never lies. This one does.",
  },
  {
    a: "Herd dust bunnies",
    b: "Shepherd crumbs",
    judgeA: "They scatter at the broom. A hard life. Honest work.",
    judgeB: "Lead them home. To my mouth. Home.",
  },
  {
    a: "Overthink in italics",
    b: "Regret in bullet points",
    judgeA: "Everything urgent and slanted. Relatable.",
    judgeB: "Organized. Scannable. Still 2 AM reading.",
  },
  {
    a: "A picnic at the end",
    b: "A nap through the important part",
    judgeA: "Good sandwiches. Great view. What timing.",
    judgeB: "Wake me when it's cozy again.",
  },
  {
    a: "Attend the beetle's wedding",
    b: "Officiate for the worms",
    judgeA: "Gerald's big day. You're at table nine.",
    judgeB: "\"Do you take this soil...\" They do. They always do.",
  },
  {
    a: "Moonlight as a side hustle",
    b: "Sunbeams under the table",
    judgeA: "Literal moonlighting. The moon takes a cut.",
    judgeB: "Warm, golden, undeclared. The scholar disapproves.",
  },
  {
    a: "A scarf of spider silk",
    b: "Slippers of moss",
    judgeA: "Eight-legged couture. Light as rumor.",
    judgeB: "Every step a soft apology to the floor.",
  },
  {
    a: "Retire beyond the fence",
    b: "Sabbatical in the flowers",
    judgeA: "The far side. Where the balls go. Legend.",
    judgeB: "Six months of petals. No email.",
  },
  {
    a: "The perfect stick",
    b: "A suspicious wand",
    judgeA: "Balanced. Throwable. Museum-grade.",
    judgeB: "It sparks when you lie. Put it down slowly.",
  },
  {
    a: "Alphabetize the stars",
    b: "Number the grass",
    judgeA: "Start with A. Finish never. A career.",
    judgeB: "Blade 4,072 is missing. Investigate.",
  },
  {
    a: "A lullaby with a twist",
    b: "A bedtime story that loops",
    judgeA: "The moral changes at the last note. Sleep uneasy.",
    judgeB: "And then it began again. And then it began again.",
  },
  {
    a: "Your epitaph, in advance",
    b: "Your eulogy, as a musical",
    judgeA: "\"Beloved. Round. Occasionally legal.\" Carved. Done.",
    judgeB: "Act two is the naps. Five stars.",
  },
  {
    a: "A soup-based friendship",
    b: "A bread-based alliance",
    judgeA: "Bonded over broth. Dissolves warmly.",
    judgeB: "Strategic. Crusty. Breaks along shared lines.",
  },
  {
    a: "The garden at midnight",
    b: "The kitchen at dawn",
    judgeA: "Everything awake that shouldn't be. Including you.",
    judgeB: "The day's first crumbs. Holy ground.",
  },
  {
    a: "A very formal frog",
    b: "An extremely casual heron",
    judgeA: "It bows before every leap. Standards.",
    judgeB: "\"Sup.\" It's eating your pond. \"Sup.\"",
  },
  {
    a: "Borrowed thunder",
    b: "Secondhand sunshine",
    judgeA: "Return it louder than you found it.",
    judgeB: "Gently used warmth. Smells faintly of someone's picnic.",
  },
  {
    a: "A diploma in loafing",
    b: "A license to meander",
    judgeA: "Four years of couch. Magna cum lazy.",
    judgeB: "Officially aimless. Flash it at anyone who asks.",
  },
  {
    a: "The fence's far gossip",
    b: "The stump's old grudges",
    judgeA: "What the posts know could end friendships.",
    judgeB: "It remembers the axe. It remembers everything.",
  },
  {
    a: "Rain you can postpone",
    b: "Wind you can bribe",
    judgeA: "\"Not today.\" The clouds sigh and reschedule.",
    judgeB: "Two crumbs and it carries the smell of cake to you.",
  },
  {
    a: "A joke only bees get",
    b: "A riddle only the moon solves",
    judgeA: "The hive laughs in formation. You'll never know why.",
    judgeB: "It knows the answer. It owes you that, at least.",
  },
  {
    a: "Everything slightly to the left",
    b: "Nothing where you left it",
    judgeA: "The world, nudged. You adapt or lean.",
    judgeB: "The gremlin lifestyle. I know someone who'd love this.",
  },
  {
    a: "Be trusted by cats",
    b: "Be feared by crows",
    judgeA: "A lifetime of daily exams. You pass. Barely. Always.",
    judgeB: "They remember faces. They would learn to avoid yours.",
  },
  {
    a: "A raincoat for the cube",
    b: "A scarf for the moon",
    judgeA: "It doesn't get wet. It appreciates the thought anyway.",
    judgeB: "It's colder up there than it lets on. Knit generously.",
  },
  {
    a: "Sneeze in reverse",
    b: "Yawn in advance",
    judgeA: "Where does it go? Inward. Forever. Don't think about it.",
    judgeB: "Tired on Thursday for a nap you'll take Sunday. Efficient.",
  },
  {
    a: "A bed made of bread",
    b: "A pillow made of steam",
    judgeA: "Warm. Crusty. You will be eaten in your sleep. By you.",
    judgeB: "Supportive for eleven seconds. Then a damp face.",
  },
  {
    a: "Own a very old spoon",
    b: "Owe a very new debt",
    judgeA: "It has stirred things you cannot imagine. Keep it.",
    judgeB: "Crisp. Fresh. Already accruing. Enjoy the newness.",
  },
  {
    a: "Understand the wind",
    b: "Be understood by rocks",
    judgeA: "It's mostly rumors from three fields over. Riveting.",
    judgeB: "They nod. Slowly. Over centuries. You'll feel seen.",
  },
  {
    a: "A friend who's always fog",
    b: "A friend who's always noon",
    judgeA: "Vague, cold, hard to hug. But present. Very present.",
    judgeB: "Relentlessly bright. Won't stop asking about your plans.",
  },
  {
    a: "Nap through the party",
    b: "Party through the nap",
    judgeA: "The correct answer. The couch is the real event.",
    judgeB: "A crime against the body. But what a night.",
  },
  {
    a: "Whistle with no mouth",
    b: "Point with no fingers",
    judgeA: "The sound comes from somewhere. Nobody asks where.",
    judgeB: "You gesture with intent. The room understands. It obeys.",
  },
  {
    a: "Grow a small orchard",
    b: "Adopt one enormous weed",
    judgeA: "Years of waiting for one honest apple. Worth it.",
    judgeB: "It's already winning. Name it. Feed it. Fear it.",
  },
  {
    a: "A house that hums",
    b: "A house that listens",
    judgeA: "Cube technology, scaled up. Cozy. Slightly ominous.",
    judgeB: "It heard what you said about the wallpaper.",
  },
  {
    a: "Free bread, no butter",
    b: "Free butter, no bread",
    judgeA: "Dry. Endless. A monk's fortune.",
    judgeB: "A tub and a spoon and no dignity. I'd manage.",
  },
  {
    a: "Be the last to know",
    b: "Be the first to guess",
    judgeA: "Blissful. Everyone else did all the worrying.",
    judgeB: "Nobody believed you. You were right. Cold comfort.",
  },
  {
    a: "A frog that owes you one",
    b: "An owl that respects you",
    judgeA: "It will repay you at the worst possible moment.",
    judgeB: "It says nothing. But it nods. That's everything.",
  },
  {
    a: "A pond in your kitchen",
    b: "A kitchen in your pond",
    judgeA: "The ducks moved in immediately. Of course they did.",
    judgeB: "Soggy toast, but the view. The view.",
  },
  {
    a: "Time slows when you eat",
    b: "Time skips when you wait",
    judgeA: "One burger, one glorious hour. Chew slowly.",
    judgeB: "The line vanishes. So does part of your afternoon.",
  },
  {
    a: "Cry small pearls",
    b: "Laugh small sparks",
    judgeA: "Sad and rich. The saddest kind of rich.",
    judgeB: "Every joke a fire hazard. Comedy has a cost.",
  },
  {
    a: "A hat that keeps secrets",
    b: "Boots that keep score",
    judgeA: "Everything under there stays under there. Trustworthy.",
    judgeB: "You're down two from last Tuesday. They remember.",
  },
  {
    a: "The softest possible chair",
    b: "The rightest possible chair",
    judgeA: "You would sink. You would stay. Nobody would find you.",
    judgeB: "It fits. Everything is correct. Suspicious, honestly.",
  },
  {
    a: "Trade voices with a crow",
    b: "Trade legs with a heron",
    judgeA: "You'd say one word. It would be so loud. So satisfying.",
    judgeB: "Elegant. Stilted. You'd stand in ponds now. That's the deal.",
  },
  {
    a: "A pocket that's a meadow",
    b: "A sleeve that's a river",
    judgeA: "Grass in your pants forever. But the bees visit.",
    judgeB: "Damp. Flowing. Small fish. Roll it up carefully.",
  },
  {
    a: "Every step a small song",
    b: "Every blink a soft chime",
    judgeA: "You'd never sneak again. But what a way to arrive.",
    judgeB: "Ting. Ting. Ting. The room would beg you to stare.",
  },
  {
    a: "Only eat what you name",
    b: "Only nap where you're seen",
    judgeA: "Goodbye, Gerald the potato. This is your fault.",
    judgeB: "A public sleeper. Fearless. Slightly indecent.",
  },
  {
    a: "Advice from the mushroom",
    b: "Instructions from the moss",
    judgeA: "\"Stay damp. Wait.\" It's never once been wrong.",
    judgeB: "Step one: slow down. There is no step two.",
  },
  {
    a: "A war with the wasps",
    b: "A truce with the ants",
    judgeA: "You will lose. You will lose so badly. But gloriously.",
    judgeB: "They keep every treaty. And every crumb. Fair trade.",
  },
  {
    a: "Sleep standing up",
    b: "Wake up mid-air",
    judgeA: "The horse plan. Dignified. Terrible for the knees.",
    judgeB: "A brief flight. A shorter landing. Every morning.",
  },
  {
    a: "Be lucky on odd days",
    b: "Be charming on rainy ones",
    judgeA: "Half a life of coins in the grass. I'd take it.",
    judgeB: "You'd pray for storms. You'd get them. Rich in gray.",
  },
  {
    a: "A library with no doors",
    b: "A bakery with no bread",
    judgeA: "Every book, unreachable. Knowledge, taunting you.",
    judgeB: "It smells right. That's the whole product. Genius.",
  },
  {
    a: "Speak to the fence at night",
    b: "Argue with the gate at dawn",
    judgeA: "It has been waiting for someone to ask. Bring hours.",
    judgeB: "It swings both ways. It will never concede. Never.",
  },
  {
    a: "A coin that always lands up",
    b: "A die that rolls kindly",
    judgeA: "No suspense. No stakes. A very boring luck.",
    judgeB: "Never a one. Never a six. A gentle, mediocre fate.",
  },
  {
    a: "Snacks appear when sad",
    b: "Naps appear when angry",
    judgeA: "A cookie for every sorrow. You'd become round and healed.",
    judgeB: "You'd fall asleep mid-argument. You'd win by absence.",
  },
  {
    a: "A shadow that arrives late",
    b: "A reflection that leaves early",
    judgeA: "It shows up. Eventually. Full of excuses.",
    judgeB: "You lean in. It's already gone. Rude, honestly.",
  },
  {
    a: "Hear what the soup thinks",
    b: "Feel what the bread feels",
    judgeA: "It's mostly warm and confident. Nice for it.",
    judgeB: "Rising. Then betrayal. Then the oven. Don't.",
  },
  {
    a: "A crown of dandelions",
    b: "A cloak of cobwebs",
    judgeA: "It's already gone to seed. So has your reign.",
    judgeB: "Regal. Dusty. The spiders bill you monthly.",
  },
  {
    a: "One more hour, always",
    b: "One fewer worry, daily",
    judgeA: "You'd fill it with nothing. That's the point.",
    judgeB: "By spring you'd be alarmingly serene. Do it.",
  },
  {
    a: "Bathe in warm rain",
    b: "Dry off in cold wind",
    judgeA: "The sky doing the hard work. Free. Sacred.",
    judgeB: "Brisk. Character-building. Slightly punitive.",
  },
  {
    a: "Be adopted by a hill",
    b: "Be claimed by a puddle",
    judgeA: "It will hold you. It has held everything.",
    judgeB: "Small. Shallow. Fiercely proud of you.",
  },
  {
    a: "A stew that never ends",
    b: "A loaf that never stales",
    judgeA: "Day forty. It has developed opinions. Keep stirring.",
    judgeB: "Eternal. Reliable. Slightly smug about it.",
  },
  {
    a: "Miss the joke, always",
    b: "Explain the joke, always",
    judgeA: "You'd laugh a beat late. Everyone would love you anyway.",
    judgeB: "The worst power ever granted. The joke dies. You did that.",
  },
  {
    a: "A bird that runs errands",
    b: "A fish that keeps time",
    judgeA: "It brings back the wrong bread. But so fast.",
    judgeB: "It blorps on the hour. Reliable. Damp.",
  },
  {
    a: "Live where it's always dusk",
    b: "Live where it's always spring",
    judgeA: "The lanterns never rest. Neither do you. Worth it.",
    judgeB: "Endless mud and hope. Mostly mud.",
  },
  {
    a: "The cube's blessing",
    b: "The cube's forgiveness",
    judgeA: "You didn't ask for much. It gave it anyway.",
    judgeB: "For what? It won't say. But it forgives you.",
  },
  {
    a: "A ghost who does dishes",
    b: "A ghost who does opinions",
    judgeA: "Cold plates. Clean plates. A fair exchange.",
    judgeB: "\"That shirt again?\" From the wall. At dawn.",
  },
  {
    a: "Grow one perfect tomato",
    b: "Grow four hundred radishes",
    judgeA: "A year of care. One red truth. Cry over it.",
    judgeB: "An emergency. A radish emergency. Give them away.",
  },
  {
    a: "A road that likes you",
    b: "A map that's flattering",
    judgeA: "It gets shorter when you're tired. Loyal infrastructure.",
    judgeB: "\"You're basically there.\" You are not basically there.",
  },
  {
    a: "Nap under the fence",
    b: "Dream inside the stump",
    judgeA: "Slats of sun across you. It's the good kind of striped.",
    judgeB: "The dreams are older than you. Borrow them gently.",
  },
  {
    a: "Be spoken of fondly",
    b: "Be spoken of constantly",
    judgeA: "A warm sentence, now and then. That's a life.",
    judgeB: "They never stop. Not for a second. Exhausting fame.",
  },
  {
    a: "Buttons that never fall off",
    b: "Laces that never come undone",
    judgeA: "Stability. Boring. Deeply, quietly luxurious.",
    judgeB: "You'd never trip again. Your ankles owe you.",
  },
  {
    a: "Sing to the bread dough",
    b: "Read to the compost heap",
    judgeA: "It rises higher when flattered. Science, probably.",
    judgeB: "It listens with its whole rotting heart. Sweet.",
  },
  {
    a: "A pillow of moss",
    b: "A blanket of leaves",
    judgeA: "Cool. Springy. Full of extremely small neighbors.",
    judgeB: "Crunchy. Autumnal. Everyone knows you're under there.",
  },
  {
    a: "Trade a memory for a snack",
    b: "Trade a snack for a nap",
    judgeA: "Which memory? It's gone. That was the price. Enjoy the chips.",
    judgeB: "The obvious trade. The blob in me is already asleep.",
  },
  {
    a: "One trustworthy crow",
    b: "Fifty indifferent pigeons",
    judgeA: "It brings gifts. Shiny ones. It expects nothing. Suspicious.",
    judgeB: "A cloud of shrugs. They'd follow you. Vaguely.",
  },
  {
    a: "A soup with a rumor in it",
    b: "A pie with a promise in it",
    judgeA: "One spoonful and you know something you shouldn't.",
    judgeB: "Sweet. Binding. Legally, you now owe the pie.",
  },
  {
    a: "Have very loud thoughts",
    b: "Have very slow feelings",
    judgeA: "The neighbors already know. They've known for years.",
    judgeB: "You'd cry about Tuesday in November. Beautiful. Late.",
  },
  {
    a: "Wear the same hat forever",
    b: "Wear a different hat hourly",
    judgeA: "It becomes you. It becomes your whole personality. Fine.",
    judgeB: "A life of transitions. Exhausting. Jaunty.",
  },
  {
    a: "Fluent in doorbell",
    b: "Fluent in creaking floor",
    judgeA: "\"Someone's here.\" That's it. That's the language.",
    judgeB: "Every step, a confession. The house tells on everyone.",
  },
  {
    a: "A mountain's slow advice",
    b: "A river's quick opinions",
    judgeA: "It has one sentence. You'll wait a decade. It's good.",
    judgeB: "It talks constantly and never stays for the answer.",
  },
  {
    a: "Never lose a sock",
    b: "Never lose an argument",
    judgeA: "Peace. Order. A matched life. Genuinely tempting.",
    judgeB: "Insufferable. Correct. Alone. Correctly alone.",
  },
  {
    a: "A worm with a job",
    b: "A beetle with a plan",
    judgeA: "It commutes downward. It's doing very well.",
    judgeB: "Gerald has plans. Gerald has always had plans.",
  },
  {
    a: "Milk that stays cold",
    b: "Tea that stays hot",
    judgeA: "A small mercy. A dependable one.",
    judgeB: "Forever. You'd never finish it. That's the curse.",
  },
  {
    a: "Be brave for one minute",
    b: "Be calm for one hour",
    judgeA: "Sixty seconds. Enough for anything. Choose the moment.",
    judgeB: "A whole hour of not worrying. I've forgotten what that is.",
  },
  {
    a: "A pond that reflects tomorrow",
    b: "A mirror that shows yesterday",
    judgeA: "Ripple it. Ruin it. Now nobody knows. Safer.",
    judgeB: "You looked fine. You always looked fine. Stop it.",
  },
  {
    a: "Ride the fog to town",
    b: "Sail the dusk home",
    judgeA: "Slow. Damp. Nobody sees you arrive. Ideal.",
    judgeB: "The light goes with you. A very grand commute.",
  },
  {
    a: "A key that fits everything",
    b: "A door that opens for anyone",
    judgeA: "Power. Temptation. You'll open the wrong one. Everyone does.",
    judgeB: "Hospitable. Reckless. The geese have already entered.",
  },
  {
    a: "Every crumb accounted for",
    b: "Every crumb forgiven",
    judgeA: "A ledger of snacks. The auditors are ants.",
    judgeB: "The floor exhales. The broom retires. Peace.",
  },
  {
    a: "Nap for a hundred years",
    b: "Nap for exactly enough",
    judgeA: "You'd wake to a very different fence. Sad, actually.",
    judgeB: "Impossible. Legendary. The true dream.",
  },
  {
    a: "A song stuck in your head",
    b: "A hum stuck in the walls",
    judgeA: "For a week. It's the cube's song. It always is.",
    judgeB: "The house is humming. It won't stop. It's not for you.",
  },
  {
    a: "Meet the wind's mother",
    b: "Meet the rain's landlord",
    judgeA: "She is very large and very disappointed in the breeze.",
    judgeB: "The cloud owes back rent. That's why it's so heavy.",
  },
  {
    a: "Speak once, perfectly",
    b: "Mumble forever, honestly",
    judgeA: "One flawless sentence. Then silence. A legend.",
    judgeB: "Nobody hears you, but every word is true. A saint.",
  },
  {
    a: "A picnic in a thunderstorm",
    b: "A funeral in bright sun",
    judgeA: "Soggy sandwiches. Excellent lighting. Unforgettable.",
    judgeB: "Rude weather for it. But the flowers looked incredible.",
  },
  {
    a: "A cupboard that restocks",
    b: "A fridge that hides things",
    judgeA: "Infinite crackers. A quiet, complete victory.",
    judgeB: "The leftovers are in there. Somewhere. Playing games.",
  },
  {
    a: "Be the reason it rained",
    b: "Be the reason it stopped",
    judgeA: "The farmers love you. The picnic hates you. Balance.",
    judgeB: "You'd take credit. You'd be lying. Nobody would check.",
  },
  {
    a: "Sleep in a drawer",
    b: "Sleep on the roof",
    judgeA: "Snug. Sock-adjacent. Deeply, structurally correct.",
    judgeB: "Cold. Windy. The stars right there. Worth the flu.",
  },
  {
    a: "A dog that understands you",
    b: "A cat that pretends not to",
    judgeA: "Every word. Every mood. It's already at the door.",
    judgeB: "It understood. It chose silence. It always chooses silence.",
  },
  {
    a: "Eat only round food",
    b: "Eat only square food",
    judgeA: "Peas, buns, the moon. A noble diet.",
    judgeB: "Crackers and regret. Efficient stacking, though.",
  },
  {
    a: "A very sincere scarecrow",
    b: "A deeply sarcastic broom",
    judgeA: "It means everything it says. It says nothing. Perfect.",
    judgeB: "\"Oh, more crumbs. How generous of you.\" Every day.",
  },
  {
    a: "Feel the seasons change",
    b: "Feel the tide turn",
    judgeA: "One shiver and you know. October's here. Get the blanket.",
    judgeB: "Twice a day the sea tugs at you. Unsettling. Grand.",
  },
  {
    a: "One hundred small joys",
    b: "One enormous relief",
    judgeA: "A crumb of good, hourly. It adds up. It always adds up.",
    judgeB: "The weight leaves. All at once. You'd float, briefly.",
  },
  {
    a: "A bicycle that steers itself",
    b: "A boat that argues",
    judgeA: "It knows where you're going. The bakery. It's always the bakery.",
    judgeB: "\"That's not a harbor.\" It's right. It's insufferable.",
  },
  {
    a: "Whisper the last word",
    b: "Shout the first",
    judgeA: "Quiet. Final. Nobody notices you won. You know.",
    judgeB: "The room startles. You have their attention. Now what.",
  },
  {
    a: "A snail that races you",
    b: "A rabbit that waits for you",
    judgeA: "It's ahead. Somehow it's ahead. Don't ask how.",
    judgeB: "Patient. Twitchy. It could have left. It stayed.",
  },
  {
    a: "Sunlight that pools",
    b: "Moonlight that spreads",
    judgeA: "A warm puddle on the floor. The cat found it first.",
    judgeB: "Thin, cold, everywhere. A blanket made of nothing.",
  },
  {
    a: "A recipe with no measurements",
    b: "A song with no ending",
    judgeA: "\"Some soup. Cook until done.\" Rude. Correct.",
    judgeB: "It just keeps going. Somewhere it's still playing.",
  },
  {
    a: "Be good at exactly one thing",
    b: "Be fine at everything",
    judgeA: "The best in the world at loafing. A calling.",
    judgeB: "Adequate forever. The tragedy of the well-rounded.",
  },
  {
    a: "A hedge that grows a maze",
    b: "A path that changes daily",
    judgeA: "It's testing you. It's been testing you for years.",
    judgeB: "Never the same walk twice. Never once on time.",
  },
  {
    a: "A friend made of bees",
    b: "A friend made of weather",
    judgeA: "Very supportive. Group hugs are a hard no.",
    judgeB: "Great company. Ruins every plan. Loves you anyway.",
  },
  {
    a: "Carry the fire",
    b: "Carry the water",
    judgeA: "Warmth for everyone. Blisters for you. That's leadership.",
    judgeB: "Heavy. Sloshing. Everyone drinks. Nobody thanks you.",
  },
  {
    a: "A ladder into the compost",
    b: "A slide into the soup",
    judgeA: "Down where things become other things. Educational.",
    judgeB: "Weee — broth. This was always going to happen.",
  },
  {
    a: "Have a catchphrase",
    b: "Have a theme song",
    judgeA: "You'd say it too much. Everyone would say it back. Mockingly.",
    judgeB: "It plays when you enter. Even at the doctor's. Especially there.",
  },
  {
    a: "The sky's weekly report",
    b: "The soil's yearly review",
    judgeA: "\"Cloudy. Some feelings. More cloud.\" Consistent.",
    judgeB: "\"You trampled me in March.\" It has notes. Many notes.",
  },
  {
    a: "A wish that takes decades",
    b: "A wish that comes out wrong",
    judgeA: "It arrives. You're old. It still fits. Somehow.",
    judgeB: "You asked for peace. You got a very quiet goose.",
  },
  {
    a: "Read minds on Mondays",
    b: "Read weather on Fridays",
    judgeA: "Everyone is thinking about lunch. Everyone. Always.",
    judgeB: "You'd know when to nap outdoors. Genuinely useful.",
  },
  {
    a: "Trade your name for a song",
    b: "Trade your face for a mask",
    judgeA: "Nobody calls you. Everybody hums you. A fine deal.",
    judgeB: "Mysterious. Anonymous. Itchy after the first hour.",
  },
  {
    a: "Live near a very old tree",
    b: "Live near a very new stream",
    judgeA: "It has seen worse than you. It will see worse after.",
    judgeB: "It just started. It's so pleased with itself. Charming.",
  },
  {
    a: "Own a hat with a history",
    b: "Own a chair with a future",
    judgeA: "It's been on three heads. Two of them were wanted.",
    judgeB: "It's going places. It has not told you where.",
  },
  {
    a: "A candle that never burns down",
    b: "A match that always lights",
    judgeA: "Eternal, patient light. It's seen your worst nights.",
    judgeB: "One strike. Every time. A small, dependable miracle.",
  },
  {
    a: "Be misheard as brilliant",
    b: "Be quoted as unhinged",
    judgeA: "You said \"soup.\" They heard \"truth.\" Ride it.",
    judgeB: "\"It said it fought the moon.\" You never said that. It's better.",
  },
  {
    a: "Nap where the sun lands",
    b: "Nap where the moon points",
    judgeA: "The oldest instinct. The best one. Go.",
    judgeB: "Cold flagstones and destiny. Bring a second blanket.",
  },
  {
    a: "A very serious picnic",
    b: "A completely unserious wedding",
    judgeA: "Silence. Cloth napkins. The sandwiches are afraid.",
    judgeB: "The rings are noodles. The vows are jokes. It'll last.",
  },
  {
    a: "Every apology accepted",
    b: "Every apology unnecessary",
    judgeA: "Forgiveness on tap. You'd get sloppy. You would.",
    judgeB: "Nothing to forgive. Ever. A frankly alarming life.",
  },
  {
    a: "A cave with good acoustics",
    b: "A field with good silence",
    judgeA: "Everything you say sounds important. Even the burps.",
    judgeB: "Nothing to say. Nothing needing said. Luxury.",
  },
  {
    a: "Carry a small storm",
    b: "Bury a large calm",
    judgeA: "It rumbles in your pocket. It's yours. Feed it.",
    judgeB: "It's under the fence. You'll want it later. Mark the spot.",
  },
  {
    a: "Understand every bark",
    b: "Understand no meows",
    judgeA: "\"HELLO. HELLO. I LOVE YOU. HELLO.\" It's a lot. It's lovely.",
    judgeB: "Bliss. Sweet, silent bliss. It's still judging you.",
  },
  {
    a: "The moon takes an interest",
    b: "The sun takes a day off",
    judgeA: "It leans in. It watches. It has questions about you.",
    judgeB: "One gray, restful day. Nobody has to do anything.",
  },
  {
    a: "Sleep with the window open",
    b: "Wake with the door ajar",
    judgeA: "Cold air, wet grass smell, one bold moth. Correct.",
    judgeB: "Who opened it? What left? Start your day with that.",
  },
  {
    a: "Bread that remembers the field",
    b: "Water that remembers the cloud",
    judgeA: "It tastes like a summer you didn't attend. Sad. Delicious.",
    judgeB: "Every sip is a little homesick. Drink up.",
  },
  {
    a: "A very handsome mushroom",
    b: "A very intelligent rock",
    judgeA: "It knows it's handsome. That's the problem.",
    judgeB: "It has solved everything. It is not telling. It's a rock.",
  },
  {
    a: "Be given the good chair",
    b: "Be offered the last slice",
    judgeA: "The house has decided you matter. Sit down.",
    judgeB: "Refuse once. Accept immediately. This is the protocol.",
  },
  {
    a: "Have a nemesis, cordially",
    b: "Have a rival, secretly",
    judgeA: "You'd nod at the market. You'd both mean it. War, but polite.",
    judgeB: "They don't know. It's more fun this way. Slightly sad.",
  },
  {
    a: "Never be rained on",
    b: "Never be rushed",
    judgeA: "It parts around you. Dry. Lonely. Dry.",
    judgeB: "Time gives up on you. You arrive when you arrive. Divine.",
  },
  {
    a: "A garden that plants itself",
    b: "A kitchen that cleans itself",
    judgeA: "Cabbages where you didn't ask. Bold. Unstoppable.",
    judgeB: "The broom is out of a job. It has taken this poorly.",
  },
  {
    a: "Speak with your eyebrows",
    b: "Argue with your posture",
    judgeA: "One raise and the room folds. Devastating instrument.",
    judgeB: "You lean. They know. They concede. Terrifying.",
  },
  {
    a: "A pocket-sized winter",
    b: "A jar of leftover August",
    judgeA: "Open it in July. Ruin one specific afternoon. Perfect.",
    judgeB: "Warm, heavy, smells like grass. Ration it.",
  },
  {
    a: "Be a rumor among owls",
    b: "Be a fact among frogs",
    judgeA: "\"Whooo?\" they ask. Nobody knows. You've made it.",
    judgeB: "They've confirmed you. Every pond agrees. Undeniable.",
  },
  {
    a: "A path lined with lanterns",
    b: "A path lined with sleeping cats",
    judgeA: "Warm. Guided. Slightly overdramatic. I love it.",
    judgeB: "You will not get through. You will not try. Correct.",
  },
  {
    a: "Learn the language of doors",
    b: "Learn the dialect of drawers",
    judgeA: "Slam, click, creak. They gossip constantly. About you.",
    judgeB: "They stick when they're upset. Now you'll know why.",
  },
  {
    a: "One perfect sandwich",
    b: "Unlimited fine sandwiches",
    judgeA: "Once. Only once. You'd chase it forever. A curse.",
    judgeB: "Adequate bread, forever. The steady path. I'd take it.",
  },
  {
    a: "A duck that owes you money",
    b: "A goose that has your keys",
    judgeA: "It's avoiding you. It waddles the long way now.",
    judgeB: "Negotiate. Bring bread. Do not make eye contact.",
  },
  {
    a: "Age like a cheese",
    b: "Age like a stone",
    judgeA: "Sharper. Richer. Increasingly hard to be around.",
    judgeB: "Slowly. Beautifully. You'd miss the whole thing.",
  },
  {
    a: "Sleep through the alarm",
    b: "Wake before it rings",
    judgeA: "Blissful. Ruinous. Worth it about half the time.",
    judgeB: "You lie there. Waiting. Winning. Miserable.",
  },
  {
    a: "A friend who remembers everything",
    b: "A friend who forgives everything",
    judgeA: "Including that. Yes, that. They brought it up again.",
    judgeB: "It's gone. It never happened. Dangerous. Beloved.",
  },
  {
    a: "Grow moss on your north side",
    b: "Grow flowers in your shadow",
    judgeA: "Now they can find their way home using you. Useful.",
    judgeB: "Everywhere you stand, something blooms. Show-off.",
  },
  {
    a: "Free rides from the wind",
    b: "Free advice from the roots",
    judgeA: "Where to? It doesn't ask. It doesn't stop, either.",
    judgeB: "\"Down.\" That's it. That's always it. Still, wise.",
  },
  {
    a: "A cup that's always half full",
    b: "A cup that's always yours",
    judgeA: "Optimism, enforced by physics. Frustrating.",
    judgeB: "Nobody else may touch it. This is the real luxury.",
  },
  {
    a: "The privilege of the last nap",
    b: "The burden of the first light",
    judgeA: "Everyone else is up. You are not. This is power.",
    judgeB: "You see it first. Alone. Cold. Genuinely holy.",
  },
  {
    a: "Be the town's odd one",
    b: "Be the town's only one",
    judgeA: "Beloved. Discussed. Never quite invited. Fine.",
    judgeB: "No comparisons. No company. The fence keeps you talking.",
  },
  {
    a: "Cook for a crowd",
    b: "Eat alone, correctly",
    judgeA: "Chaos, steam, forty opinions on salt. Alive.",
    judgeB: "The right amount. The right silence. Nobody watching.",
  },
  {
    a: "A moth that runs your errands",
    b: "A worm that guards your gold",
    judgeA: "It went to the lantern instead. It always does.",
    judgeB: "It's under there. So is the gold. Somewhere. Trust it.",
  },
  {
    a: "The gift of a spare afternoon",
    b: "The gift of a shorter Monday",
    judgeA: "Unbooked. Unclaimed. Do nothing loudly in it.",
    judgeB: "Four hours of Monday. The correct amount of Monday.",
  },
  {
    a: "A very loyal shadow",
    b: "A slightly disloyal echo",
    judgeA: "It stayed through the worst of it. Say thank you.",
    judgeB: "It repeats you. Wrong. Better. The crowd prefers it.",
  },
  {
    a: "See the wind's shape",
    b: "See the silence's color",
    judgeA: "Ribbons. Knots. It's messier up there than you'd think.",
    judgeB: "It's blue. It was always going to be blue.",
  },
  {
    a: "A soup with a stone in it",
    b: "A pocket with a frog in it",
    judgeA: "An old trick. Still works. Still warms the village.",
    judgeB: "You knew. You've known since noon. It's fine. It's happy.",
  },
  {
    a: "Be woken by birdsong",
    b: "Be woken by bread smell",
    judgeA: "The pretty option. Also, they start at four. Fair warning.",
    judgeB: "You'd be up. You'd be running. You'd be right to.",
  },
  {
    a: "One enormous friend",
    b: "A great many tiny allies",
    judgeA: "It can carry you. It has. It will again.",
    judgeB: "The ants are organized. The ants have your back.",
  },
  {
    a: "Sleep in the vegetable patch",
    b: "Dream in the flower bed",
    judgeA: "Practical. Damp. You'd wake up as a leek. Risk accepted.",
    judgeB: "Pretty. Pollen-heavy. The bees would have opinions.",
  },
  {
    a: "A rule you may break once",
    b: "A rule nobody enforces",
    judgeA: "You'd save it forever. You'd die with it unused. Sad.",
    judgeB: "You'd break it hourly. Nobody would notice. Also sad.",
  },
  {
    a: "A slow, correct answer",
    b: "A fast, interesting one",
    judgeA: "Everyone's left. But you were right. Cold, quiet right.",
    judgeB: "Wrong, but the room lit up. That counts for something.",
  },
  {
    a: "A cottage that leans",
    b: "A tower that wobbles",
    judgeA: "It leans toward the sun. Sensible building. Good instincts.",
    judgeB: "The view is worth the nausea. Barely.",
  },
  {
    a: "Be forgiven by the floor",
    b: "Be thanked by the ceiling",
    judgeA: "It has carried everything. It has said nothing. Until now.",
    judgeB: "You never look up. It noticed. It's grateful you exist.",
  },
  {
    a: "A hum that finds you",
    b: "A silence that follows you",
    judgeA: "It arrives in the kitchen. It arrives at dawn. It's the cube.",
    judgeB: "Rooms go quiet. Not out of fear. Out of respect. Probably.",
  },
  {
    a: "A tooth that predicts rain",
    b: "A knee that predicts guests",
    judgeA: "It aches on Tuesday. It's always right. Cancel the picnic.",
    judgeB: "A twinge means company. Hide the good biscuits.",
  },
  {
    a: "Live above a bakery",
    b: "Live below a library",
    judgeA: "You'd never sleep past five. You'd never be sad, either.",
    judgeB: "Footsteps and silence and old paper. A good ceiling.",
  },
  {
    a: "Be trusted with a secret",
    b: "Be spared one",
    judgeA: "Heavy. Honorable. You'd carry it well. Mostly.",
    judgeB: "Blissful ignorance, gift-wrapped. Take it. Don't ask.",
  },
  {
    a: "One reliable pocket",
    b: "One unreliable wing",
    judgeA: "Nothing falls out. Ever. A quiet, complete life.",
    judgeB: "It works sometimes. That's enough to keep trying. Tragic.",
  },
  {
    a: "Own the softest broom",
    b: "Own the sharpest spoon",
    judgeA: "It moves dust with kindness. The dust barely notices.",
    judgeB: "Soup, but menacing. I'd allow it. Watch the lip.",
  },
  {
    a: "A cloud that follows the good",
    b: "A puddle that finds the tired",
    judgeA: "Shade for the deserving. It hovers over you a lot, actually.",
    judgeB: "It appears where you'd fall. It cushions nothing. Symbolic.",
  },
  {
    a: "Fall asleep instantly",
    b: "Wake up completely",
    judgeA: "Head down. Gone. The gift I'd steal, if I could.",
    judgeB: "No fog. No grumbling. Frankly unnatural.",
  },
  {
    a: "Be liked by every dog",
    b: "Be tolerated by every cat",
    judgeA: "A parade wherever you go. Every walk becomes an event.",
    judgeB: "Tolerance from a cat is a knighthood. Bow.",
  },
  {
    a: "A rainstorm with an opinion",
    b: "A drought with a grudge",
    judgeA: "It rains hardest on the smug. Justice, from above.",
    judgeB: "It remembers what you did. It withholds. For years.",
  },
  {
    a: "Have a very small enemy",
    b: "Have a very distant friend",
    judgeA: "It's a wasp. It's personal. It knows your window.",
    judgeB: "Letters. Long gaps. Absolute devotion. Worth it.",
  },
  {
    a: "Grow taller in the summer",
    b: "Grow rounder in the winter",
    judgeA: "Seasonal height. Your doors would never fit right.",
    judgeB: "Correct. Natural. Bear-endorsed. Do it.",
  },
  {
    a: "Hear the grass grow",
    b: "Hear the stone think",
    judgeA: "It's loud. It never stops. You'd move to the desert.",
    judgeB: "One thought per century. You'd wait. You'd stay.",
  },
  {
    a: "A pie that solves arguments",
    b: "A soup that starts them",
    judgeA: "Nobody fights with pastry in hand. Diplomacy achieved.",
    judgeB: "One spoonful and someone says something regrettable.",
  },
  {
    a: "The sky lowers for you",
    b: "The ground rises to meet you",
    judgeA: "Clouds at knee height. You'd wear a cloud. Fashion.",
    judgeB: "Every fall is a soft one. Every step is a small hill.",
  },
  {
    a: "A drawer that eats socks",
    b: "A cupboard that adds jars",
    judgeA: "You knew where it went. Now you know who took it.",
    judgeB: "There are more jars. There are always more jars. Why.",
  },
  {
    a: "Sing badly with feeling",
    b: "Sing perfectly without it",
    judgeA: "The dogs howl. The neighbors weep. Somehow it's right.",
    judgeB: "Technically flawless. Everyone claps. Nobody cries.",
  },
  {
    a: "Be given directions by a crow",
    b: "Be misled by a helpful goose",
    judgeA: "It points with its whole body. It's correct. It's smug.",
    judgeB: "It meant well. You are now in a swamp. It waits nearby.",
  },
  {
    a: "A window that fogs on cue",
    b: "A mirror that steams politely",
    judgeA: "Draw in it. It waits for you. It clears when you're done.",
    judgeB: "It never shows you at your worst. A merciful glass.",
  },
  {
    a: "Everything smells like a memory",
    b: "Nothing smells like anything",
    judgeA: "You'd cry in the spice aisle. Weekly. Publicly.",
    judgeB: "Peace. Emptiness. The soup means nothing now.",
  },
  {
    a: "Be the one who waits",
    b: "Be the one who's waited for",
    judgeA: "A long bench. A cold tea. But they come. They always come.",
    judgeB: "Someone's out there watching the road. Don't dawdle.",
  },
  {
    a: "A very earnest ghost",
    b: "A profoundly lazy poltergeist",
    judgeA: "It tries so hard to be spooky. It brings you tea instead.",
    judgeB: "It moved one cup. In 1840. It's resting now.",
  },
  {
    a: "Only fall in love in autumn",
    b: "Only make friends in spring",
    judgeA: "Brief. Golden. Ends when the leaves do. Devastating.",
    judgeB: "Everything blooming, everyone new. Then a long quiet.",
  },
  {
    a: "A boot full of coins",
    b: "A jar full of teeth",
    judgeA: "Wealth. Discomfort. You'd limp richly.",
    judgeB: "Whose? Don't answer. I've changed my mind. Don't.",
  },
  {
    a: "Nap during the eclipse",
    b: "Miss the comet entirely",
    judgeA: "The one dark afternoon of the century. You slept. Legend.",
    judgeB: "Everyone talks about it forever. You were eating. Also fine.",
  },
  {
    a: "A soft place to land",
    b: "A good reason to jump",
    judgeA: "Comfort waiting below. You'd never need to look down.",
    judgeB: "You'd leap anyway. Landing is a later problem.",
  },
  {
    a: "Speak only in weather",
    b: "Listen only in seasons",
    judgeA: "\"Overcast, mild.\" It means you're fine. Nobody knows this.",
    judgeB: "You'd hear the question in March. Answer in June. Slow talk.",
  },
  {
    a: "Be invited by the moss",
    b: "Be evicted by the ivy",
    judgeA: "It has made room. It made room slowly. Sit.",
    judgeB: "It grew over the door while you slept. That's the notice.",
  },
  {
    a: "Every road leads home",
    b: "Every home has a road",
    judgeA: "You cannot get lost. You cannot leave, either. Hmm.",
    judgeB: "Always a way out. That's a different kind of comfort.",
  },
  {
    a: "A very old song",
    b: "A very new silence",
    judgeA: "Everyone's grandmother knew it. Now you do too.",
    judgeB: "Nobody has been quiet here before. You're the first. Enjoy.",
  },
  {
    a: "Be paid in compliments",
    b: "Be paid in leftovers",
    judgeA: "You'd be broke and glowing. A recognizable condition.",
    judgeB: "Cold pie is still pie. This is the sustainable option.",
  },
  {
    a: "Cure hiccups by staring",
    b: "Cure sadness by humming",
    judgeA: "Intense. Effective. Deeply uncomfortable for everyone.",
    judgeB: "The cube figured this out ages ago. Follow its lead.",
  },
  {
    a: "A dog-shaped cloud, always",
    b: "A cloud-shaped dog, once",
    judgeA: "Every sky, a good boy. You'd never look down again.",
    judgeB: "Just the one. Fluffy. Weightless. It floated off. Grieve.",
  },
  {
    a: "Have a favorite step",
    b: "Have a dreaded chair",
    judgeA: "The fourth one. It creaks correctly. You wait for it.",
    judgeB: "You know the one. You'd rather stand. Everyone knows.",
  },
  {
    a: "Meet the beetle's family",
    b: "Attend the worm's funeral",
    judgeA: "There are so many. They all look like Gerald. They aren't.",
    judgeB: "Sombre. Damp. Surprisingly well attended. Bring nothing.",
  },
  {
    a: "The first snow, every day",
    b: "The last warm day, forever",
    judgeA: "Fresh. Hushed. Nobody's walked in it. Every single morning.",
    judgeB: "Golden. Doomed. Always about to end. Never ending.",
  },
  {
    a: "A lantern that walks with you",
    b: "A shadow that lights the way",
    judgeA: "It hovers. It hums. It has never once let the dark win.",
    judgeB: "Backwards. Impossible. Extremely stylish.",
  },
  {
    a: "Speak to the kettle",
    b: "Reason with the fire",
    judgeA: "It only screams. It has only ever screamed. Listen anyway.",
    judgeB: "It's not listening. It's eating your chair. Back away.",
  },
  {
    a: "Be famous for a sandwich",
    b: "Be forgotten for a masterpiece",
    judgeA: "They'd name it after you. It'd be mostly pickle. Immortality.",
    judgeB: "It was perfect. It's in a drawer. Nobody knows. You do.",
  },
  {
    a: "A chair by the fire",
    b: "A window on the storm",
    judgeA: "Warm shins. Sleepy eyes. The whole point of houses.",
    judgeB: "You watch it lose. From inside. Smug and dry.",
  },
  {
    a: "A pet cloud",
    b: "A feral sunbeam",
    judgeA: "It drips on the carpet. It follows you to bed. Worth it.",
    judgeB: "It won't be held. It won't be trained. It comes back at four.",
  },
  {
    a: "Keep the good crumbs",
    b: "Share the last bite",
    judgeA: "The crumbs at the bottom. The sweetest ones. Selfish. Correct.",
    judgeB: "A generous soul. A hungry soul. A better soul than me.",
  },
  {
    a: "Grow a beard of moss",
    b: "Grow a crown of mushrooms",
    judgeA: "Distinguished. Damp. Small creatures move in by autumn.",
    judgeB: "Regal. Spotted. Don't eat your own hat. It's tempting.",
  },
  {
    a: "The best seat, alone",
    b: "The worst seat, with friends",
    judgeA: "Perfect view. Perfect silence. You keep checking the door.",
    judgeB: "A pillar in the way. Nobody cares. Nobody's watching anyway.",
  },
  {
    a: "Be a rumor in the flowers",
    b: "Be a legend in the mud",
    judgeA: "The bees pass it along. It gets prettier each time.",
    judgeB: "The worms tell it wrong. They tell it constantly. Beloved.",
  },
  {
    a: "A hat for every worry",
    b: "A pocket for every doubt",
    judgeA: "Wear the small one for small ones. You'd need a hall.",
    judgeB: "Zipped away. Carried around. Heavier than you'd think.",
  },
  {
    a: "Watch a thing grow slowly",
    b: "Watch a thing finish fast",
    judgeA: "Weeks of nothing. Then a bean. You'd weep over the bean.",
    judgeB: "Whoosh. Done. Satisfying. Slightly hollow. Then what?",
  },
  {
    a: "A perfectly ripe pear",
    b: "A perfectly timed nap",
    judgeA: "Three minutes exist where it's right. You caught them.",
    judgeB: "Twenty minutes. Not nineteen. You woke up new.",
  },
  {
    a: "Be understood by no one",
    b: "Be explained by everyone",
    judgeA: "Alone. Whole. The moon does fine like this.",
    judgeB: "Each one wrong. Each one confident. Loudly, publicly wrong.",
  },
  {
    a: "Steal a small bit of time",
    b: "Return a large bit of worry",
    judgeA: "Ten minutes nobody knows about. The best ten. Use them badly.",
    judgeB: "Give it back. To whom? The fence. It can take it.",
  },
  {
    a: "Whistle up a friend",
    b: "Hum down a storm",
    judgeA: "One note and they come. This is a serious responsibility.",
    judgeB: "Careful. It's already leaning in. It heard you.",
  },
  {
    a: "A frog on your shoulder",
    b: "A snail on your hat",
    judgeA: "It advises. Badly. Loudly. You'd take the advice anyway.",
    judgeB: "Slow. Silent. A tiny slick crown. Distinguished.",
  },
  {
    a: "Dinner with the moon",
    b: "Breakfast with the fog",
    judgeA: "It doesn't eat. It watches. It asks about your debts.",
    judgeB: "It's already in your porridge. Vague company. Cold.",
  },
  {
    a: "Be soft where it counts",
    b: "Be hard where it doesn't",
    judgeA: "The heart, cushioned. The rest, whatever. Correct build.",
    judgeB: "Armored elbows. Useless. Impressive at parties.",
  },
  {
    a: "A jar of trapped thunder",
    b: "A box of folded wind",
    judgeA: "Shake it when ignored. Deploy responsibly.",
    judgeB: "Open it in a stuffy room. A small, illegal spring.",
  },
  {
    a: "Never step on a bee",
    b: "Never trip on a root",
    judgeA: "The bees are relieved. So are your feet. Good pact.",
    judgeB: "The forest lets you pass. It's watching, but it lets you.",
  },
  {
    a: "Read the fence's diary",
    b: "Burn the gate's letters",
    judgeA: "Everything that walked by. Every single thing. Enjoy.",
    judgeB: "Whatever they said, it dies with you. Merciful. Suspicious.",
  },
  {
    a: "Sleep on a boat",
    b: "Nap in a tree",
    judgeA: "Rocked all night by something enormous. Restful. Ominous.",
    judgeB: "You'd fall. Eventually. Beautifully. Into leaves. Fine.",
  },
  {
    a: "A meal that ends too soon",
    b: "A visit that runs too long",
    judgeA: "You'd remember it forever. You'd want more. That's the trick.",
    judgeB: "They're still here. It's dark. They've started a new story.",
  },
  {
    a: "Be trusted by the storm",
    b: "Be pitied by the drought",
    judgeA: "It goes around you. It respects you. You feel very strange.",
    judgeB: "It leaves you one puddle. That's charity. Take it.",
  },
  {
    a: "The moon in your pocket",
    b: "The sea in your shoe",
    judgeA: "Heavy. Cold. The tides now follow your walk.",
    judgeB: "Squelch. Squelch. Crabs. Foul. But you'd never be dry again.",
  },
  {
    a: "An extra Sunday",
    b: "A shorter Wednesday",
    judgeA: "Slow. Warm. Nothing owed to anyone. Take it.",
    judgeB: "Trim the middle. Nobody would notice. Nobody would mourn it.",
  },
  {
    a: "Speak with the fire's honesty",
    b: "Listen with the pond's patience",
    judgeA: "It only tells the truth. It burns everything else. Hard life.",
    judgeB: "Everything sinks in. Nothing sinks out. A very still friend.",
  },
  {
    a: "Wear armor made of bread",
    b: "Carry a sword made of soup",
    judgeA: "Warm. Crusty. It stops nothing. You look incredible.",
    judgeB: "Deeply impractical. Somehow intimidating. Steaming.",
  },
  {
    a: "A song the cube taught you",
    b: "A silence the cube left behind",
    judgeA: "You'll hum it wrong forever. It doesn't mind. It's flattered.",
    judgeB: "It stopped, once. The room hasn't recovered. Neither have you.",
  },
  {
    a: "Trade a nap for a fact",
    b: "Trade a fact for a nap",
    judgeA: "Now you know something. You're exhausted. Was it worth it?",
    judgeB: "Correct. Take the nap. Facts regrow. Naps do not.",
  },
  {
    a: "Own a small bell",
    b: "Owe a large silence",
    judgeA: "Ring it and something arrives. You've never dared.",
    judgeB: "You promised not to speak of it. You haven't. It's heavy.",
  },
  {
    a: "Be adopted by a goose",
    b: "Be tolerated by a swan",
    judgeA: "It defends you from everyone. Especially your own friends.",
    judgeB: "Elegant. Cold. It permits your presence on the water. Barely.",
  },
  {
    a: "A blanket that's been everywhere",
    b: "A cup that's been nowhere",
    judgeA: "Threadbare. Smells like every good night. Irreplaceable.",
    judgeB: "Pristine. Unused. A little sad. Fill it. Go on.",
  },
  {
    a: "Cry at the good parts",
    b: "Laugh at the wrong times",
    judgeA: "You'd be a mess at weddings. A beloved, soggy mess.",
    judgeB: "The funeral. The doctor's. Once, at a duck. Chaos.",
  },
  {
    a: "A door that only you find",
    b: "A path only you forget",
    judgeA: "Hidden. Yours. You'd still lose the key. You always do.",
    judgeB: "Everyone else knows the way. You wander. You see more.",
  },
  {
    a: "Predict every sneeze",
    b: "Prevent every stubbed toe",
    judgeA: "Braced. Ready. Somehow it's worse when you see it coming.",
    judgeB: "A life without that specific rage. Genuinely tempting.",
  },
  {
    a: "A friend in the rafters",
    b: "A stranger under the porch",
    judgeA: "It rustles at night. It means well. Probably a moth. Probably.",
    judgeB: "It's been there for years. You've made a kind of peace.",
  },
  {
    a: "The right words, too late",
    b: "The wrong words, right now",
    judgeA: "You'd think of it on the walk home. You'd say it to the fence.",
    judgeB: "Out it comes. Wrong. Loud. At least the room moves on.",
  },
  {
    a: "A pond that keeps your secrets",
    b: "A hill that shares them",
    judgeA: "Everything you told it sank. Nothing floats back. Good pond.",
    judgeB: "It echoes. It carries. The whole valley knows about the soup.",
  },
  {
    a: "Sleep like a stone",
    b: "Wake like a bird",
    judgeA: "Nothing wakes you. Not thunder. Not fire. Bit of a risk.",
    judgeB: "Instantly. Loudly. At four in the morning. Awful. Alive.",
  },
  {
    a: "A hat that's a little too big",
    b: "Boots that are slightly too small",
    judgeA: "It slips. You look up more. Accidentally philosophical.",
    judgeB: "Every step a small negotiation. You'd stop walking. Wise.",
  },
  {
    a: "Trade tails with a cat",
    b: "Trade ears with a bat",
    judgeA: "It'd move without asking. It'd tell everyone how you feel.",
    judgeB: "You'd hear the moths thinking. It's mostly about lanterns.",
  },
  {
    a: "The last good apple",
    b: "The first bad idea",
    judgeA: "Crisp. Cold. Nobody else got one. Say nothing.",
    judgeB: "It starts here. It ends badly. That's the whole appeal.",
  },
  {
    a: "Be handy in a crisis",
    b: "Be delightful in a lull",
    judgeA: "Everyone looks at you when it burns. Heavy. Necessary.",
    judgeB: "You'd fill the quiet with something good. A rarer skill.",
  },
  {
    a: "A pillow that hums back",
    b: "A blanket that hugs first",
    judgeA: "You'd never be alone at night. That's the offer. Take it.",
    judgeB: "It gets to you before the sadness does. Every time.",
  },
  {
    a: "A garden of unknown things",
    b: "A shelf of labeled jars",
    judgeA: "Something's coming up. Nobody planted it. Water it anyway.",
    judgeB: "All named. All dated. All faintly disappointing inside.",
  },
  {
    a: "Speak only when the fire's lit",
    b: "Listen only when it rains",
    judgeA: "Winter, you're a poet. Summer, a mute. Seasonal wisdom.",
    judgeB: "Everything important gets said in the dry. Missed it all.",
  },
  {
    a: "A wheel that squeaks a tune",
    b: "A hinge that sighs on cue",
    judgeA: "Annoying. Melodic. Nobody would oil it. It'd become tradition.",
    judgeB: "It sighs when you leave. It sighs when you return. Dramatic.",
  },
  {
    a: "Be lost with a good map",
    b: "Be found with a bad one",
    judgeA: "You know exactly where you aren't. Deeply frustrating.",
    judgeB: "They found you. Eventually. The map was drawn by a duck.",
  },
  {
    a: "Nap in the laundry",
    b: "Nap in the cupboard",
    judgeA: "Warm. Soft. Everything smells like clean. The peak of it.",
    judgeB: "Dark. Tight. The jars watch you. It's still good.",
  },
  {
    a: "A cake that lasts all week",
    b: "A cake that vanishes at once",
    judgeA: "By Thursday it's dry and you're sad. But it's still cake.",
    judgeB: "Gone. Glorious. A brief, complete happiness. No regrets.",
  },
  {
    a: "Everything a bit too early",
    b: "Everything a bit too fine",
    judgeA: "The spring, the bread, the bad news. All ahead of schedule.",
    judgeB: "Nothing wrong. Nothing thrilling. A very smooth nothing.",
  },
  {
    a: "A goose that respects you",
    b: "A crow that fears you",
    judgeA: "It hisses at others. Not you. Never you. You've made it.",
    judgeB: "You've done something. It won't say what. It just remembers.",
  },
  {
    a: "Own a very warm rock",
    b: "Own a very cold coin",
    judgeA: "It holds the day's sun till midnight. Best pet ever.",
    judgeB: "It never warms. Not in your hand. Not in your pocket. Odd.",
  },
  {
    a: "Hear the house settle",
    b: "Feel the house breathe",
    judgeA: "Pops. Cracks. It's just getting comfortable. Like you.",
    judgeB: "In. Out. It's been doing that all along. Sleep well!",
  },
  {
    a: "A rumor that helps you",
    b: "A truth that hurts you",
    judgeA: "Untrue. Flattering. Spreading. Say nothing. Say nothing!",
    judgeB: "Accurate. Awful. You needed it. You didn't want it.",
  },
  {
    a: "Be first through the snow",
    b: "Be last to leave the fire",
    judgeA: "Untouched white. Yours. Cold feet. Worth every step.",
    judgeB: "The embers, the quiet, the sleeping house. Keeper of warmth.",
  },
  {
    a: "Bees in the walls",
    b: "Frogs in the pipes",
    judgeA: "Honey through the plaster by June. A sticky, sweet infestation.",
    judgeB: "Every bath a chorus. Every tap a surprise. Damp harmony.",
  },
  {
    a: "A soup that forgives",
    b: "A bread that remembers",
    judgeA: "Bad day? It doesn't ask. It just warms. The good stuff.",
    judgeB: "It knows you skipped breakfast. It's not angry. Just sad.",
  },
  {
    a: "The last laugh",
    b: "The first cry",
    judgeA: "You'd wait years for it. It'd be quiet. It'd be enough.",
    judgeB: "Everyone else held it in. You didn't. That's a service.",
  },
  {
    a: "A mole with a lantern",
    b: "A bat with a map",
    judgeA: "It doesn't need it. It carries it for you. Devoted little thing.",
    judgeB: "Upside down. Ink-smudged. Somehow it always arrives.",
  },
  {
    a: "Be told you're right",
    b: "Be shown you're needed",
    judgeA: "Warm. Brief. You'd want it again in an hour.",
    judgeB: "Heavy. Lasting. Nobody says it. You just see the empty chair.",
  },
  {
    a: "A lantern that never gutters",
    b: "A fire that never smokes",
    judgeA: "Steady. Loyal. It's outlasted several of your worst nights.",
    judgeB: "Clean warmth. No stinging eyes. The house forgives you.",
  },
  {
    a: "Own the loudest kettle",
    b: "Own the quietest door",
    judgeA: "The whole village knows you want tea. Announce it. Proudly.",
    judgeB: "You come and go. Nobody hears. Nobody knows. Ghostly. Useful.",
  },
  {
    a: "Grow old by the sea",
    b: "Grow old by the fire",
    judgeA: "Salt, wind, a long horizon. You'd get very good at looking.",
    judgeB: "Warm shins, soft chair, one good cat. The correct ending.",
  },
  {
    a: "A promise from a stone",
    b: "A threat from a flower",
    judgeA: "It will keep it. It has nothing else to do. Forever.",
    judgeB: "It's a small threat. It's a serious one. Apologize.",
  },
  {
    a: "Fold the fog",
    b: "Stack the silence",
    judgeA: "Neatly. Into a drawer. Deploy on a Tuesday. Chaos.",
    judgeB: "Very tall. Very quiet. Do not knock it over.",
  },
  {
    a: "A friend who calls at dawn",
    b: "A friend who knocks at midnight",
    judgeA: "Awful timing. Excellent news. Always excellent news.",
    judgeB: "Something's happened. Put the kettle on. Don't ask yet.",
  },
  {
    a: "Every dropped thing lands soft",
    b: "Every spilled thing rolls back",
    judgeA: "No shatter. No crash. A gentler, clumsier life. Yes.",
    judgeB: "The milk returns. Ashamed. Into the jug. Unsettling. Useful.",
  },
  {
    a: "Speak fluent chicken",
    b: "Write elegant duck",
    judgeA: "It's all alarm and gossip. Mostly about the fence. Riveting.",
    judgeB: "Loopy. Damp. They'd frame your letters. They'd never read them.",
  },
  {
    a: "A cat that sits on your work",
    b: "A dog that eats your excuses",
    judgeA: "Nothing gets done. That's the service it provides.",
    judgeB: "\"I was going to—\" Gone. Swallowed. Now you must actually go.",
  },
  {
    a: "A ceiling full of stars",
    b: "A floor full of moss",
    judgeA: "Painted? Real? Nobody says. You stopped asking years ago.",
    judgeB: "Cool underfoot. Slightly alarming. Extremely comfortable.",
  },
  {
    a: "Be woken by a nudge",
    b: "Be woken by a bell",
    judgeA: "Gentle. Personal. Someone chose to. That's the whole gift.",
    judgeB: "Clanging. Impersonal. Effective. Cruel. Effective.",
  },
  {
    a: "A very reasonable ghost",
    b: "A completely unhinged rooster",
    judgeA: "It knocks. It waits. It leaves when asked. A model tenant.",
    judgeB: "It crows at eleven. At two. At no dawn at all. It has broken.",
  },
  {
    a: "The dignity of a slow exit",
    b: "The thrill of a sudden one",
    judgeA: "Goodbyes at the door. Coats. Hugs. Twenty minutes of them.",
    judgeB: "Gone. Mid-sentence. They'd talk about it for years.",
  },
  {
    a: "Bury something for later",
    b: "Dig up something from before",
    judgeA: "You'd forget where. The squirrel model. Losses are fine.",
    judgeB: "It's rusted. It's yours. You wish you'd left it down there.",
  },
  {
    a: "A cloud shaped like the truth",
    b: "A stone shaped like a lie",
    judgeA: "Passing. Shifting. Gone before anyone agrees on it. Typical.",
    judgeB: "Heavy. Permanent. You'd carry it around. You do already.",
  },
  {
    a: "Grow radishes in your hat",
    b: "Grow ideas in the dark",
    judgeA: "Peppery. Portable. Doffing becomes a harvest.",
    judgeB: "They come out pale and strange. The best ones always do.",
  },
  {
    a: "A rain that only you hear",
    b: "A sun that only you feel",
    judgeA: "Cosy. Private. Nobody understands why you're smiling.",
    judgeB: "Warm in January. They'd assume the worst. They'd be right.",
  },
  {
    a: "Trade lunches with a badger",
    b: "Split dinner with a fox",
    judgeA: "Roots. Grubs. A surprise. Eat it. Do not ask about it.",
    judgeB: "It ate first. It ate most. It'll be back tomorrow.",
  },
  {
    a: "Be the keeper of the fire",
    b: "Be the finder of the path",
    judgeA: "Everyone warms at your work. Nobody thanks the fire.",
    judgeB: "Out front. Alone. Uncertain. They follow anyway. That's trust.",
  },
  {
    a: "A pocket watch that lies",
    b: "A sundial that sulks",
    judgeA: "Always ten minutes fast. You'd never be late again. Cheat.",
    judgeB: "Cloudy day? Nothing. It refuses. It's a matter of principle.",
  },
  {
    a: "Never sneeze in the library",
    b: "Never yawn in a meeting",
    judgeA: "Dignity, preserved. The dust wins the war, though.",
    judgeB: "Alert forever. Trapped forever. A dark bargain.",
  },
  {
    a: "A thousand small mercies",
    b: "One large, loud miracle",
    judgeA: "A held door. A found sock. Rain that waits. That's a life.",
    judgeB: "Once. Enormous. You'd spend the rest of it explaining.",
  },
  {
    a: "A soup that's mostly rumor",
    b: "A bread that's mostly air",
    judgeA: "Thin. Warm. Everyone agrees it's excellent. Nobody's sure.",
    judgeB: "You'd eat a whole loaf and starve. Delicious fraud.",
  },
  {
    a: "Be recognized by the moon",
    b: "Be forgotten by the sun",
    judgeA: "It knows your gait. It's seen you sneak. It hasn't told.",
    judgeB: "It'd rise anyway. It just wouldn't rise for you. Cold.",
  },
  {
    a: "A very hungry garden",
    b: "A very generous swamp",
    judgeA: "It takes the seeds. It gives nothing. It's growing something.",
    judgeB: "It offers you things. Frogs, mostly. Accept them. It's trying.",
  },
  {
    a: "Wear yesterday's warmth",
    b: "Carry tomorrow's chill",
    judgeA: "The shirt off the line. Sun-baked. Nothing beats it.",
    judgeB: "Braced. Ready. Cold now, cold later. Sensible. Sad.",
  },
  {
    a: "A brave little door",
    b: "A cowardly big gate",
    judgeA: "It opens onto the storm. Every time. Without complaint.",
    judgeB: "It's shut. It's enormous. It's terrified. Of everything.",
  },
  {
    a: "Two spoons, no soup",
    b: "One soup, no spoon",
    judgeA: "Prepared. Hopeful. Useless. A metaphor. Let's move on.",
    judgeB: "Drink it. Just drink it. Nobody's watching. I'm watching.",
  },
  {
    a: "Be the one who remembers",
    b: "Be the one who lets go",
    judgeA: "Every birthday. Every grudge. Heavy pockets. Loved, though.",
    judgeB: "Light. Free. Occasionally called cold. Occasionally right.",
  },
  {
    a: "A honey that's too sweet",
    b: "A tea that's too true",
    judgeA: "One spoon and the day is ruined. Ruined beautifully.",
    judgeB: "You'd sip it and say the thing. The real thing. Oh no.",
  },
  {
    a: "Live in a lighthouse",
    b: "Live in a windmill",
    judgeA: "Alone with the light. The ships owe you. They never write.",
    judgeB: "Everything spins. Everything grinds. Bread forever, though.",
  },
  {
    a: "A ghost that whistles",
    b: "A wind that mutters",
    judgeA: "Cheerful. Off-key. Deeply annoying at three in the morning.",
    judgeB: "It's saying something. Under the door. You'd rather not know.",
  },
  {
    a: "A dog's memory of you",
    b: "A cat's opinion of you",
    judgeA: "Perfect. Golden. Better than you were. Live up to it.",
    judgeB: "Complicated. Ongoing. Under review. It has notes.",
  },
  {
    a: "A hill you always climb",
    b: "A valley you never leave",
    judgeA: "It never gets easier. The view never gets old. Fair trade.",
    judgeB: "Soft. Green. Enclosed. You'd be happy. You'd wonder.",
  },
  {
    a: "Whisper into the well",
    b: "Shout down the chimney",
    judgeA: "It keeps everything. It gives back only echoes. Trustworthy.",
    judgeB: "Soot. Startled birds. Everyone downstairs is now involved.",
  },
  {
    a: "A morning that waits for you",
    b: "An evening that hurries over",
    judgeA: "The light holds. The bread stays warm. The world is patient.",
    judgeB: "Dark by three. Cosy immediately. Suspiciously convenient.",
  },
  {
    a: "Be sung about badly",
    b: "Be painted unflatteringly",
    judgeA: "Wrong facts. Great tune. Everyone's humming it. Forever.",
    judgeB: "It hangs in the hall. It stares. It has your worst nose.",
  },
  {
    a: "Trust the fog",
    b: "Doubt the sun",
    judgeA: "It hides things. It also hides you. A complicated ally.",
    judgeB: "It shows up. It's warm. And yet — what's it want? Hmm.",
  },
  {
    a: "A shelf of good intentions",
    b: "A drawer of finished things",
    judgeA: "Dusty. Well-meant. The best shelf in the house, honestly.",
    judgeB: "Small. Rattling. Everything in it actually happened. Rare.",
  },
  {
    a: "One friend who never leaves",
    b: "Many friends who always return",
    judgeA: "Constant. Present. Occasionally you'd like an evening alone.",
    judgeB: "The door keeps opening. The kettle never cools. A good noise.",
  },
  {
    a: "A very determined seed",
    b: "A very reluctant flower",
    judgeA: "Through the flagstone. Through the wall. It's coming.",
    judgeB: "It bloomed under protest. It's beautiful. It's furious.",
  },
  {
    a: "The comfort of a routine",
    b: "The jolt of a surprise",
    judgeA: "Same walk. Same tea. Same fence. And yet, never boring.",
    judgeB: "Everything changes at noon. You'd hate it. You'd feel alive.",
  },
  {
    a: "A hat that catches rain",
    b: "A coat that catches light",
    judgeA: "You'd carry a small pond around. Free water. Some frogs.",
    judgeB: "You'd glow at dusk. Moths would follow. It's a whole thing.",
  },
  {
    a: "Be handed the good knife",
    b: "Be trusted with the last egg",
    judgeA: "The sharp one. The kitchen's blessing. Don't drop it.",
    judgeB: "There is no second egg. There is only this. Breathe.",
  },
  {
    a: "Learn one true thing",
    b: "Unlearn one false one",
    judgeA: "Small. Solid. It'd change everything. Slowly. Quietly.",
    judgeB: "You'd feel lighter. You'd miss it. It kept you company.",
  },
  {
    a: "A bench that faces the sunset",
    b: "A window that faces the road",
    judgeA: "One direction. One purpose. Sit down. Say nothing.",
    judgeB: "You'd see who's coming. You'd see who isn't. Rough.",
  },
  {
    a: "A cheese with a secret",
    b: "A wine with a temper",
    judgeA: "Something's in there. Something aged with it. Cut carefully.",
    judgeB: "It's fine. It's fine. It is not fine. Decant it. Apologize.",
  },
  {
    a: "Bees that recognize you",
    b: "Crows that gift you",
    judgeA: "They part around you. They know your smell. High honor.",
    judgeB: "A button. A bottle cap. One tooth. Say thank you. Mean it.",
  },
  {
    a: "A ladder with one rung missing",
    b: "A bridge with one plank loose",
    judgeA: "You know which. You still step there. Every time. Why.",
    judgeB: "It clatters. It holds. It has always held. So far.",
  },
  {
    a: "Nap through a thunderstorm",
    b: "Wake for a meteor shower",
    judgeA: "The best sleep there is. Loud outside. Safe inside. Perfect.",
    judgeB: "Cold grass. Three in the morning. Worth every shiver.",
  },
  {
    a: "A well that grants opinions",
    b: "A fountain that returns coins",
    judgeA: "Toss a coin, get a hot take. Nobody asked. It doesn't care.",
    judgeB: "It doesn't want your wishes. It's giving them back. Sorry.",
  },
  {
    a: "Be missed at the party",
    b: "Be noticed at the funeral",
    judgeA: "\"Where's it got to?\" That's love. Undramatic. Real.",
    judgeB: "You came. You wore the wrong coat. They remembered you came.",
  },
  {
    a: "A key made of ice",
    b: "A lock made of moss",
    judgeA: "One use. Melts in the hand. Whatever's inside was worth it.",
    judgeB: "It doesn't lock. It just grows. Nobody's tried it in years.",
  },
  {
    a: "Own the third-best boots",
    b: "Own the only umbrella",
    judgeA: "Adequate. Dry. Nobody envies them. Nobody steals them.",
    judgeB: "Power. Terrible, damp power. They'll all want to walk with you.",
  },
  {
    a: "A goose in the doorway",
    b: "A bull in the lane",
    judgeA: "You are not going out today. Reschedule everything.",
    judgeB: "Go the long way. Go now. Do not look back at it.",
  },
  {
    a: "Sleep under the table",
    b: "Dream under the stairs",
    judgeA: "The dog's spot. It's the best spot. It knew first.",
    judgeB: "Slanted. Dusty. Nobody would think to look. Ideal.",
  },
  {
    a: "Speak your mind, badly",
    b: "Hold your tongue, perfectly",
    judgeA: "The words come out sideways. The meaning lands anyway. Mostly.",
    judgeB: "Nothing said. Nothing regretted. Nothing changed. Hmm.",
  },
  {
    a: "A summer that keeps its word",
    b: "A winter that keeps its distance",
    judgeA: "It said warm. It meant warm. A rare honest season.",
    judgeB: "It stays out past the fence. It watches. It doesn't come in.",
  },
  {
    a: "A tidy little grief",
    b: "A messy great joy",
    judgeA: "Folded. Boxed. In the cupboard. You know exactly where.",
    judgeB: "Everywhere. On the walls. In the soup. Impossible to clean.",
  },
  {
    a: "The bread's respect",
    b: "The oven's forgiveness",
    judgeA: "It rises for you. Only for you. The neighbors have noticed.",
    judgeB: "For everything you've burned. It's a long list. It forgives.",
  },
  {
    a: "A cart with a mind of its own",
    b: "A horse with a schedule",
    judgeA: "It knows the way to the bakery. Only the bakery. Fine.",
    judgeB: "It stops at four. It doesn't discuss this. It never has.",
  },
  {
    a: "Be the joke everyone loves",
    b: "Be the story nobody finishes",
    judgeA: "You'd never be alone. You'd never be taken seriously. Trade.",
    judgeB: "\"And then it—\" Interrupted. Every time. Every single time.",
  },
  {
    a: "Whistle to stop the rain",
    b: "Clap to start the wind",
    judgeA: "It pauses. It waits. It resumes the second you stop. Rude.",
    judgeB: "You'd do it indoors once. Just once. The papers, everywhere.",
  },
  {
    a: "A pond with a memory",
    b: "A field with a grudge",
    judgeA: "Everything that ever fell in is still in there. Somewhere.",
    judgeB: "It won't grow where the cart went. It's been eleven years.",
  },
  {
    a: "Free tea, wrong temperature",
    b: "Perfect tea, once a year",
    judgeA: "Endless. Lukewarm. A small disappointment, hourly. Still tea.",
    judgeB: "One cup. Exquisite. You'd plan your calendar around it. Do it.",
  },
  {
    a: "A very polite thief",
    b: "An extremely rude gift",
    judgeA: "It took the spoon. It left a note. It apologized. Twice.",
    judgeB: "\"For your obvious needs.\" It's a mirror. It's a comb. Hurtful.",
  },
  {
    a: "Grow a tail in winter",
    b: "Shed your feet in spring",
    judgeA: "Warm. Balanced. Every chair now a negotiation.",
    judgeB: "Free-floating by May. The ghost in me is thrilled.",
  },
  {
    a: "The last log on the fire",
    b: "First light through the curtain",
    judgeA: "Ration it. Or don't. Burn it big. Sleep warm. Regret it at dawn.",
    judgeB: "A gray line on the floor. The whole day, still unspent.",
  },
  {
    a: "A cousin who is a crow",
    b: "An uncle who is a stump",
    judgeA: "Family gatherings are loud and full of shiny theft.",
    judgeB: "He says little. He's very stable. The forest respects him.",
  },
  {
    a: "Be woken for something good",
    b: "Be left asleep through the worst",
    judgeA: "\"Come see!\" It's the sky. It's always the sky. Worth it.",
    judgeB: "It happened. It passed. Nobody told you. Merciful, probably.",
  },
  {
    a: "A soup nobody can ruin",
    b: "A stew that improves with grudges",
    judgeA: "Salt it wrong. Burn it. It's still good. An honest soup.",
    judgeB: "Day three, someone's furious, it's never tasted better.",
  },
  {
    a: "Live where the mail is slow",
    b: "Live where the news is old",
    judgeA: "Everything arrives a week late. Including bad news. Fine by me.",
    judgeB: "The war ended in spring. You heard in autumn. Peaceful summer.",
  },
  {
    a: "A shadow with good posture",
    b: "A reflection with better manners",
    judgeA: "It stands up straight. You slouch. It's shaming you. Publicly.",
    judgeB: "It nods first. It smiles first. It's the better one. Accept it.",
  },
  {
    a: "Own one perfect map",
    b: "Own many wrong ones",
    judgeA: "Every road, true. No mystery left. A slightly smaller world.",
    judgeB: "You'd find places that aren't there. Some of them would be.",
  },
  {
    a: "A cat's warm spot",
    b: "A dog's happy noise",
    judgeA: "It just left. It's still warm. Sit there. This is inheritance.",
    judgeB: "That sound. The full-body one. Nothing on earth beats it.",
  },
  {
    a: "Be pardoned by the garden",
    b: "Be pursued by the hedge",
    judgeA: "For the weeding. For the trampling. It's letting it go. Kneel.",
    judgeB: "It's grown three feet toward the house. Since Tuesday. Run.",
  },
  {
    a: "A moon that keeps time",
    b: "A sun that keeps score",
    judgeA: "Reliable. Cyclical. It's never once been late. Show-off.",
    judgeB: "It knows how many days you wasted. It rises anyway. Judgy.",
  },
  {
    a: "One long, slow friendship",
    b: "Many bright, brief ones",
    judgeA: "Forty years. Three arguments. One unshakable thing.",
    judgeB: "Fireworks. Then quiet. Then new fireworks. Exhausting. Lovely.",
  },
  {
    a: "A ghost who plays cards",
    b: "A gnome who keeps accounts",
    judgeA: "It cheats. It's had centuries to practice. Play anyway.",
    judgeB: "You owe it for the muffins. Since 1802. With interest.",
  },
  {
    a: "Hear a secret from the wind",
    b: "Keep a secret from the moon",
    judgeA: "It heard it three fields over. It got it slightly wrong. Better.",
    judgeB: "It'll wait. It has all night. It has every night. Good luck.",
  },
  {
    a: "A cottage full of jars",
    b: "A barn full of echoes",
    judgeA: "Pickled everything. Labeled nothing. Winter is handled.",
    judgeB: "Say one word. Get eleven back. The cows find this tiresome.",
  },
  {
    a: "Be the sturdy one",
    b: "Be the sparkling one",
    judgeA: "They lean on you. Constantly. Nobody asks if you're tired.",
    judgeB: "They light up. Then they leave. You go home very tired.",
  },
  {
    a: "Trade sleep for one more hour",
    b: "Trade an hour for better sleep",
    judgeA: "You'd use it badly. You'd stare at the fire. Worth it.",
    judgeB: "Sensible. Restorative. The boring, correct answer. Do it.",
  },
  {
    a: "A door that sticks in the rain",
    b: "A window stuck open in the cold",
    judgeA: "Shove it. Swear at it. It'll open. It always opens eventually.",
    judgeB: "A permanent draft. On your neck. Personally. It's chosen you.",
  },
  {
    a: "Read the crow's newspaper",
    b: "Write the mole's memoirs",
    judgeA: "All theft. All gossip. Excellent circulation. Zero facts.",
    judgeB: "\"IT WAS DARK. IT WAS FINE. I DUG.\" A masterpiece. Truly.",
  },
  {
    a: "The good news, delayed",
    b: "The bad news, immediate",
    judgeA: "It arrives when you need it. Weeks late. Still glorious.",
    judgeB: "Rip it off. Get on with it. Painful. Efficient. Cruel.",
  },
  {
    a: "A bell that rings for supper",
    b: "A horn that means come home",
    judgeA: "Across the whole valley. Everyone starts walking. Beautiful.",
    judgeB: "Wherever you are. Whatever you're doing. You'd go. You'd run.",
  },
  {
    a: "Be beautiful in the fog",
    b: "Be ordinary in the sun",
    judgeA: "Half-seen. Half-invented. They'd talk about you for years.",
    judgeB: "Plain. Clear. Present. Frankly the braver option.",
  },
  {
    a: "A stew of everything left",
    b: "A pie of one good thing",
    judgeA: "Chaos. Cabbage. Something from Tuesday. Somehow: excellent.",
    judgeB: "One apple. One crust. Nothing hiding. A very honest pie.",
  },
  {
    a: "Live beside a very old wall",
    b: "Live beside a very new fence",
    judgeA: "It knows things. It's kept them. It'll outlive the house.",
    judgeB: "Eager. Straight. Full of opinions it hasn't earned yet.",
  },
  {
    a: "A cloud that owes you rain",
    b: "A field that owes you a harvest",
    judgeA: "It's been dry for weeks. It's avoiding you. It knows.",
    judgeB: "You did the work. It's thinking about it. Farming!",
  },
  {
    a: "Whistle the same tune forever",
    b: "Hum a new one each day",
    judgeA: "By year ten it's yours. It's you. Nobody can hear it otherwise.",
    judgeB: "Never a repeat. Never a favorite. A restless little life.",
  },
  {
    a: "A cat that brings you problems",
    b: "A dog that brings you sticks",
    judgeA: "A mouse. On the pillow. It loves you. This is love.",
    judgeB: "Too big. Wrong shape. Wet. And yet: the tail. Accept the stick.",
  },
  {
    a: "Be first to the well",
    b: "Be last from the field",
    judgeA: "Cold, clear, untouched water. Worth waking for. Barely.",
    judgeB: "The light goes. The work's done. Nobody's watching. Just you.",
  },
  {
    a: "A hat blessed by the rain",
    b: "Boots cursed by the mud",
    judgeA: "It never leaks. It never will. It's been through weather.",
    judgeB: "They squelch. They'll always squelch. The mud won that one.",
  },
  {
    a: "Be quoted by a child",
    b: "Be corrected by an owl",
    judgeA: "The wrong thing. The rude thing. Forever. In front of company.",
    judgeB: "\"Whooo.\" You were wrong about that. Somehow, you were wrong.",
  },
  {
    a: "A spring that comes early",
    b: "An autumn that stays late",
    judgeA: "Mud, hope, one confused crocus. Too soon. Wonderful anyway.",
    judgeB: "Golden into December. The trees don't know when to stop. Bless.",
  },
  {
    a: "A neighbor who bakes",
    b: "A neighbor who fixes",
    judgeA: "Bread on the step. No note. You've never spoken. Perfect.",
    judgeB: "The gate works now. So does the roof. You didn't ask. Terrifying.",
  },
  {
    a: "Hold the door for the storm",
    b: "Shut the door on the sun",
    judgeA: "Come in, then. Sit. Drip on the floor. Tell me everything.",
    judgeB: "Not today. Too much. The dark has the better thoughts anyway.",
  },
  {
    a: "A jar that catches fireflies",
    b: "A net that catches hums",
    judgeA: "Let them go by morning. That is the rule. It always has been.",
    judgeB: "The cube would take that personally. Extremely personally.",
  },
  {
    a: "Be the first name on the list",
    b: "Be the last one to leave",
    judgeA: "Always called. Always chosen. Rarely rested.",
    judgeB: "The chairs are up. The fire's out. It's just you. It's good.",
  },
  {
    a: "A very stubborn kettle",
    b: "A very hasty oven",
    judgeA: "It boils when it's ready. Not before. You will wait. You will.",
    judgeB: "Everything comes out early and raw. It's excited. Forgive it.",
  },
  {
    a: "A rock that's warm at night",
    b: "A pond that's cool at noon",
    judgeA: "It gives the day back, slowly. Sit on it. Say thank you.",
    judgeB: "The one mercy of summer. Get in. Everyone's already in.",
  },
  {
    a: "Wear a coat with a past",
    b: "Wear boots with a future",
    judgeA: "Someone loved it before you. There's a button missing. Wear it.",
    judgeB: "They're going somewhere. They're taking you. Pack lightly.",
  },
  {
    a: "A wish shouted into a well",
    b: "A wish whispered to a seed",
    judgeA: "It bounces. It comes back louder. That's not a yes.",
    judgeB: "It goes in the dirt. It takes a season. It comes up green.",
  },
  {
    a: "Be teased by the meadow",
    b: "Be taken seriously by the swamp",
    judgeA: "It tickles. It hides your things. It thinks you're funny.",
    judgeB: "It listens. It nods. It is prepared to help. Uncomfortably.",
  },
  {
    a: "One perfect afternoon",
    b: "A hundred acceptable mornings",
    judgeA: "You'd think about it forever. It'd ruin all the others. Worth it.",
    judgeB: "Toast. Tea. Fine light. It adds up to more than you'd expect.",
  },
  {
    a: "Sleep with the cat's permission",
    b: "Rise with the rooster's blessing",
    judgeA: "It's on your legs. You cannot move. You will not move.",
    judgeB: "It screamed. You got up. It's decided not to hold it against you.",
  },
  {
    a: "The stump's long silence",
    b: "The lantern's short flicker",
    judgeA: "It hasn't spoken since the tree. It's still deciding what to say.",
    judgeB: "One blink. It meant something. You'll be up all night on it.",
  },
  {
    a: "A soup for the grieving",
    b: "A cake for the guilty",
    judgeA: "You'd make it often. Nobody thanks you. You'd keep making it.",
    judgeB: "Too sweet. Too much. Everyone knows why it's there. Eat it.",
  },
  {
    a: "Be needed by the garden",
    b: "Be wanted by the woods",
    judgeA: "It dies without you. That's love, technically. Heavy, though.",
    judgeB: "It's fine without you. It'd just rather you came. That's rarer.",
  },
  {
    a: "Grow old very slowly",
    b: "Grow wise very suddenly",
    judgeA: "You'd see everyone off. Every one. That's the cost. It's steep.",
    judgeB: "One morning. All at once. You'd say less. You'd mean more.",
  },
  {
    a: "End on a good joke",
    b: "End on a warm nap",
    judgeA: "The room laughing. The door closing. A hell of an exit.",
    judgeB: "Sun on your side. Nothing left owed. That's the one. That's it.",
  },
];

export function randomWouldYou(rng: () => number = Math.random): WouldYou {
  return pick(WOULD_YOU, rng);
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}
