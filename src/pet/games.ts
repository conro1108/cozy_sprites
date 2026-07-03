// Mini-game logic. Kept pure and rng-injectable; the UI owns presentation.

import type { Stage } from "./types";

export type RpsMove = "rock" | "paper" | "scissors";
export type Outcome = "win" | "lose" | "tie";

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
  | "distracted" // never even commits to the chase
  | "cube"; // returns holding the cube. You threw a ball.

export interface FetchResult {
  success: boolean;
  variant: FetchVariant;
  line: string;
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
): FetchResult {
  // Very rarely the ball simply… isn't what comes back. (rng>0.93 rather than
  // <0.07 so the tests' rng:()=>0 stays on the ordinary path.)
  if (rng() > 0.93) {
    return { success: true, variant: "cube", line: pick(FETCH_LINES.cube, rng) };
  }
  // Sweet spot is the middle of the meter; edges fumble. Youth fumbles more.
  const quality = 1 - Math.abs(power - 0.6) * 2 - STAGE_FUMBLE[stage];
  if (quality > 0.45) {
    const variant: FetchVariant = rng() < 0.22 ? "epic" : "return";
    return { success: true, variant, line: pick(FETCH_LINES[variant], rng) };
  }
  const fails: FetchVariant[] = ["wrongway", "overfence", "sock", "distracted"];
  const variant = fails[Math.floor(rng() * fails.length)];
  return { success: false, variant, line: pick(FETCH_LINES[variant], rng) };
}

const FETCH_LINES: Record<FetchVariant, string[]> = {
  return: [
    "Retrieved it. Flawless.",
    "Got it!",
    "Perfect return.",
    "That one felt personal.",
    "Delivered. Slightly damp. You're welcome.",
  ],
  epic: [
    "Caught it on the first bounce. Legend.",
    "Snatched it out of the air. Unreal.",
    "It never stood a chance.",
  ],
  wrongway: [
    "Ran straight past it.",
    "Went the wrong way. Fully committed.",
    "Sprinted confidently away from the ball.",
  ],
  overfence: [
    "The ball has emigrated.",
    "Watched it sail over the fence. Waved.",
    "It's the neighbour's ball now.",
  ],
  sock: [
    "Brought back a sock.",
    "Brought back the wrong object entirely.",
    "Returned with one damp sock. Whose?",
  ],
  distracted: [
    "Got distracted by a superior smell.",
    "Lay down halfway.",
    "Watched it land. Did nothing.",
    "Found a beetle instead. The beetle is furious.",
  ],
  cube: [
    "This is not the ball. It is better. It is the cube.",
    "The cube wished to be fetched. Who am I to argue.",
    "It hummed the whole way home.",
    "I threw a ball. It came back a cube. Do not ask me either.",
  ],
};

// --- Hide and Seek ----------------------------------------------------------
export const HIDE_SPOTS = ["behind the stump", "in the flowers", "behind the fence", "under the mushroom"] as const;
export type HideSpot = (typeof HIDE_SPOTS)[number];

export function pickHideSpot(rng: () => number = Math.random): HideSpot {
  return HIDE_SPOTS[Math.floor(rng() * HIDE_SPOTS.length)];
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
];

export function randomWouldYou(rng: () => number = Math.random): WouldYou {
  return pick(WOULD_YOU, rng);
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}
