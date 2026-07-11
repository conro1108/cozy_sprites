// Dialogue banks + selection. Voice shifts by life stage and adult form.
// Tone: cute, dry, occasionally macabre, sometimes sincere.
// House rule: profanity caps out at "hell", used sparingly.

import { ILLNESSES } from "./types";
import type { AdultForm, AttentionWant, IllnessId, PetState, Stage } from "./types";

export type Category =
  | "hatch"
  | "idle"
  | "tap"
  | "annoyed"
  | "pat" // held/rubbed, not poked — always welcome
  | "pat_enough" // patted past the point of diminishing returns
  | "feed"
  | "feed_favorite"
  | "feed_disliked"
  | "full"
  | "poop"
  | "cake"
  | "carrot"
  | "cube"
  | "soup"
  | "medicine"
  | "dose" // first plague shot: cured of nothing yet
  | "clean"
  | "clean_nothing" // sweeping a floor with nothing on it
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

// --- Stage banks (egg / baby / child / teen have their own voice) ------------
const EGG: Bank = {
  hatch: ["Hello?", "It is crowded.", "Soon.", "I have reconsidered.", "Do not rush me."],
  idle: [
    "...",
    "*rocks slightly*",
    "It is crowded.",
    "Almost.",
    "I am busy forming.",
    "*a muffled thump*",
    "Five more minutes.",
    "I can hear everything, you know.",
  ],
  tap: ["*wobbles*", "Not yet.", "Patience.", "Occupied.", "*knocks back*"],
};

const BABY: Bank = {
  hatch: ["I just arrived.", "AA.", "Round.", "You are enormous.", "Which one is me?"],
  idle: [
    "AA.",
    "Why.",
    "Round.",
    "More.",
    "Too much world.",
    "I just arrived.",
    "The floor and I are friends.",
    "Big. Everything big.",
    "I saw a dust. Incredible.",
    "Nap? Nap.",
  ],
  tap: ["Hi.", "Hi!", "?", "You.", "Again!", "*happy wiggle*"],
  feed: ["More.", "Yum.", "Again!", "Food good.", "In it goes."],
  full: ["No.", "Full.", "Too round already."],
  poop: ["Oops.", "Sorry.", "It happened.", "I panicked."],
  clean: ["Yay.", "Clean!", "Nice."],
  sick: ["Feel bad.", "Ow.", "No good.", "Inside hurts."],
  sleep: ["Night night.", "Zzz.", "Dark now."],
  wake: ["Up!", "Morning!", "Again, day!"],
};

const CHILD: Bank = {
  idle: [
    "I found nothing.",
    "The floor is suspicious.",
    "I am incredibly busy.",
    "Unclear.",
    "What's that?",
    "I have a plan. It's secret.",
    "Do bugs know they're bugs?",
    "I counted to a hundred. Twice.",
    "I'm going to be something great.",
    "Watch this. Wait. Watch.",
    "I made up a song about soup.",
  ],
  tap: ["Hi again.", "You!", "Interesting.", "Bold.", "Tag. You're it.", "I knew you'd be back."],
  feed: ["Is there dessert?", "Acceptable trade.", "I earned this."],
  clean: ["I was saving that.", "Fine. Cleanliness.", "You missed a spot. Kidding."],
  sick: ["I don't feel like me.", "Everything is wobbly.", "Am I dying? Be honest."],
  win: ["I'm basically a legend.", "Did you see that?!", "Champion. Me."],
  lose: ["Best of a thousand.", "I let you win.", "The game is broken."],
};

const TEEN: Bank = {
  idle: [
    "I don't know what I am.",
    "This body is a rental.",
    "Everything itches.",
    "Do not look at me while I figure this out.",
    "I refuse to peak now.",
    "I'm going through something.",
    "Nobody understands. Especially me.",
    "I've changed. Or I'm about to. Unclear.",
    "Don't wait up.",
    "It's a phase. Probably. Hopefully.",
  ],
  tap: ["Don't perceive me.", "Whatever.", "Ugh.", "I'm busy becoming.", "Personal space.", "...hi. Tell no one."],
  call: ["Nothing. Forget it.", "I didn't call you.", "...maybe.", "Forget I said anything."],
  feed: ["I guess.", "Fine.", "I was going to eat anyway."],
  sick: ["Great. Perfect. Sick too.", "This tracks.", "Leave the medicine and go."],
  sleep: ["Finally.", "Don't read into it, but... thanks.", "Lights out. Good."],
};

// --- General fallback bank (used when a form/stage lacks a category) ---------
const GENERAL: Bank = {
  // A pat is not a poke. Nobody has to be talked into it.
  pat: [
    "*leans in*",
    "Oh. That's nice.",
    "Continue.",
    "*closes eyes*",
    "You have good hands. Structurally.",
    "This is acceptable forever.",
    "*small contented noise*",
    "I will allow this to happen to me.",
    "Yes. There. That exact spot.",
  ],
  pat_enough: [
    "*has been thoroughly patted*",
    "I'm full. Of pats.",
    "That's the pats. That's all of them.",
    "You've reached the end of the pats.",
    "*already maximally content*",
  ],
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
    "I have opinions about birds.",
    "A leaf fell. I allowed it.",
    "Somewhere, a door closed. Rude.",
    "I remembered something embarrassing from years ago. I am years old.",
    "The wind said my name. I said nothing back. Power move.",
    "I organized my thoughts. Both of them.",
    "What the hell is a mortgage.",
    "I've been standing here on purpose.",
    "If anyone asks, I was magnificent today.",
    "The sun is free. Suspicious.",
    "I would simply win a fight with a goose.",
    "Grass. Unbelievable stuff.",
  ],
  tap: [
    "Hey.",
    "You may stay.",
    "I like your giant face.",
    "We are associates now.",
    "I waited near the glass.",
    "Yes?",
    "That's my whole body, you know.",
    "Noted. Continue.",
    "One free pat. Redeemed.",
  ],
  annoyed: [
    "Enough.",
    "I am not a button.",
    "Control yourself.",
    "Reported.",
    "The walls are thin.",
    "I will bite. Lovingly. But still.",
    "Boundaries. Look it up.",
  ],
  feed: [
    "Finally.",
    "Acceptable.",
    "More.",
    "I suppose.",
    "This will do.",
    "Sustenance acquired.",
    "I was wasting away. Dramatically.",
    "My compliments to whoever.",
  ],
  feed_favorite: [
    "Finally, respect.",
    "This is the best food.",
    "You remembered.",
    "At last.",
    "Today is historically significant.",
    "You get me. You truly get me.",
  ],
  feed_disliked: [
    "Cruel.",
    "This is a stick.",
    "Absolutely not.",
    "I will remember this.",
    "Is this a punishment?",
    "Our relationship has changed.",
  ],
  cake: ["Finally, respect.", "Health is temporary.", "Again.", "Cake understands me.", "Don't tell the carrot."],
  carrot: [
    "Cruel.",
    "This is a stick.",
    "I suppose.",
    "I forgive the carrot.",
    "Crunchy penance.",
    "Fine. Vitamins. Whatever.",
  ],
  cube: [
    "The cube understands.",
    "What flavor was that?",
    "It hummed.",
    "This is not food.",
    "More geometry.",
    "It tasted like a low sound.",
    "I saw something in there.",
  ],
  soup: [
    "Warm. Governmental.",
    "The broth forgives.",
    "I feel repaired. Structurally.",
    "Someone's grandmother made this. Somewhere. Somehow.",
    "This is medicine with better publicity.",
    "*holds the bowl with both everything*",
  ],
  full: [
    "I am full.",
    "No. I am at capacity.",
    "Do I look like storage?",
    "Later.",
    "Physically impossible. Emotionally? Also no.",
  ],
  medicine: [
    "Betrayal.",
    "I taste shapes.",
    "That fixed something.",
    "Ugh. Effective.",
    "Science, probably.",
    "I feel less doomed. Slightly.",
  ],
  dose: [
    "One down. I still feel historic.",
    "It's working. Slowly. Keep going.",
    "The plague and I are negotiating.",
    "More. The doom persists.",
  ],
  poop: ["Do not look.", "A gift.", "Handle this.", "We don't need to discuss it.", "Nature is disgusting. I contribute."],
  clean: [
    "Thank you. Unfortunately.",
    "Much better.",
    "The floor is legal again.",
    "A fresh start.",
    "We shall never speak of it.",
    "Civilization returns.",
  ],
  clean_nothing: [
    "There is nothing to clean. This is about control, isn't it?",
    "The floor was already legal. Sweeping it again is a lifestyle.",
    "You good? You're polishing a meadow.",
    "*watches you sweep nothing* Riveting.",
    "Cleanliness is next to... this, apparently. Obsession.",
  ],
  sick: [
    "I have prepared my will.",
    "A terrible development.",
    "I have a condition.",
    "This is how I perish.",
    "Avenge me. Or at least feed me.",
    "Tell my story. Embellish it.",
  ],
  // win/lose are the fallback for every mini-game via sayCat(); a game with
  // something more specific to say passes its own `line` to finishGame()
  // instead (see fetch/hideseek/rps in menus.ts). Keep these game-agnostic.
  win: ["Obviously.", "Easy.", "As predicted.", "Skill. Pure skill.", "Write this down."],
  lose: [
    "That doesn't count.",
    "That was your fault.",
    "This game is rigged.",
    "Again.",
    "I demand a rematch.",
    "Definitely interference.",
  ],
  call: ["Hey.", "Come here.", "I require you.", "Psst.", "You. Now. Please.", "Attention. Urgently. Casually."],
  discipline_correct: ["Fair.", "Understood.", "Rude, but fair.", "...I did do that.", "Justice. Annoying."],
  discipline_incorrect: [
    "Rude.",
    "You have no authority here.",
    "I regret nothing.",
    "I will do it again.",
    "Wrongfully accused. Historic.",
    "I was framed. By circumstances.",
  ],
  sleep: ["Goodnight.", "Five more minutes.", "The moon is thinking.", "Off I go.", "Wake me if anything is beautiful."],
  wake: ["Ugh, morning.", "I was somewhere else.", "Who authorized daylight.", "The dream had better snacks."],
  farm: [
    "I always suspected agriculture.",
    "Will there be Wi-Fi?",
    "I have no transferable skills.",
    "I will become ungovernable.",
  ],
};

// --- Per-adult voices. Only distinctive categories overridden.
const ADULT: Record<AdultForm, Bank> = {
  dog: {
    // The dog was built for this.
    pat: [
      "THE HAND. THE HAND IS HERE.",
      "*entire body wags*",
      "Best thing. Best thing that has ever happened.",
      "Again again again again.",
      "I have never been happier and I say that every time.",
      "*thumps tail so hard the grass moves*",
    ],
    pat_enough: [
      "*still going* *will never stop* *is a little tired*",
      "I could do this forever. I am doing this forever.",
    ],
    idle: [
      "You came back!",
      "Throw it.",
      "Again.",
      "I found a smell.",
      "Best day so far.",
      "I love the door. It makes you.",
      "I guarded everything while you were gone.",
      "A bird!! Okay it's gone. A bird though!!",
      "I would die for you. Casually. No pressure.",
    ],
    win: ["Best day so far!", "We did it!", "Again again again!", "We're a team!!"],
    lose: ["We'll get it next time!!", "I had fun anyway!", "The winning was inside us all along."],
    farm: ["A farm?! With smells??", "I will guard the acreage.", "Will you visit?"],
    feed_favorite: ["BURGER. BURGER.", "Best food. Best you.", "Yes yes yes."],
    tap: ["Yes!! Hello!!", "More of this.", "I have been so good."],
  },
  blob: {
    idle: [
      "I grow weak.",
      "Remember me beautifully.",
      "My condition is mysterious.",
      "I have suffered enough.",
      "The light... it flatters me.",
      "If I fade, water the plant.",
      "I felt a draft. This may be the end.",
      "My memoirs are nearly complete. Chapter one: hunger.",
    ],
    lose: ["Fate betrayed me.", "This is how I perish.", "Remember me.", "Defeat. My oldest friend."],
    sick: ["It is finally happening.", "Cake may save me.", "Tell the others.", "I always knew it would end rurally... wait, wrong speech."],
    carrot: ["A carrot? Now?", "Cruel and unusual.", "You wish to see me suffer."],
    farm: ["I will perish rurally.", "The fields will mourn me.", "So this is goodbye."],
  },
  gremlin: {
    idle: [
      "Wasn't me.",
      "I know a secret.",
      "Cube, peasant.",
      "No witnesses.",
      "Hehehe.",
      "I hid something. Somewhere. Forever.",
      "The rules are more like suggestions.",
      "I licked something important. Guess.",
    ],
    win: ["I cheated. So?", "No witnesses.", "Skill issue, yours.", "The evidence is gone."],
    cube: ["MORE GEOMETRY.", "The cube is mine now.", "Give cube. Give."],
    poop: ["I moved it. For fun.", "You'll never find them all.", "Whoops. On purpose."],
    farm: ["I will unionize the chickens.", "Finally, room to commit crimes.", "The barn won't know what hit it."],
  },
  scholar: {
    idle: [
      "I am conducting research.",
      "The answer is seven.",
      "I have made a chart.",
      "My findings are upsetting.",
      "The cube is theoretically food.",
      "Preliminary results: the floor is floor.",
      "I've disproven the ceiling. Twice.",
      "Citation needed. From you. Now.",
    ],
    win: ["A breakthrough!", "As my model predicted.", "Peer review confirms: I win."],
    cake: ["Cake disrupts the mind.", "Empirically unwise.", "I'll allow it. Once."],
    carrot: ["Nutritionally optimal.", "Excellent. Rigorous.", "The correct choice."],
    farm: ["Fieldwork. Literal fieldwork.", "I shall study the soil.", "Grant me tenure, barn."],
  },
  office: {
    idle: [
      "Another day.",
      "Per my last beep.",
      "Let's circle back.",
      "I was not trained for this.",
      "I need a break.",
      "My calendar says no.",
      "This meadow could have been an email.",
      "I'm at capacity. Emotionally. Physically. Legally.",
    ],
    win: ["Noted. Moving on.", "Great, a win. Anyway.", "Let's not make this weird."],
    lose: ["Figures.", "Circling back to my loss.", "As expected of a Monday."],
    farm: ["Early retirement. Finally.", "Please forward my calls to the barn.", "I accept the severance."],
  },
  menace: {
    idle: [
      "How rustic.",
      "I suppose this will do.",
      "Do tidy up.",
      "You look tired.",
      "You may remain.",
      "The garden is adequate. Barely.",
      "I have judged everyone today. Quietly.",
      "Fetch my... actually, fetch everything.",
    ],
    win: ["Naturally.", "Was there ever a doubt?", "How droll that you tried."],
    feed_disliked: ["A burger? For me? How insulting.", "Take it away.", "I said no."],
    farm: ["I shall summer in the countryside.", "The peasants will adore me.", "Do send my things."],
  },
  ghost: {
    idle: [
      "...",
      "The dark was kind to me.",
      "I remember the lantern.",
      "You cared for me when you couldn't see me.",
      "I am here. Mostly.",
      "The night knows my name. So do you.",
      "*a cold, friendly draft*",
    ],
    tap: ["*your hand passes through, warmly*", "Felt that. Somehow.", "..."],
    win: ["I saw the outcome before it happened.", "The odds fear me.", "..."],
    sick: ["Can I even be sick? Apparently.", "This is embarrassing for both of us."],
    sleep: ["The dark is home.", "At last.", "*fades slightly, contentedly*"],
    farm: ["I will haunt it gently.", "The barn and I will get along.", "Every farm needs one of me."],
  },
  humcube: {
    idle: [
      "...",
      "The angles are kind today.",
      "*hums, one flat, endless note*",
      "You fed me squares. I remember every one.",
      "Six faces. I have counted them a thousand times. Still six.",
      "The cube is not negative. The cube simply is.",
      "I am mostly corners now. It is peaceful.",
      "Ask me later. I am resonating.",
    ],
    tap: ["*a low hum, in acknowledgement*", "You touched a face. It was fine.", "..."],
    win: ["The pattern was always going to be this.", "I heard it coming. I always do.", "The cube keeps score. The cube says: yes."],
    lose: ["The hum went on without me. No matter.", "A wrong note. I forgive it. Mostly.", "Even the cube misses one. Allegedly."],
    cube: ["Home.", "Ah. Myself.", "We understand each other, the cube and I."],
    feed_favorite: ["Home.", "The cube returns to the cube. Thank you.", "*hums a whole step higher*"],
    sleep: ["I fold inward.", "The humming quiets. A little.", "Goodnight. Mind the corners."],
    farm: ["The fields are also, technically, a grid.", "I will hum to the crops.", "A flat field. My favorite shape. Nearly."],
  },
  carrot: {
    idle: [
      "Crunch.",
      "I am what I ate.",
      "The soil remembers me fondly.",
      "Stay rooted.",
      "Purity is a practice. Also a vegetable.",
      "*radiates vitamin A*",
      "I have never even seen a burger. Keep it that way.",
    ],
    tap: ["*crisp*", "Careful — I bruise like a peach. A better, orange peach.", "Snack responsibly."],
    win: ["Clean living pays off.", "The carrot way provides.", "Naturally. I'm all fiber."],
    feed_favorite: [
      "Yes. The only food.",
      "As it was, so it shall be.",
      "*crunches, reverently*",
    ],
    feed_disliked: ["We don't eat that here.", "I took a vow.", "Get it away from me."],
    sleep: ["Back to the soil.", "*plants itself gently*", "Wake me at harvest."],
    farm: [
      "A garden! I'm home.",
      "I shall supervise the vegetables personally.",
      "Full circle.",
    ],
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
 *  ("The Audition"). Returns a moodier line if leaning that way. */
export function teenFlickerLine(
  leaning: AdultForm,
  rng: () => number = Math.random,
): string | null {
  const bank = ADULT[leaning].idle;
  if (!bank) return null;
  return bank[Math.floor(rng() * bank.length)];
}

// --- Chattiness --------------------------------------------------------------
// Not every interaction earns a line (design note: less noise, more charm).
// Important feedback always speaks; routine chatter rolls against a per-stage /
// per-form talkativeness.

const ALWAYS_SPEAK: ReadonlySet<Category> = new Set([
  "hatch",
  "sick",
  "medicine",
  "dose",
  "call",
  "clean_nothing", // the joke only lands if it actually comments
  "win",
  "lose",
  "full",
  "annoyed",
  "feed_favorite",
  "feed_disliked",
  "discipline_correct",
  "discipline_incorrect",
  "farm",
]);

// Tuned down from the first pass — routine chatter was landing too often and
// crowding out the moments that matter. Important feedback still always speaks
// (see ALWAYS_SPEAK); these only govern incidental idle/tap/feed lines.
const STAGE_CHATTINESS: Record<Stage, number> = {
  egg: 0.28,
  baby: 0.36,
  child: 0.5, // still the chatty kid, relatively
  teen: 0.22, // won't talk to you
  adult: 0.38, // overridden per form below
};

const FORM_CHATTINESS: Record<AdultForm, number> = {
  dog: 0.62,
  blob: 0.5,
  gremlin: 0.45,
  scholar: 0.4,
  office: 0.28,
  menace: 0.4,
  ghost: 0.18,
  humcube: 0.2, // quiet and cryptic, like the ghost — speaks when it matters
  carrot: 0.45, // evangelical about the lifestyle
};

export function speakChance(state: PetState, category: Category): number {
  if (ALWAYS_SPEAK.has(category)) return 1;
  if (state.stage === "adult" && state.form) return FORM_CHATTINESS[state.form];
  return STAGE_CHATTINESS[state.stage];
}

export function shouldSpeak(
  state: PetState,
  category: Category,
  rng: () => number = Math.random,
): boolean {
  return rng() < speakChance(state, category);
}

// --- Attention calls ----------------------------------------------------------
// Every call asks for something specific. Fake calls use the exact same lines —
// the whole con depends on sounding sincere.
const CALL_WANT_LINES: Record<AttentionWant, string[]> = {
  pat: [
    "One pat. I require exactly one pat.",
    "The head. It needs patting. Yours are the only hands here.",
    "Affection. Now. Briefly.",
    "A pat, please. This is time-sensitive.",
    "Pat me and we never speak of this request.",
  ],
  play: [
    "I demand entertainment.",
    "A game. Any game. Now-ish.",
    "Play with me or I begin a one-creature theatre production.",
    "I am so bored my thoughts have echoes.",
    "Entertain me. It's in your contract. I wrote it in.",
  ],
  snack: [
    "A snack. Urgently. Casually.",
    "The bowl situation is dire. Emotionally.",
    "Feed me and nobody gets dramatized.",
    "I require a small something. Food-shaped.",
    "Snack. This is a snack-based summons.",
  ],
};

// The cute payoff for actually giving it what it asked for.
const CALL_SATISFIED_LINES: Record<AttentionWant, string[]> = {
  pat: [
    "*melts slightly*",
    "Worth it. You're kept.",
    "*leans into it* Okay. Okay okay okay.",
    "Precisely the pat I ordered. Five stars.",
  ],
  play: [
    "YES. That's the stuff.",
    "*delighted wiggle* We should do everything together.",
    "My boredom has been defeated. You may bow.",
    "That was it. That was the thing I wanted.",
  ],
  snack: [
    "*happy crumbs*",
    "You DO listen.",
    "Exactly what the summons specified. Excellent work.",
    "*vibrating contentedly* Snack acquired.",
  ],
};

// You placated a demand it didn't need (a fake call, or food/play while it was
// already fed/content) instead of holding the line. It gloats.
const CALL_SPOILED_LINES = [
  "Hehehe. Worked.",
  "You fell for the oldest trick in the meadow.",
  "Sucker. Beloved sucker.",
  "I wasn't even upset. Incredible.",
  "*smug beyond description*",
];

// Poked when the call wants something a poke isn't. A pat now belongs here too:
// it asked to be held, and got jabbed. The distinction is the point.
const CALL_WRONG_LINES: Record<AttentionWant, string[]> = {
  pat: [
    "That was a poke. I asked for a PAT.",
    "Close. Now do it slower, and mean it.",
    "A pat has a duration. Look it up.",
    "Wrong verb. Try again with your whole hand.",
  ],
  play: [
    "A poke is not a game. A GAME is a game.",
    "Nice tap. Now entertain me properly.",
    "That's not playing. That's inventory-checking.",
  ],
  snack: [
    "I cannot eat a poke.",
    "That was not food. Try again with food.",
    "Your finger is not a snack. Probably.",
  ],
};

export function attentionCallLine(
  want: AttentionWant | null,
  rng: () => number = Math.random,
): string {
  const bank = CALL_WANT_LINES[want ?? "pat"];
  return bank[Math.floor(rng() * bank.length)];
}

export function attentionSatisfiedLine(
  want: AttentionWant,
  rng: () => number = Math.random,
): string {
  const bank = CALL_SATISFIED_LINES[want];
  return bank[Math.floor(rng() * bank.length)];
}

export function attentionSpoiledLine(rng: () => number = Math.random): string {
  return CALL_SPOILED_LINES[Math.floor(rng() * CALL_SPOILED_LINES.length)];
}

export function attentionWrongLine(
  want: AttentionWant,
  rng: () => number = Math.random,
): string {
  const bank = CALL_WRONG_LINES[want];
  return bank[Math.floor(rng() * bank.length)];
}

// --- Illness announcements (the joy of OG Oregon Trail) ----------------------
const ILLNESS_TEMPLATES = [
  (n: string, ill: string) => `${n} has ${ill}.`,
  (n: string, ill: string) => `${n} has come down with ${ill}.`,
  (n: string, ill: string) => `Bad news. ${n} has ${ill}.`,
];

export function illnessAnnouncement(
  name: string,
  illness: IllnessId,
  rng: () => number = Math.random,
): string {
  const t = ILLNESS_TEMPLATES[Math.floor(rng() * ILLNESS_TEMPLATES.length)];
  return t(name, ILLNESSES[illness].label);
}

// --- Dying dialogue ------------------------------------------------------------
// When the end is close, the pet's chatter turns to the matter at hand — and it
// names the circumstance. Ordered by narrative priority: illness trumps hunger
// trumps loneliness trumps generic doom.
const DYING_SICK = [
  "The end is near.",
  "Tell my story. The dramatic version.",
  "I see a light. It is shaped like a pill.",
  "Send... medicine... or a eulogist...",
];
const DYING_HUNGRY = [
  "So... hungry...",
  "The bowl. Remember the bowl?",
  "I would eat the carrot. That's how bad it is.",
  "Food... any food... even a stick...",
];
const DYING_LONELY = [
  "It's so quiet...",
  "Did we have fun once? I forget.",
  "Play with me. One last game. Any game.",
];
const DYING_GENERIC = [
  "The end is near.",
  "I'm cold. Emotionally. Also literally.",
  "Remember me beautifully.",
  "This is it, isn't it. Hold my little hand.",
];

/** True when the pet should be speaking its dying dialogue. */
export function isDying(state: PetState): boolean {
  return state.deadAt === null && (state.health <= 15 || state.zeroHealthMs > 0);
}

export function dyingLine(
  state: PetState,
  rng: () => number = Math.random,
): string {
  const bank = state.sick
    ? DYING_SICK
    : state.hunger <= 0.5
      ? DYING_HUNGRY
      : state.happiness <= 0.5
        ? DYING_LONELY
        : DYING_GENERIC;
  return bank[Math.floor(rng() * bank.length)];
}

// --- Rare idle easter eggs ------------------------------------------------------
// Once in a while the idle chatter drops a reference for the household. Rolled
// at low odds by the idle loop, never labeled, never repeated on demand.
export const RARE_IDLE_CHANCE = 0.07;
const RARE_IDLE = [
  "I dreamt a mole screamed at me for leaving without saying goodbye.",
  "If I'm ever sent to the farm, apparently a very loud mole takes attendance.",
  "I tried to ford a river once. We do not discuss the oxen.",
  "Should have caulked the wagon. Everyone says that afterward.",
];

export function rareIdleLine(rng: () => number = Math.random): string {
  return RARE_IDLE[Math.floor(rng() * RARE_IDLE.length)];
}

// --- Farm confirmation lines — darker the younger they are -------------------
// Sending an adult off is a retirement. Sending a baby is a decision you should
// feel. The button still works; the copy just looks you in the eye first.
const FARM_CONFIRM: Record<Stage, string[]> = {
  adult: [
    "“I always suspected agriculture.”",
    "“Will there be Wi-Fi?”",
    "“I suppose every story ends in a field.”",
  ],
  teen: [
    "“Is this because of what I was becoming?”",
    "“I never even got to find out what I am.”",
    "“Fine. Whatever. ...will you think about me?”",
  ],
  child: [
    "“But I just learned to like it here.”",
    "“Will you wave until I can't see you anymore?”",
    "“I'll be brave. Is that what you want me to be?”",
  ],
  baby: [
    "“I don't understand. Where are you going?”",
    "“I just arrived. I just arrived.”",
    "“Okay. I trust you. I don't know any better.”",
  ],
  egg: [
    "The egg cannot pack. It has no things.",
    "The egg trusts you completely. It has never known anything else.",
    "It hasn't even seen you yet.",
  ],
};

export function farmConfirmLine(
  stage: Stage,
  rng: () => number = Math.random,
): string {
  const lines = FARM_CONFIRM[stage];
  return lines[Math.floor(rng() * lines.length)];
}

// --- Retirement (the long goodbye) -------------------------------------------
// Adults don't die of old age here — they get restless, then ready, then one
// dawn they walk to the farm. The dialogue does most of the storytelling.

const RESTLESS_LINES = [
  "I've been thinking about fields.",
  "Do you ever wonder what's past the fence? I do. Professionally, now.",
  "I dreamed of a pasture. It knew my name.",
  "I'm not leaving. I'm just looking at the horizon more than usual.",
  "The wind smells like hay lately. I don't hate it.",
  "Somewhere out there is a gate with my name on it. Metaphorically. I checked.",
];

const READY_LINES = [
  "It's time, I think. Nearly.",
  "The farm is calling. It has my number somehow.",
  "I'm ready. Take your time. But I'm ready.",
  "Walk me over when you can. No rush. Some rush.",
  "I've packed. I own nothing. It went quickly.",
  "One more good day here, then the fields. Deal?",
];

export function retirementLine(
  phase: "restless" | "ready",
  rng: () => number = Math.random,
): string {
  const lines = phase === "ready" ? READY_LINES : RESTLESS_LINES;
  return lines[Math.floor(rng() * lines.length)];
}

/** Said on the walk over, when the player escorts a ready adult themselves. */
const FAREWELL_WALK_LINES = [
  "*takes one last look around* Good rectangle. Good you.",
  "Walk slow. I want to remember the route.",
  "This is not goodbye. It is agriculture.",
  "Thank you for all the soup. And the rest of it.",
];

export function farewellWalkLine(rng: () => number = Math.random): string {
  return FAREWELL_WALK_LINES[Math.floor(rng() * FAREWELL_WALK_LINES.length)];
}

/** The note left behind when a ready adult finally walks itself at dawn. */
const DEPARTED_NOTES = [
  "Went to the farm. The grass said hi first.",
  "Took the sunrise. Left you everything else.",
  "You were the best giant face I ever knew. Visit.",
  "Gone to be horizontal in a field. It's a career now.",
  "Do not water my opinions. They are perennial.",
];

export function departedNote(rng: () => number = Math.random): string {
  return DEPARTED_NOTES[Math.floor(rng() * DEPARTED_NOTES.length)];
}

// --- Memorial copy ------------------------------------------------------------
export function memorialLine(name: string, cause: string | null): string {
  return cause ? `${name} has died of ${cause}.` : `${name} has died.`;
}

const EPITAPHS = [
  "It was a good rectangle.",
  "The walls are quieter now.",
  "It never did find its elbows.",
  "The moon still owes it money.",
  "Beloved. Round. Occasionally legal.",
  "It suspected agriculture until the very end.",
];

export function epitaph(rng: () => number = Math.random): string {
  return EPITAPHS[Math.floor(rng() * EPITAPHS.length)];
}
