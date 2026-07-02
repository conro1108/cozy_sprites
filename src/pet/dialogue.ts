// Dialogue banks + selection. Voice shifts by life stage and adult form.
// Tone per SPEC §8: cute, dry, occasionally macabre, sometimes sincere.

import type { AdultForm, PetState, Stage } from "./types";

export type Category =
  | "hatch"
  | "idle"
  | "tap"
  | "annoyed"
  | "feed"
  | "feed_favorite"
  | "feed_disliked"
  | "full"
  | "poop"
  | "cake"
  | "carrot"
  | "cube"
  | "medicine"
  | "clean"
  | "sick"
  | "win"
  | "lose"
  | "call"
  | "discipline_correct"
  | "discipline_incorrect"
  | "sleep"
  | "wake"
  | "farm";

type Bank = Partial<Record<Category, string[]>>;

// --- Stage banks (egg / baby / teen have their own voice) --------------------
const EGG: Bank = {
  hatch: ["Hello?", "It is crowded.", "Soon.", "I have reconsidered."],
  idle: ["...", "*rocks slightly*", "It is crowded.", "Almost."],
  tap: ["*wobbles*", "Not yet.", "Patience."],
};

const BABY: Bank = {
  hatch: ["I just arrived.", "AA.", "Round."],
  idle: ["AA.", "Why.", "Round.", "More.", "Too much world.", "I just arrived."],
  tap: ["Hi.", "Hi!", "?", "You."],
  feed: ["More.", "Yum.", "Again!"],
  full: ["No.", "Full.", "Too round already."],
  poop: ["Oops.", "Sorry.", "It happened."],
  clean: ["Yay.", "Clean!"],
  sick: ["Feel bad.", "Ow.", "No good."],
};

const CHILD: Bank = {
  idle: ["I found nothing.", "The floor is suspicious.", "I am incredibly busy.", "Unclear.", "What's that?"],
  tap: ["Hi again.", "You!", "Interesting.", "Bold."],
};

const TEEN: Bank = {
  idle: [
    "I don't know what I am.",
    "This body is a rental.",
    "Everything itches.",
    "Do not look at me while I figure this out.",
    "I refuse to peak now.",
  ],
  tap: ["Don't perceive me.", "Whatever.", "Ugh.", "I'm busy becoming."],
  call: ["Nothing. Forget it.", "I didn't call you.", "...maybe."],
};

// --- General fallback bank (used when a form/stage lacks a category) ---------
const GENERAL: Bank = {
  idle: [
    "Took you long enough.",
    "You again.",
    "Interesting choice.",
    "The void has excellent posture.",
    "Soup is a temporary government.",
    "My uncle is a website.",
    "I have committed tax fraud.",
    "The walls are thin.",
    "You always come back eventually.",
    "This is a good rectangle.",
    "The moon owes me money.",
    "I cannot locate my elbows.",
    "Do not perceive me.",
    "Today has too many hours.",
  ],
  tap: ["Hey.", "You may stay.", "I like your giant face.", "We are associates now.", "I waited near the glass."],
  annoyed: ["Enough.", "I am not a button.", "Control yourself.", "Reported.", "The walls are thin."],
  feed: ["Finally.", "Acceptable.", "More.", "I suppose."],
  feed_favorite: ["Finally, respect.", "This is the best food.", "You remembered.", "At last."],
  feed_disliked: ["Cruel.", "This is a stick.", "Absolutely not.", "I will remember this."],
  cake: ["Finally, respect.", "Health is temporary.", "Again."],
  carrot: ["Cruel.", "This is a stick.", "I suppose.", "I forgive the carrot."],
  cube: ["The cube understands.", "What flavor was that?", "It hummed.", "This is not food.", "More geometry."],
  full: ["I am full.", "No. I am at capacity.", "Do I look like storage?", "Later."],
  medicine: ["Betrayal.", "I taste shapes.", "That fixed something."],
  poop: ["Do not look.", "A gift.", "Handle this."],
  clean: ["Thank you. Unfortunately.", "Much better.", "The floor is legal again."],
  sick: ["I have prepared my will.", "A terrible development.", "I have a condition.", "This is how I perish."],
  win: ["Obviously.", "Easy.", "As predicted."],
  lose: ["The numbers cheated.", "That was your fault.", "Statistics are fake.", "Again."],
  call: ["Hey.", "Come here.", "I require you.", "Psst."],
  discipline_correct: ["Fair.", "Understood.", "Rude, but fair."],
  discipline_incorrect: ["Rude.", "You have no authority here.", "I regret nothing.", "I will do it again."],
  sleep: ["Goodnight.", "Five more minutes.", "The moon is thinking.", "Off I go."],
  wake: ["Ugh, morning.", "I was somewhere else.", "Who authorized daylight."],
  farm: ["I always suspected agriculture.", "Will there be Wi-Fi?", "I have no transferable skills.", "I will become ungovernable."],
};

// --- Per-adult voices (SPEC §12/§13). Only distinctive categories overridden.
const ADULT: Record<AdultForm, Bank> = {
  dog: {
    idle: ["You came back!", "Throw it.", "Again.", "I found a smell.", "Best day so far."],
    win: ["Best day so far!", "We did it!", "Again again again!"],
    farm: ["A farm?! With smells??", "I will guard the acreage.", "Will you visit?"],
    feed_favorite: ["BURGER. BURGER.", "Best food. Best you.", "Yes yes yes."],
  },
  blob: {
    idle: ["I grow weak.", "Remember me beautifully.", "My condition is mysterious.", "I have suffered enough."],
    lose: ["The numbers betrayed me.", "This is how I perish.", "Remember me."],
    sick: ["It is finally happening.", "Cake may save me.", "Tell the others."],
    carrot: ["A carrot? Now?", "Cruel and unusual.", "You wish to see me suffer."],
    farm: ["I will perish rurally.", "The fields will mourn me.", "So this is goodbye."],
  },
  gremlin: {
    idle: ["Wasn't me.", "I know a secret.", "Cube, peasant.", "No witnesses.", "Hehehe."],
    win: ["I cheated. So?", "No witnesses.", "Skill issue, yours."],
    cube: ["MORE GEOMETRY.", "The cube is mine now.", "Give cube. Give."],
    poop: ["I moved it. For fun.", "You'll never find them all.", "Whoops. On purpose."],
    farm: ["I will unionize the chickens.", "Finally, room to commit crimes.", "The barn won't know what hit it."],
  },
  scholar: {
    idle: ["I am conducting research.", "The answer is seven.", "I have made a chart.", "My findings are upsetting.", "The cube is theoretically food."],
    win: ["A breakthrough!", "As my model predicted.", "Peer review confirms: I win."],
    cake: ["Cake disrupts the mind.", "Empirically unwise.", "I'll allow it. Once."],
    carrot: ["Nutritionally optimal.", "Excellent. Rigorous.", "The correct choice."],
    farm: ["Fieldwork. Literal fieldwork.", "I shall study the soil.", "Grant me tenure, barn."],
  },
  office: {
    idle: ["Another day.", "Per my last beep.", "Let's circle back.", "I was not trained for this.", "I need a break."],
    win: ["Noted. Moving on.", "Great, a win. Anyway.", "Let's not make this weird."],
    lose: ["Figures.", "Circling back to my loss.", "As expected of a Monday."],
    farm: ["Early retirement. Finally.", "Please forward my calls to the barn.", "I accept the severance."],
  },
  menace: {
    idle: ["How rustic.", "I suppose this will do.", "Do tidy up.", "You look tired.", "You may remain."],
    win: ["Naturally.", "Was there ever a doubt?", "How droll that you tried."],
    feed_disliked: ["A burger? For me? How insulting.", "Take it away.", "I said no."],
    farm: ["I shall summer in the countryside.", "The peasants will adore me.", "Do send my things."],
  },
};

function bankForStage(stage: Stage): Bank {
  switch (stage) {
    case "egg":
      return EGG;
    case "baby":
      return BABY;
    case "child":
      return CHILD;
    case "teen":
      return TEEN;
    default:
      return GENERAL;
  }
}

export function pickLine(
  state: PetState,
  category: Category,
  rng: () => number = Math.random,
): string | null {
  // Adult voice takes priority, then stage voice, then the general bank.
  const sources: Bank[] = [];
  if (state.stage === "adult" && state.form) sources.push(ADULT[state.form]);
  sources.push(bankForStage(state.stage));
  sources.push(GENERAL);

  for (const bank of sources) {
    const lines = bank[category];
    if (lines && lines.length) return lines[Math.floor(rng() * lines.length)];
  }
  return null;
}

/** Occasionally the pet leaks a candidate-adult flavour line during Teen
 *  (SPEC §4 "The Audition"). Returns a moodier line if leaning that way. */
export function teenFlickerLine(
  leaning: AdultForm,
  rng: () => number = Math.random,
): string | null {
  const bank = ADULT[leaning].idle;
  if (!bank) return null;
  return bank[Math.floor(rng() * bank.length)];
}
