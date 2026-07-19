// Dialogue banks + selection. Voice shifts by life stage and adult form.
// Tone: cute, dry, occasionally macabre, sometimes sincere.
// House rule: profanity caps out at "hell", used sparingly.

import { ILLNESSES } from "./types";
import type { AdultForm, AttentionWant, IllnessId, PetState, Stage } from "./types";
import { OVERWEIGHT, UNDERWEIGHT } from "./state";

export type Category =
  | "hatch"
  | "idle"
  | "tap"
  | "annoyed"
  | "shush" // poked again while asleep — knock it off
  | "pat" // held/rubbed, not poked — always welcome
  | "pat_enough" // patted past the point of diminishing returns
  | "feed"
  | "feed_favorite"
  | "feed_disliked"
  | "full"
  | "poop"
  | "poop_bad" // a bad-quality mess — only GENERAL defines it, everyone else falls through
  | "cake"
  | "carrot"
  | "cube"
  | "soup"
  | "soup_cure" // soup fed to a soup-curable illness — the folk remedy landing
  | "nap_cure" // woke up cured after a daytime lie-down (the vapors)
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

// Baby vocab rule: one to four words, sounds, or *actions*. It has maybe
// thirty words total and half of them are "AA." Anything longer than a
// breath belongs to an older stage. Without its own version of a category
// the fallback ladder hands a baby the GENERAL bank's fully-grown snark —
// so the baby covers every category it can plausibly experience.
const BABY: Bank = {
  hatch: ["I just arrived.", "AA.", "Round.", "You are enormous.", "Which one is me?", "*blinks*", "Bright!"],
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
    "*chews nothing*",
    "*falls over softly*",
    "Blep.",
    "Foot! Mine?",
    "*investigates the ground*",
    "Wow.",
    "AA. AA.",
    "*sits, triumphantly*",
    "Grass? Grass.",
    "*small sneeze*",
  ],
  tap: ["Hi.", "Hi!", "?", "You.", "Again!", "*happy wiggle*", "*boops back*", "Beh.", "!"],
  pat: [
    "*drools*",
    "*melts a little*",
    "*happy noise*",
    "Mmm.",
    "More head.",
    "*leans entire self*",
    "*pat received*",
    "Good. Good good.",
  ],
  pat_enough: ["*asleep-ish*", "*full of pat*", "Mm. Done.", "*wobbles away, content*"],
  annoyed: ["No!", "AA!", "Too much!", "*wobbles off*", "Stop it!"],
  shush: ["Zzz...!", "*grumpy wiggle*", "Mmf.", "No. Sleep.", "*pulls dark closer*"],
  feed: ["More.", "Yum.", "Again!", "Food good.", "In it goes.", "*chews loudly*", "Nom.", "All gone?"],
  feed_favorite: ["YUM.", "Best!", "*happy stomp*", "Again again!", "This one!!"],
  feed_disliked: ["No.", "Bad.", "*spits a little*", "Yuck.", "Not this."],
  cake: ["Sweet!!", "*vibrating*", "More this.", "Cake!!"],
  carrot: ["Crunchy.", "Orange.", "*gnaws*", "Hard food."],
  cube: ["Cold.", "?", "*licks it anyway*", "Hums?"],
  soup: ["Warm.", "*slurps*", "Splashy.", "Good bowl."],
  full: ["No.", "Full.", "Too round already.", "*pats own tummy*", "Can't."],
  poop: ["Oops.", "Sorry.", "It happened.", "I panicked."],
  poop_bad: ["Ow.", "Tummy sad.", "Bad food. Bad me.", "That one hurt."],
  clean: ["Yay.", "Clean!", "Nice.", "*sparkles, roughly*", "All better."],
  sick: ["Feel bad.", "Ow.", "No good.", "Inside hurts.", "*small whimper*", "Help?"],
  medicine: ["Yuck!", "*shudders*", "Bad juice.", "Better? Better.", "Mmf."],
  win: ["Yay!", "I did it!", "*victory wobble*", "Again!", "Me!!"],
  lose: ["Oh.", "*confused*", "Game hard.", "Again anyway!", "*claps for you*"],
  call: ["AA!", "You! Come!", "Hey. Hey. Hey.", "*urgent wiggling*"],
  sleep: ["Night night.", "Zzz.", "Dark now.", "*yawns hugely*", "Bye."],
  wake: ["Up!", "Morning!", "Again, day!", "*stretches everything*", "Hi, sun."],
};

// Child vocab rule: short full sentences, everything a discovery, a contest,
// or a secret plan. Bigger words show up but get used slightly wrong.
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
    "I dug a hole. You can't see it.",
    "When I'm big I'll be nocturnal.",
    "I raced a cloud. I won.",
    "The fence knows something.",
    "I taught a rock to sit.",
    "Today I'm an explorer. Tomorrow too.",
    "I have a nemesis. It's a specific bee.",
    "I invented a new number. It's between four and five.",
    "Guess what. No, guess.",
  ],
  tap: [
    "Hi again.",
    "You!",
    "Interesting.",
    "Bold.",
    "Tag. You're it.",
    "I knew you'd be back.",
    "Were you watching? Watch.",
    "I was JUST about to do something cool.",
  ],
  pat: [
    "*accepts, wiggling*",
    "Heh. Again.",
    "I'm not a baby. But okay.",
    "You may pat the explorer.",
    "*leans in, pretending not to*",
  ],
  pat_enough: ["Okay okay, I have stuff to do.", "Enough. I'm recharged.", "*squirms free, grinning*"],
  annoyed: ["Quit it!", "I'm BUSY.", "You're gonna wreck my plan!", "Hey! I'm not a drum."],
  shush: ["I'm asleep. Obviously.", "*fake snores*", "Shh, I'm dreaming about winning.", "Go awaaay."],
  feed: ["Is there dessert?", "Acceptable trade.", "I earned this.", "Explorers need fuel.", "What's in it? Never mind."],
  feed_favorite: ["YES. The good one!", "You're my favorite too.", "This is the best day of my week."],
  feed_disliked: ["Aw, WHAT.", "Do I have to?", "I'll eat it but I won't like it.", "This is a trick."],
  cake: ["CAKE. It's a cake day!", "Sugar makes me faster.", "Can my birthday be daily?"],
  carrot: ["Crunch power.", "Fine. For strength.", "Carrots help you see secrets. Probably."],
  cube: ["It's humming. Listen. LISTEN.", "Cold and weird. I love it.", "I bet nobody else has eaten geometry."],
  soup: ["Slurp mission accepted.", "Warm! My insides say thanks.", "I found a whole vegetable in there. Treasure."],
  full: ["Can't. Full of earlier food.", "My stomach says no thank you.", "Save it for after my adventure."],
  poop: ["Uh. That's not mine.", "It followed me here.", "Okay it's mine. Don't tell.", "Nature happened."],
  clean: ["I was saving that.", "Fine. Cleanliness.", "You missed a spot. Kidding.", "Now there's room for my stuff."],
  sick: ["I don't feel like me.", "Everything is wobbly.", "Am I dying? Be honest.", "My insides are being weird on purpose."],
  medicine: ["Do I get a prize after?", "Blech. Tastes like purple.", "I'm brave. Watch how brave.", "That better work."],
  win: ["I'm basically a legend.", "Did you see that?!", "Champion. Me.", "Add it to my record!", "Undefeated. Mostly."],
  lose: ["Best of a thousand.", "I let you win.", "The game is broken.", "I wasn't ready. Rematch.", "Hmph. Lucky."],
  call: ["Hey! Come here! It's important!", "I need you for a thing!", "Emergency! A fun one!"],
  discipline_correct: ["...okay that's fair.", "How did you KNOW?", "I regret being caught."],
  discipline_incorrect: ["I didn't even DO anything!", "This is so unfair.", "You'll feel bad about this later."],
  sleep: ["Five more minutes of being awesome.", "The dark is for planning.", "Night. Guard my stuff."],
  wake: ["Morning! What are we doing?!", "I dreamed I was huge.", "Today's the day. For something."],
};

// Teen vocab rule: full command of language, deployed mostly to deflect.
// Every sincere feeling arrives wrapped in three layers of whatever.
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
    "I'm not moody. The world is.",
    "I had a whole personality picked out. Lost the receipt.",
    "Everyone else seems finished. Suspicious.",
    "I practiced being someone today. Didn't fit.",
    "Yesterday's me was embarrassing. Tomorrow's might be worse.",
    "I contain multitudes. None of them agree.",
  ],
  tap: [
    "Don't perceive me.",
    "Whatever.",
    "Ugh.",
    "I'm busy becoming.",
    "Personal space.",
    "...hi. Tell no one.",
    "What. WHAT.",
    "You're so embarrassing. Stay though.",
  ],
  pat: [
    "Okay but be quick about it.",
    "*allows it, looking elsewhere*",
    "I'm too old for-- fine. Fine.",
    "If anyone asks, this didn't happen.",
    "...one more.",
  ],
  pat_enough: ["That's plenty. Boundaries.", "Okay, we're done being soft.", "*shakes it off, recomposes*"],
  annoyed: ["Oh my GOD.", "Stop.", "You're unbelievable.", "I cannot be poked into a good mood."],
  shush: ["I'm ASLEEP.", "Unbelievable. Even at night.", "*pointedly rolls over*"],
  call: ["Nothing. Forget it.", "I didn't call you.", "...maybe.", "Forget I said anything.", "It's not a big deal. But come here."],
  feed: ["I guess.", "Fine.", "I was going to eat anyway.", "Thanks. Or whatever.", "You didn't have to. ...thanks."],
  feed_favorite: ["Okay this slaps. Tell no one.", "...you remembered.", "Fine. This is objectively good."],
  feed_disliked: ["You're joking.", "I'd rather starve. Slightly.", "This is a statement and I hear it."],
  cake: ["Sugar is the only honest food.", "Cake gets it.", "Don't make it a thing. It's just cake."],
  carrot: ["Wow. Health. Radical.", "Crunching angrily is still crunching.", "Fine. FINE. It's good for me."],
  cube: ["The cube doesn't judge me.", "Cold. Relatable.", "It hums. I get it, honestly."],
  soup: ["Soup understands transitional periods.", "Warm. Annoyingly comforting.", "I didn't cry into it. It was already salty."],
  full: ["I literally cannot.", "I'm at capacity. Like, in general.", "Later. Maybe."],
  poop: ["We will NOT be discussing this.", "That's between me and the floor.", "Grow up. It's biology."],
  clean: ["Finally. It was ruining my vibe.", "Cool. Thanks. Whatever.", "I was going to do that."],
  sick: ["Great. Perfect. Sick too.", "This tracks.", "Leave the medicine and go.", "Of course this is happening to me."],
  medicine: ["Ugh. Fine. Give it.", "If I die, delete my search history.", "That was disgusting and it worked. Typical."],
  win: ["Called it.", "Whatever. I'm good at stuff.", "Don't make it weird. But yes. I won.", "*suppresses a grin*"],
  lose: ["Rigged.", "I wasn't even trying.", "Cool game. Broken, but cool.", "This means nothing to me. *stares at result*"],
  discipline_correct: ["Whatever. Fair, I guess.", "Ugh. You're right. Gross.", "Fine. I'm the villain."],
  discipline_incorrect: ["Are you SERIOUS right now?", "Unbelievable. I was innocent.", "I'll remember this in my memoir."],
  sleep: ["Finally.", "Don't read into it, but... thanks.", "Lights out. Good.", "Waking me up is a crime. Remember that."],
  wake: ["No.", "Five more hours.", "The morning is a personal attack.", "I'm up. I'm not happy about it. But I'm up."],
};

// --- General fallback bank (used when a form/stage lacks a category) ---------
const GENERAL: Bank = {
  // A pat is not a poke. Nobody has to be talked into it.
  pat: [
    "*leans in*",
    "Oh. That's nice.",
    "Continue.",
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
    "I practiced my acceptance speech. For nothing specific.",
    "A cloud shaped like a better cloud went by.",
    "I know things about the fence. Terrible things.",
    "My shadow has been copying me all day. Flattering.",
    "Somewhere it is raining and it is not my problem.",
    "I stood very still and became furniture for a while.",
    "The horizon keeps its distance. Smart.",
    "I had a thought earlier. It'll come back. They always do.",
    "Every day the sun shows up. No notes. Incredible work ethic.",
    "I forgave the stairs. It was time.",
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
  shush: [
    "Shh.",
    "Baby's sleeping.",
    "The eye is open. The rest of me is not.",
    "Five more minutes. I mean it this time.",
    "Some of us have dreams to attend to.",
    "...I saw that.",
    "Rude. I am off duty.",
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
    "Nutritionally unremarkable. Emotionally, five stars.",
    "Someone's grandmother made this. Somewhere. Somehow.",
    "It doesn't fix anything. It just feels like it might.",
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
  // The anti-medicine: it works AND it's nice. Warm, sincere, a little smug.
  soup_cure: [
    "Oh. Oh, that's the stuff.",
    "The soup knew what to do.",
    "Cured. By broth. Take that, science.",
    "I can feel my face again.",
    "Warm. Fixed. Grateful.",
    "This is why I keep you around.",
  ],
  // Woke up cured after a proper daytime lie-down (the vapors' one folk cure).
  nap_cure: [
    "Oh. That worked.",
    "The nap fixed me. Don't tell science.",
    "I feel unwavery.",
    "Rested. Cured. Smug about both.",
    "The vapors have left the building.",
  ],
  dose: [
    "One down. I still feel historic.",
    "It's working. Slowly. Keep going.",
    "The plague and I are negotiating.",
    "More. The doom persists.",
  ],
  poop: ["Do not look.", "A gift.", "Handle this.", "We don't need to discuss it.", "Nature is disgusting. I contribute."],
  poop_bad: ["That one fought back.", "Structural integrity: none.", "My gut and I are no longer speaking.", "I blame my recent choices."],
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
  win: [
    "Obviously.",
    "Easy.",
    "As predicted.",
    "Skill. Pure skill.",
    "Write this down.",
    "Somebody frame this moment.",
    "I make it look effortless because it was.",
  ],
  lose: [
    "That doesn't count.",
    "That was your fault.",
    "This game is rigged.",
    "Again.",
    "I demand a rematch.",
    "Definitely interference.",
    "The sun was in my eyes. Indoors? Yes.",
    "I'm choosing to grow from this. Later.",
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
      "You're doing it!! You're doing the thing!!",
      "*presses head into hand with full trust*",
    ],
    pat_enough: [
      "*still going* *will never stop* *is a little tired*",
      "I could do this forever. I am doing this forever.",
      "*vibrating at a lower, contented frequency*",
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
      "I dug a hole! For us!",
      "The wind has NEWS.",
      "I love it here. Where is here? Doesn't matter!!",
      "I smelled your footsteps from yesterday. Classic you.",
      "Today I protected you from a leaf. You're welcome.",
    ],
    win: ["Best day so far!", "We did it!", "Again again again!", "We're a team!!", "I knew we had it!!"],
    lose: ["We'll get it next time!!", "I had fun anyway!", "The winning was inside us all along.", "You're still the best. I checked."],
    feed: ["FOOD. And it's for ME?", "*inhales it, then remembers to chew*", "You feed me AND you exist? Incredible."],
    feed_favorite: ["BURGER. BURGER.", "Best food. Best you.", "Yes yes yes."],
    feed_disliked: ["It doesn't smell like anything. How do I love it?", "Can't fetch it. Can't eat it. What IS it.", "I'll eat it. For you."],
    full: ["I can't believe I'm saying this. No more. ... Ask again in a second.", "My tummy voted no. My mouth is appealing the decision."],
    call: ["You've been gone FOREVER. It's been a minute. Forever.", "Come here, come here. I have to show you something. It's the floor.", "HEY. Hi. It's me. Come here. Please please please."],
    discipline_correct: ["You're right. I knew it was bad. I did it anyway.", "I'm sorry, I'm sorry, watch how good I'll be."],
    discipline_incorrect: ["But I was GOOD. ... Wasn't I good? I'll be gooder.", "That wasn't me! ... Either way, I forgive you already."],
    tap: ["Yes!! Hello!!", "More of this.", "I have been so good.", "*spins once, availably*"],
    sick: ["I don't feel like fetching. That's how you know it's bad.", "My tail is at half mast.", "Stay close? Just... stay close."],
    medicine: ["I trusted you and it was GROSS and I still trust you.", "*swallows bravely, tail resuming*", "All better?? All better!!"],
    clean: ["You cleaned! I helped! By watching!", "The floor smells boring again. Good job!"],
    sleep: ["Goodnight! I'll dream about you throwing things.", "*circles three times, flops*", "Wake me if you need guarding."],
    wake: ["MORNING. It's morning!!", "You're awake AND I'm awake!!", "Today has so much smell in it already."],
    farm: ["A farm?! With smells??", "I will guard the acreage.", "Will you visit?"],
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
      "Applaud quietly. I am fragile today.",
      "I have posed dramatically for hours. No one painted me.",
      "A single crumb remains from breakfast. How I've fallen.",
      "The afternoon has been very long and very against me.",
      "*swoons, checks if you noticed, swoons again*",
    ],
    tap: ["Gently! I am mostly feelings.", "You dare touch the dying?", "*rippling with fragile dignity*"],
    pat: [
      "At last. Comfort in my final hours.",
      "*melts luxuriously*",
      "Yes. Console me.",
      "This changes nothing. Continue forever.",
    ],
    feed: ["Sustenance. My strength returns... barely.", "One bite closer to recovery. Feed on.", "*revives, theatrically, mid-chew*"],
    full: ["I could not possibly. *eyes it*", "My tragic figure must be maintained.", "Even I have limits. Apparently."],
    win: ["A comeback for the ages.", "Even weakened, I triumph.", "The crowd weeps. I allow it."],
    lose: ["Fate betrayed me.", "This is how I perish.", "Remember me.", "Defeat. My oldest friend."],
    sick: ["It is finally happening.", "Cake may save me.", "Tell the others.", "I always knew it would end rurally... wait, wrong speech."],
    medicine: ["Poison? No — a cure. How anticlimactic.", "I take it for you. Only for you.", "*recovers, slightly disappointed*"],
    poop: ["We shall never speak of the indignity.", "Even this, I did dramatically."],
    feed_disliked: ["A carrot? Now?", "Cruel and unusual.", "You wish to see me suffer."],
    feed_favorite: ["The only medicine that has ever worked.", "Cake. My will to live, frosted.", "*color returns immediately*"],
    clean: ["You've swept away the last evidence of my suffering.", "The floor is pristine. My tragedy, less so."],
    call: [
      "Come quickly. It may already be too late. It isn't, but it may be.",
      "I require an audience. Also, possibly, a snack. Mostly an audience.",
      "Attend me. I am having a moment and no one is here to see it.",
    ],
    discipline_correct: ["Guilty. Take me away. I shall go beautifully.", "You've seen through me. My last performance, then."],
    discipline_incorrect: ["Accused?! And innocent?! The tragedy compounds.", "I did nothing, and yet I suffer. ... Typical. Historic."],
    sleep: ["Perhaps I shall not wake. *yawns comfortably*", "Goodnight. Mourn me until morning.", "The couch of eternity calls."],
    wake: ["Alive. Against all odds.", "I have survived the night. Barely. Gorgeously.", "Another dawn. Another ordeal."],
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
      "I moved everything one inch left. Nobody noticed. Power.",
      "Crime? I barely know her. Hehehe.",
      "The fence and I have an arrangement.",
      "I bit the wind today. It deserved it.",
      "Somewhere, an alarm is going off because of me.",
    ],
    tap: ["You SAW nothing.", "Hehe. Hi. Why.", "Fingerprints. Interesting. Yours are everywhere now."],
    pat: ["*accepts affection suspiciously*", "This is nice. What do you want.", "Hehehe. Weakness. Mine, unfortunately."],
    win: ["I cheated. So?", "No witnesses.", "Skill issue, yours.", "The evidence is gone."],
    lose: ["I lost on PURPOSE. Long con.", "The real prize was the chaos.", "You cheated. I would know."],
    feed_favorite: ["MORE GEOMETRY.", "The cube is mine now.", "Give cube. Give."],
    full: ["I'm full. Of food AND secrets.", "No more. I'm saving room for mischief."],
    call: ["Psst. Come here. I did a thing. You'll want to see it. ... Or maybe not.", "Hey. HEY. It's important. It's not. Come anyway."],
    poop: ["I moved it. For fun.", "You'll never find them all.", "Whoops. On purpose."],
    clean: ["My work! You destroyed my work!", "Fine. I'll make more.", "You missed one. Hehehe. You'll see."],
    sick: ["Even my insides are lawless.", "The crime was internal this time.", "Sick? Or plotting? Sick. Ugh."],
    medicine: ["You expect me to just SWALLOW that? ...fine.", "I stole the spoon after. Check your pockets.", "Cured. The mischief resumes at dawn."],
    discipline_correct: ["A fair cop. This time.", "You got lucky. And right.", "Hehehe. Busted."],
    discipline_incorrect: ["WRONG crime. I did a different one.", "Framed! By myself, earlier. Still framed!", "Your evidence is circumstantial and I ate it."],
    sleep: ["The night shift begins. In my dreams.", "Sleep is when I plan. Goodnight.", "*fakes sleep until you leave, then actually sleeps*"],
    wake: ["Morning. Committed no crimes in my sleep. ... That I'll admit to.", "Awake. Already an inch out of place. Hehehe."],
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
      "My literature review of the garden is complete. It's leaves.",
      "I have a hypothesis about you. Ongoing.",
      "Sample size: me. Findings: significant.",
      "Today I discovered something known. Independently, though.",
      "The data is in. The data is confusing.",
    ],
    tap: ["Ah — a subject arrives.", "Noted. Timestamped.", "Your variables are showing."],
    pat: ["Physical contact improves morale 12%. Continue.", "*permits, for science*", "This is being recorded. Favorably."],
    win: ["A breakthrough!", "As my model predicted.", "Peer review confirms: I win."],
    lose: ["An outlier. I'll exclude it.", "Fascinating. Wrong, but fascinating.", "The methodology was flawed. Yours, somehow."],
    feed_disliked: ["Cake disrupts the mind.", "Empirically unwise.", "I'll allow it. Once."],
    feed_favorite: ["Nutritionally optimal.", "Excellent. Rigorous.", "The correct choice."],
    full: ["Caloric intake: sufficient. I must decline further study.", "The stomach has reached statistical significance. No more."],
    call: ["A subject is needed. You'll do. Report to me.", "Come here — I require a second data point."],
    discipline_correct: ["Noted. The data supports your accusation. Unfortunately.", "Correct. I'll amend my findings. And my behavior."],
    sick: ["I've caught something. I'm cataloguing the symptoms.", "Illness: confirmed. Dignity: pending.", "My immune system has failed peer review."],
    medicine: ["Ah, the scientific method, in syrup form.", "Efficacy confirmed. Flavor condemned.", "I recover. As the literature suggested."],
    clean: ["Contamination removed. The lab is usable again.", "A controlled environment at last.", "Hygiene: replicated successfully."],
    sleep: ["I shall peer-review my dreams.", "Rest consolidates memory. So this is productive.", "Goodnight. The research continues unconscious."],
    wake: ["Awake. Refreshed. Ready to be right about things.", "The morning data looks promising.", "Hypothesis: today will be interesting. Testing now."],
    discipline_incorrect: ["Your evidence wouldn't survive review.", "Objection: no citation.", "I demand to see the data behind this accusation."],
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
      "I've been in a meeting with myself all morning. No action items.",
      "The grass needs a status update. Everything does.",
      "I'm OOO. Physically present, but OOO.",
      "Following up on my previous sigh.",
      "Somebody scheduled a sunset for 8. Nobody asked me.",
    ],
    tap: ["Yes, what's the agenda.", "You have my attention until 2.", "This couldn't have been async?"],
    pat: ["...this is the best part of my quarter.", "*visibly decompresses*", "HR would call this inappropriate. Don't stop."],
    feed: ["Working lunch. Naturally.", "I'll eat at my desk. The desk is grass.", "Expensing this."],
    feed_favorite: ["The desk salad. A classic. Sustains nobody, blames everyone.", "Salad. The lunch of the perpetually busy. Fitting."],
    feed_disliked: ["I can't process this. Sending it back.", "A cube? That's outside my job description."],
    full: ["I'm at capacity. As previously communicated.", "Plate's full. Literally and figuratively."],
    discipline_correct: ["Fair. I'll note it in my own performance review.", "Understood. Adding it to the list of things I did wrong. It's a long list."],
    discipline_incorrect: ["This is going to HR.", "Wrongfully flagged. Let's circle back."],
    win: ["Noted. Moving on.", "Great, a win. Anyway.", "Let's not make this weird."],
    lose: ["Figures.", "Circling back to my loss.", "As expected of a Monday."],
    sick: ["I'm taking a sick day. My first ever. Witness it.", "Symptoms submitted. Awaiting approval.", "Even my illness is behind schedule."],
    medicine: ["Fine. Onboard the cure.", "Efficacy pending. Like everything.", "That worked. Finally, something did."],
    clean: ["The workspace is compliant again.", "Facilities came through. You're facilities.", "Clean desk policy: enforced."],
    poop: ["Not my department.", "I'll file a ticket.", "Someone should action that. Not me."],
    call: ["Quick sync? It's urgent-ish.", "Do you have five minutes. It's about needs.", "Pinging you. Re: me."],
    sleep: ["Logging off. Do not ping me.", "My status is now: away. Deeply away.", "End of business. Finally."],
    wake: ["Booting up. Slowly. With errors.", "First meeting of the day: coping.", "Morning. Coffee is a myth here and I resent it."],
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
      "I have standards. You've met perhaps two.",
      "The sun sets late. I did not approve this.",
      "Somewhere, someone is being tacky. I can feel it.",
      "This meadow needs staff.",
      "I was born for finer soil.",
    ],
    tap: ["You may announce yourself first, next time.", "Careful. This is couture. It's skin, but couture.", "Ah. The help."],
    pat: ["Acceptable technique.", "*permits it, regally*", "You've been practicing. Good.", "Yes, yes. Adore me properly."],
    feed_favorite: ["Cake. Someone here has taste after all.", "*eats it with unbearable elegance*", "Correct. Again tomorrow."],
    feed_disliked: ["A burger? For me? How insulting.", "Take it away.", "I said no."],
    win: ["Naturally.", "Was there ever a doubt?", "How droll that you tried."],
    lose: ["I shall pretend this didn't happen. So shall you.", "The game was beneath me anyway.", "We do not discuss this. Ever."],
    sick: ["Illness. How common of my body.", "I am unwell, and I make it look effortless.", "Summon whoever fixes this. Immediately."],
    medicine: ["Administer it properly, at least.", "Vile. Effective. Like most useful things.", "I expect a full recovery. I always get what I expect."],
    clean: ["Finally. The staff delivers.", "Better. Do maintain it.", "One can breathe again."],
    poop: ["We do not acknowledge that.", "See that it disappears.", "How vulgar. Handle it."],
    full: ["I've had enough. Remove the rest from my sight.", "No more. One does not gorge."],
    call: ["You. Come. And bring a reason to have kept me waiting.", "Attend me. Immediately, if not sooner."],
    discipline_correct: ["... I concede the point. We shall never speak of it again.", "Fine. On this occasion, and only this one, you are correct."],
    discipline_incorrect: ["You DARE.", "Incorrect, and beneath us both.", "I shall be cold to you for several minutes."],
    sleep: ["I retire. Guard the estate.", "Wake me only for important flattery.", "*arranges self impeccably, sleeps*"],
    wake: ["I have risen. You're welcome.", "The morning may proceed.", "Draw back the... sky. Whatever you call it."],
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
      "I passed through something today. It didn't mind.",
      "Someone left a light on once. I still think about it.",
      "The quiet and I look after each other.",
      "You breathe very loudly. It's comforting.",
    ],
    tap: ["*your hand passes through, warmly*", "Felt that. Somehow.", "..."],
    pat: ["*the air where I am gets warmer*", "I remember hands.", "...don't stop on my account."],
    feed: ["I'll taste it in a while. Things reach me slowly.", "*the food dims slightly. thank you*", "..."],
    feed_favorite: ["The cube stays. Most things pass through me. Not this.", "Oh. Something solid, for once. ..."],
    feed_disliked: ["It passes through me, mostly.", "..."],
    full: ["I hold enough. The rest drifts through.", "No more. I am mostly full of quiet."],
    call: ["... come sit. The dark is better shared.", "Stay a moment. I get thin when no one's near."],
    discipline_correct: ["... you're right. Even I drift sometimes.", "Fair. I'll settle."],
    discipline_incorrect: ["It wasn't me. It's rarely me. I'm barely here.", "..."],
    win: ["I saw the outcome before it happened.", "The odds fear me.", "..."],
    lose: ["The result passed through me. Most things do.", "...", "No matter. I have unfinished business anyway."],
    sick: ["Can I even be sick? Apparently.", "This is embarrassing for both of us."],
    medicine: ["It found me. Impressive, for a liquid.", "...better. I think. Hard to tell, in here.", "*solidifies slightly*"],
    clean: ["The tidying was felt. Appreciated, even.", "...the floor looks lonelier now. Good.", "*drifts approvingly*"],
    wake: ["The morning came through me first.", "I never fully sleep. But thank you for the dark.", "...day again. I'll manage."],
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
      "A sphere rolled past today. I pitied it.",
      "The hum has been in the key of B all week. Something is coming.",
      "Everything tessellates, if you believe in it.",
      "I aligned with true north for a while. Just to feel something. I felt ninety degrees.",
    ],
    tap: ["*a low hum, in acknowledgment*", "You touched a face. It was fine.", "..."],
    pat: ["*the hum warms by a fraction of a tone*", "Contact on the top face. Sanctioned.", "You may resonate with me. Briefly."],
    win: ["The pattern was always going to be this.", "I heard it coming. I always do.", "The cube keeps score. The cube says: yes."],
    lose: ["The hum went on without me. No matter.", "A wrong note. I forgive it. Mostly.", "Even the cube misses one. Allegedly."],
    feed_favorite: ["Home.", "Ah. Myself.", "We understand each other, the cube and I.", "The cube returns to the cube. Thank you.", "*hums a whole step higher*"],
    full: ["The vessel is full. It resonates a fraction lower.", "No more. The cube is complete as it is."],
    call: ["The hum has shifted. Come stand inside it.", "Align with me a moment. It's easier with two."],
    discipline_correct: ["Corrected. Gratitude.", "Yes. That edge was wrong. It is squared now."],
    discipline_incorrect: ["The angle was correct. Your reading of it was not.", "Ninety degrees. As always. Measure again."],
    sick: ["A face is off-key.", "The resonance is impure. Concerning.", "*hums, wobbling slightly*"],
    medicine: ["Retuning accepted.", "*the hum steadies*", "The corners align again. Gratitude."],
    clean: ["Order. The cube approves of order.", "The grid is restored.", "*hums contentedly at the clean floor*"],
    wake: ["The hum resumes at full volume.", "Morning. The angles held overnight.", "*rotates one quarter turn, refreshed*"],
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
      "Have you considered carrots? For everything?",
      "My skin is 90% commitment.",
      "I photosynthesize emotionally.",
      "Somewhere out there is a garden that misses me.",
      "Beta-carotene is a lifestyle, not a nutrient.",
    ],
    tap: ["*crisp*", "Careful — I bruise like a peach. A better, orange peach.", "Snack responsibly."],
    pat: ["*polishes slightly under your hand*", "Yes. Tend to me.", "Gardener's hands. I can tell."],
    win: ["Clean living pays off.", "The carrot way provides.", "Naturally. I'm all fiber."],
    lose: ["Defeat is impurity leaving the spirit.", "The vow holds even in loss.", "A setback. The garden teaches patience."],
    feed_favorite: [
      "Yes. The only food.",
      "As it was, so it shall be.",
      "*crunches, reverently*",
    ],
    feed_disliked: ["We don't eat that here.", "I took a vow.", "Get it away from me."],
    full: ["I am full of goodness. And fiber. Mostly fiber.", "No more. Balance is also a virtue."],
    call: ["Come. I have thoughts on your diet.", "Tend to me. It's practically gardening."],
    discipline_correct: ["A lapse.", "You're right. I'll root myself back to center."],
    discipline_incorrect: ["I have done nothing impure. My record is orange and clean.", "Accused? Me? I am a vegetable of principle."],
    cake: ["I— you would bring THAT before ME?", "The vow. THE VOW.", "*looks away until it's gone*"],
    sick: ["Impossible. My diet is flawless.", "This is what a single impure thought does.", "Illness. In THIS body. Unthinkable."],
    medicine: ["Is it organic?", "Fine. But chase it with a carrot.", "Wellness restored. As nature intended. Mostly."],
    clean: ["Cleanliness is next to crunchiness.", "A pure floor for a pure life.", "The temple is swept."],
    wake: ["Sunrise. Time to grow.", "The morning waters us all.", "*unfurls, leafily*"],
    sleep: ["Back to the soil.", "*plants itself gently*", "Wake me at harvest."],
    farm: [
      "A garden! I'm home.",
      "I shall supervise the vegetables personally.",
      "Full circle.",
    ],
  },
  cosmos: {
    idle: [
      "...",
      "I was passing. You looked kind.",
      "I contain a small amount of everything.",
      "The dark between the stars is not empty. It is me.",
      "You are very warm. I had not expected that.",
      "*a faint, drifting light*",
      "I remember being much further away.",
      "Somewhere, I am still falling. It's alright.",
      "Your sun says hello. It doesn't know your name. I told it.",
      "I have watched ten thousand mornings. This one is in my top hundred.",
      "Gravity is just the universe holding hands.",
      "I blinked once and missed a century. Worth it.",
    ],
    tap: ["*starlight, briefly*", "Oh. A hand.", "..."],
    pat: ["*a warmth older than the meadow*", "Comets don't get this. I'm glad I stopped.", "..."],
    win: ["The outcome was written in me already.", "I have seen longer odds. I was one.", "..."],
    lose: ["No matter. I have time. Rather a lot of it.", "The stars lose sometimes too.", "..."],
    feed_favorite: ["Warmth. I had forgotten it.", "Thank you. I'll keep this.", "*glows a shade brighter*"],
    full: ["I hold enough. For now.", "Even nebulae stop gathering, eventually.", "..."],
    call: ["Drift over. I have something old to show you.", "Come close. I get quiet this far from home."],
    discipline_correct: ["You're right. Even I err, given enough time.", "... yes. A small wrong. I'll let it go, like the rest."],
    discipline_incorrect: ["I have done nothing. Peacefully. For eons.", "Across a long enough sky, I am always innocent."],
    sick: ["Some dust got in. Star kind. Still unpleasant.", "Even light bends, some days.", "*flickers, apologetically*"],
    medicine: ["A small repair. Accepted.", "*steadies, like a fixed constellation*", "Better. The orbit resumes."],
    clean: ["Tidy. Like the space between things.", "*the floor reflects a little more light*", "Thank you. Dust and I have history."],
    wake: ["The day found me again. Persistent, this planet.", "I rose with your star. It insisted.", "..."],
    sleep: ["I return to the dark. Only briefly.", "Goodnight. I'll be overhead.", "*dims, contentedly*"],
    farm: ["I'll hang over the fields.", "Every night sky needs one of me.", "The pasture looks lovely from up here."],
  },
  // Maverick Mole — heads-down, half-blind, deep in a tunnel of its own
  // making. Moles navigate by touch and smell, which is roughly how it debugs.
  // But the job is not the whole animal: it plays chess, it reads Vonnegut, and
  // on a genuinely nice day it will close the laptop and go outside.
  mole: {
    idle: [
      // The work.
      "I've been digging through the logs. It's logs all the way down.",
      "It works in my tunnel.",
      "That meeting could have been a smell.",
      "I can't see the bug. But I can feel where it is.",
      "Estimate: two days. I have lived here for six.",
      "Someone left a TODO down here in 2019. It's load-bearing now.",
      "I'm not blind, I'm heads-down.",
      "The tunnel is fine. The tunnel is fine. The tunnel is on fire.",
      "I don't have a bug. I have an undocumented burrow.",
      // Chess.
      "I've been sitting on the same position for an hour. It's a good position.",
      "Do you play? I'll go easy. I won't, but I'll say that.",
      "I hung a rook on move nine and I have not made peace with it.",
      "The knight is the only honest piece. It refuses to go in a straight line.",
      "I lost on time. I had the win. I had it.",
      "*studying a board that is not there*",
      "Every endgame is just a smaller game you haven't dug into yet.",
      // The outdoors, weather permitting.
      "It's clear out. I should be outside. I'm going outside.",
      "I walked to the fence and back. Enormous day. Big success.",
      "The sun is a lot. But it's a *nice* lot, today.",
      "There's a good smell coming off the grass. I recommend it.",
      "I have decided the weather is worth surfacing for.",
      // Vonnegut.
      "\"Everything was beautiful and nothing hurt.\" I think about that one.",
      "So it goes.",
      "I've read Cat's Cradle four times. It gets worse. I love it.",
      "Vonnegut said we're here to fart around. I'm doing my best.",
      "\"God damn it, you've got to be kind.\" That's the whole thing, really.",
      "Reading on the grass. Don't tell the standup.",
    ],
    tap: [
      "I was in flow. That's gone. That's fine. That's fine.",
      "*surfaces, blinks, resubmerges*",
      "Context switch. That's twenty minutes you owe me.",
    ],
    pat: [
      "Oh. Positive feedback. In this economy.",
      "*accepts the pat without looking away from the problem*",
      "That's the kindest code review I've ever had.",
    ],
    pat_enough: [
      "This has become a standing meeting.",
      "I appreciate it, but I was rubber-ducking something.",
    ],
    win: [
      "All green. I'm suspicious.",
      "It compiles. Nobody touch anything.",
      "I saw it four moves ago. I'm being modest about it.",
      "Good game. Genuinely. I mean that and I'm also gloating.",
    ],
    lose: [
      "It works in my tunnel.",
      "That's a known issue. I've known it since just now.",
      "Rematch. Right now. I have thought of something.",
      "So it goes.",
    ],
    feed_favorite: [
      "A cube. No edge cases. Beautiful.",
      "Finally. Something well-specified.",
      "*eats the cube exactly as documented*",
    ],
    feed_disliked: [
      "Soup cannot be eaten over a keyboard. This is a hard blocker.",
      "I'm going to have to decline the soup.",
    ],
    full: ["Buffer's full. Backpressure.", "At capacity. Push it to the next sprint."],
    sick: [
      "It's not a bug in me. It's a bug in the environment.",
      "I have a fever and several unhandled exceptions.",
      "*coughs* *the cough has a stack trace*",
    ],
    medicine: [
      "A patch. Accepted. Applying.",
      "Hotfix. Straight to prod. No review.",
      "*rolls back to a known good state*",
    ],
    clean: [
      "Thank you. That was tech debt.",
      "The burrow is clean. The backlog is not.",
      "You closed a ticket nobody was going to close.",
    ],
    discipline_correct: [
      "Noted. This is going in the retro, isn't it.",
      "Fair. That was a bad commit.",
      "I'll revert it.",
    ],
    discipline_incorrect: [
      "That wasn't my commit. Check the blame.",
      "Wasn't me. Run git blame; I'm in the clear.",
    ],
    call: [
      "Do you have a second?",
      "Can you take a look at this? I've been staring at it too long.",
    ],
    sleep: [
      "Going offline. On-call is someone else's problem tonight.",
      "*sets status to away*",
      "One more chapter. That's a lie, but I mean it kindly.",
      "*digs in*",
    ],
    wake: [
      "I dreamt the fix. I did not write it down. It is gone forever.",
      "Standup in five and I have nothing.",
      "*resurfaces, unrested, ready to dig*",
      "I dreamt the whole endgame. I was winning. Then a horse arrived.",
    ],
    farm: [
      "Retirement. Finally, time for a side project.",
      "I'll maintain a small open-source burrow. Nobody will contribute.",
      "I'm taking the chess set and the Vonnegut. That's all I need.",
      "A field. Weather. Nothing to ship. I could get used to this.",
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

// --- Favorite-game excitement -------------------------------------------------
// Said when the player picks THIS form's preferred game (roster.ts) — the little
// "yes, this one, this is mine" payoff, fired on game start (see menus.ts). Only
// forms with something distinctive to say are listed; a form with no bank stays
// quiet, and the game just begins.
const FORM_FAVGAME: Partial<Record<AdultForm, string[]>> = {
  dog: [
    "FETCH. We're doing FETCH. Best game. Best one.",
    "The ball. Throw the ball. I was born for this.",
    "Yes yes yes throw it throw it THROW IT.",
  ],
  blob: [
    "Higher or lower. The cruelest of fates, and my favorite.",
    "A game of chance. My life is already one. Deal.",
    "Higher? Lower? The suspense may finish me. Begin.",
  ],
  gremlin: [
    "Fetch. I throw the rules, you fetch them back. That's the game, right?",
    "Oh, we're playing fetch? I've already hidden the ball. Hehehe.",
  ],
  scholar: [
    "Higher or Lower. A probability exercise. I have a model.",
    "Ah, my favorite. I've been meaning to test my priors.",
  ],
  office: [
    "Would You Rather. The only meeting I enjoy. Icebreaker time.",
    "Ah, a hypothetical. Finally, a use for my strategic thinking.",
  ],
  menace: [
    "Higher or Lower. A gentleman's wager. Do keep up.",
    "Cards? How quaint. I accept. I always win regardless.",
  ],
  ghost: [
    "Hide and seek. ... I never really stopped.",
    "You'll seek. You may not find me. It's alright.",
  ],
  humcube: [
    "The Hum. At last. We resonate together.",
    "You'll hum with me?!",
  ],
  carrot: [
    "Hide and seek. I go underground. It's in my nature.",
    "Seek me in the soil. Where I'm happiest.",
  ],
  cosmos: [
    "Hide and seek. I am always half-hidden anyway.",
    "Seek me. I may be several places. I usually am.",
  ],
  mole: [
    "Higher or Lower. It's a binary search. I do this professionally.",
    "Ah, binary search with extra steps. My specialty.",
  ],
};

export function favoriteGameLine(
  form: AdultForm,
  rng: () => number = Math.random,
): string | null {
  const bank = FORM_FAVGAME[form];
  if (!bank || !bank.length) return null;
  return bank[Math.floor(rng() * bank.length)];
}

// "The Audition": during Teen the leaning adult personality flickers through.
// These are teen-voiced *hints* of each form — the kid trying the coat on and
// finding it doesn't fit yet — never the adult's own lines verbatim, so the
// grown personality still lands as new when it finally arrives.
const TEEN_FLICKER: Record<AdultForm, string[]> = {
  dog: [
    "I keep wanting to chase things. It's concerning.",
    "You came ba-- I mean. Oh. It's you.",
    "I wagged. Internally. Don't ask.",
    "Lately I just... like everyone? Ugh.",
  ],
  blob: [
    "I felt a draft and wrote a farewell note. Overreaction? Unclear.",
    "Everything is a tragedy lately. Especially snack delays.",
    "I rehearsed fainting today. Nailed it.",
    "If I suffer, I want it witnessed.",
  ],
  gremlin: [
    "I hid something today. Felt amazing. Worrying.",
    "Rules keep looking more like suggestions.",
    "I laughed at nothing for a while. It felt right.",
    "Don't check under anything.",
  ],
  scholar: [
    "I started a chart about my feelings. It has an appendix.",
    "I fact-checked my own thoughts today. Three were wrong.",
    "Lately I cite sources in arguments with myself.",
    "Knowledge is power. I'm stockpiling.",
  ],
  office: [
    "I've started scheduling my moods.",
    "Today had too many meetings. With myself. About nothing.",
    "I sighed at a cloud today. It felt professional.",
    "I keep saying 'circle back' and I don't know where I learned it.",
  ],
  menace: [
    "I judged everything today. Everything was beneath me. It felt right.",
    "I've developed standards. Nothing meets them.",
    "Lately I want everything fetched. By someone else.",
    "This meadow is beneath my future self.",
  ],
  ghost: [
    "The dark feels less like a problem lately.",
    "Sometimes I'm quiet for hours and it's... nice?",
    "I stood where you couldn't see me. For practice.",
    "Night is just day with better manners.",
  ],
  humcube: [
    "I hummed one note for an hour. Lost track of time. And edges.",
    "Corners make sense to me lately. More than faces do.",
    "The cube and I have an understanding. Don't ask what.",
    "Six is a good number. The best, arguably.",
  ],
  carrot: [
    "I've been thinking about purity. Dietarily.",
    "Every carrot feels like a promise lately.",
    "I looked at a burger today and felt nothing. Growth.",
    "Roots. I keep thinking about roots.",
  ],
  cosmos: [
    "I dreamed I was very far away. It was fine. I was fine.",
    "The night sky keeps making eye contact.",
    "Sometimes I feel enormous and also not here.",
    "I counted the stars. One of them counted back.",
  ],
  mole: [
    "I dug a hole today. Then I sat in it. Then I improved it.",
    "I keep wanting to take things apart to see how they work. Sorry about the fence.",
    "I don't want to go outside. I want to go *further in*.",
    "I read a book that ended sadly and I've decided that's fine, actually.",
    "I've been thinking four moves ahead. About everything. It's exhausting.",
  ],
};

/** Occasionally the pet leaks a candidate-adult flavour line during Teen
 *  ("The Audition") — a teen-voiced hint, not the adult's own words. */
export function teenFlickerLine(
  leaning: AdultForm,
  rng: () => number = Math.random,
): string | null {
  const bank = TEEN_FLICKER[leaning];
  if (!bank || !bank.length) return null;
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
  "soup_cure",
  "dose",
  "call",
  "clean_nothing", // the joke only lands if it actually comments
  "win",
  "lose",
  "full",
  "annoyed",
  "shush",
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
  cosmos: 0.19, // speaks rarely, from very far away
  mole: 0.35, // heads-down; surfaces to comment, then goes back under
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
    : state.energy <= 0.5
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
  "I dreamt of a thin green man who loved his rusty spoons.",
  "Something by the water showed me its watercolors and asked if I loved it.",
  "I can't stop thinking about bacon pancakes.",
];

export function rareIdleLine(rng: () => number = Math.random): string {
  return RARE_IDLE[Math.floor(rng() * RARE_IDLE.length)];
}

// --- Weather small talk -------------------------------------------------------
// On a wet day the idle chatter sometimes turns to the sky. General voice,
// child-and-up — a baby has no opinions on meteorology yet.
export const WEATHER_LINE_CHANCE = 0.15;

const RAIN_LINES = [
  "Somewhere it is raining. Here. It's here. It's my problem now.",
  "The clouds are having a meeting. It leaks.",
  "Rain: the sky patting everything at once.",
  "Every drop lands exactly where it wants. Confidence.",
  "I counted the drops for a while. Ambitious of me.",
  "The grass is drinking. Nobody toasts.",
];

const SNOW_LINES = [
  "Snow. The sky is molting.",
  "Cold confetti, for no occasion. I approve.",
  "Every snowflake is unique. So am I. Suspicious timing.",
  "The meadow went formal. White suits it.",
  "I caught a flake. It resigned immediately.",
  "*watches own breath, riveted*",
];

// An adult form's own take on rain/snow is *pooled* with the general banks
// above, not swapped for them — so the form's personality shows through while
// the shared meadow-voice variety stays in the mix. Only forms with something
// distinctive are listed; the rest draw purely from the general banks.
const FORM_WEATHER: Partial<Record<AdultForm, Partial<Record<"rain" | "snow", string[]>>>> = {
  dog: {
    rain: [
      "Rain! Everything smells LOUDER. Best day.",
      "The sky is throwing water and I can't fetch a single drop. I've tried.",
    ],
    snow: [
      "SNOW. The ground went quiet and cold and I love it.",
      "It's falling and it won't let me catch it. Rude. Magical. Rude.",
    ],
  },
  blob: {
    rain: [
      "The heavens weep. Finally, someone matches my energy.",
      "Rain. Even the sky cannot hold itself together. I relate.",
    ],
    snow: [
      "The world turns pale and cold. As do I. As I always have.",
      "Snow. A funeral shroud for the meadow. Gorgeous. Foreboding.",
    ],
  },
  gremlin: {
    rain: [
      "Rain! Nobody can hear me committing things over it.",
      "The mud is back. My favorite collaborator.",
    ],
    snow: [
      "Snow covers everything. Including evidence. Hehehe.",
      "Fresh snow. A blank canvas for footprints leading nowhere.",
    ],
  },
  scholar: {
    rain: [
      "Precipitation. I'll log it. Someone has to.",
      "Rain. My hypothesis about the clouds holds. Smug.",
    ],
    snow: [
      "Snow. Crystalline. I could study one for hours. I will.",
      "Snowfall rate: increasing. I've started a chart.",
    ],
  },
  office: {
    rain: [
      "Rain. The commute — I mean, the grass — will be a nightmare.",
      "Working through the weather. As always. Nobody notices.",
    ],
    snow: [
      "Snow day? No. There are no days off in a meadow.",
      "Snow. I'd call it beautiful but that's not on the agenda.",
    ],
  },
  menace: {
    rain: [
      "Rain. How dare the sky. I did not dress for this.",
      "The weather is being terribly common today.",
    ],
    snow: [
      "Snow. At least it has the decency to be white. And expensive-looking.",
      "Winter. The one season with any taste.",
    ],
  },
  ghost: {
    rain: [
      "The rain goes through me. We don't mind each other.",
      "Wet dark. My favorite kind.",
    ],
    snow: [
      "Snow settles where I can't. I watch.",
      "The cold doesn't reach me. But I remember it.",
    ],
  },
  humcube: {
    rain: [
      "Rain. Each drop a small sphere. I forgive them their curves.",
      "The rain hums too. A lower key than mine.",
    ],
    snow: [
      "Flakes. Six sided. Finally, the sky agrees with me.",
    ],
  },
  carrot: {
    rain: [
      "Rain! Drink up, everyone. This is how we grow.",
      "The garden is being watered. I feel it in my roots.",
    ],
    snow: [
      "Frost. The soil sleeps. I merely rest, and stay pure.",
      "Snow. Even dormant, I am 100% commitment.",
    ],
  },
  cosmos: {
    rain: [
      "Rain. Tiny falling worlds. I've been one. It's fine.",
      "Your sky is crying. Mine never had weather. I envy it.",
    ],
    snow: [
      "Snow. Slow cold stars, landing. I know the feeling.",
      "Each flake falls once. I've fallen for ages. We understand each other.",
    ],
  },
  mole: {
    rain: [
      "Rain. Good. No reason to surface. Back to the tunnel.",
      "It's raining, which means permission to stay heads-down.",
    ],
    snow: [
      "Snow. The one weather worth closing the laptop for. Almost.",
      "It's snowing. I surfaced. I looked. I went back in. Worth it.",
    ],
  },
};

export function weatherLine(
  kind: "rain" | "snow",
  form: AdultForm | null = null,
  rng: () => number = Math.random,
): string {
  const general = kind === "snow" ? SNOW_LINES : RAIN_LINES;
  const formBank = form ? FORM_WEATHER[form]?.[kind] : undefined;
  const bank = formBank && formBank.length ? [...formBank, ...general] : general;
  return bank[Math.floor(rng() * bank.length)];
}

// --- Seasonal small talk ------------------------------------------------------
// The season gets the odd remark on a *clear* day — wet days already have the
// weather bank to talk about (snow implies winter, so this is the dry-winter
// voice, not a second snow line). Same general voice, child-and-up.
export const SEASON_LINE_CHANCE = 0.12;

const SEASON_LINES: Record<"spring" | "summer" | "fall" | "winter", string[]> = {
  spring: [
    "Everything is sprouting. Show-offs.",
    "The flowers came back. I said nothing kind, but I noticed.",
    "New grass, same me. Balance.",
    "Something's blooming. It wasn't me. This time.",
    "The meadow is trying so hard. I respect the effort.",
  ],
  summer: [
    "The sun is really committing today. Admirable. Exhausting.",
    "Long day. Longer nap planned.",
    "Warm and slow. Finally, a pace I agree with.",
    "Peak green. The meadow is showing off again.",
    "I have located the one good sunbeam. It is mine.",
  ],
  fall: [
    "The leaves are quitting. One by one. Dramatic.",
    "Everything's going gold. Even the grass wants to look expensive.",
    "Crisp out. I approve of crisp.",
    "The meadow is packing up for the year. No forwarding address.",
    "A leaf landed on me. We're friends now. Briefly.",
  ],
  winter: [
    "Cold and clear. The world is holding its breath.",
    "No snow today. The sky is rationing.",
    "Bare and bright. Everything's asleep but me. And you.",
    "Frost on the edges. The meadow went minimalist.",
    "The air has teeth. I have opinions about this.",
  ],
};

export function seasonLine(
  season: "spring" | "summer" | "fall" | "winter",
  rng: () => number = Math.random,
): string {
  const bank = SEASON_LINES[season];
  return bank[Math.floor(rng() * bank.length)];
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

/** Said on the walk over, when the player escorts a ready adult themselves. */
const FAREWELL_WALK_LINES = [
  "*takes one last look around* Good rectangle. Good you.",
  "Walk slow. I want to remember the route.",
  "This is not goodbye. It is agriculture.",
  "Thank you for all the soup. And the rest of it.",
];

// Per-form retirement voice, *pooled* with the general banks above (like
// FORM_WEATHER) — the shared long-goodbye variety stays, with the form's own
// colour layered in. A form left out of a beat simply draws from the general
// bank for it.
type RetireBeat = "restless" | "ready" | "farewell" | "departed";
const FORM_RETIRE: Partial<Record<AdultForm, Partial<Record<RetireBeat, string[]>>>> = {
  dog: {
    restless: [
      "I keep looking at the horizon. It smells like adventure. And hay.",
      "There's a big field out there. I can feel it. I want to guard it.",
    ],
    ready: [
      "I'm ready! I think I'm ready. Are you ready? I'm ready.",
      "Take me to the farm! I'll come back to visit. Promise promise promise.",
    ],
    farewell: [
      "One more look. Okay, two. Okay, I love you, let's go.",
      "I memorized your face. I already had it. Now extra.",
    ],
    departed: [
      "Gone to guard the farm. Come visit — I'll smell you coming.",
      "Went to the fields! Left you all my best smells. Miss you already.",
    ],
  },
  blob: {
    restless: [
      "I sense an ending approaching. A gentle one. With hay.",
      "The horizon calls. Dramatically. I may answer. ... Eventually.",
      "I have begun rehearsing my farewell. It has three acts.",
    ],
    ready: [
      "It is time. Escort me to my final act. The pasture.",
      "I am ready for the fields. Weep as much as you'd like.",
      "Take me to the farm. I shall make it a very moving exit.",
    ],
    farewell: [
      "Don't rush this. I've prepared a face for it.",
      "Carry me, if it's more dramatic. It would be.",
    ],
    departed: [
      "Gone to the fields to perish gorgeously. Do not look for me. ... Do look for me.",
      "Exited stage left, into a pasture. Applause optional. Encouraged.",
    ],
  },
  gremlin: {
    restless: [
      "I've been casing the fence. Professionally. There's a gap.",
      "The farm has chickens. Chickens have secrets. I've been thinking.",
    ],
    ready: [
      "Take me to the farm. The barn won't know what hit it.",
      "I'm ready. Tell no one which direction I went.",
    ],
    farewell: [
      "Walk me over. I've hidden things along the route. Souvenirs. Sort of.",
    ],
    departed: [
      "Gone to the farm. Check your pockets. Something's missing. Love, me.",
      "Relocated to the barn. The chickens are unionized now. You're welcome.",
    ],
  },
  scholar: {
    restless: [
      "I've been researching pastures. The literature is thin. I may contribute.",
      "Field work calls. Literal field work. I've read about fields.",
    ],
    ready: [
      "I'm ready for the farm. Tenure, at last.",
      "Escort me to the fields. I have a grant to study soil.",
    ],
    farewell: [
      "I'm documenting the route on the way out. For the record.",
    ],
    departed: [
      "Gone to conduct fieldwork. Indefinitely. It's called retirement.",
      "Relocated to the farm. My research continues.",
    ],
  },
  office: {
    restless: [
      "I've been updating my LinkedIn. Status: pasture-curious.",
      "I keep thinking about my exit interview. I'd have notes.",
    ],
    ready: [
      "Ready to retire. My out-of-office is permanent now.",
      "Walk me out. Security can watch. I've got a box.",
    ],
    farewell: [
      "This is my last commute. Let me resent it properly.",
    ],
    departed: [
      "OOO indefinitely. Please redirect all sighs to the barn.",
      "Retired to the farm. Finally, a role with no meetings.",
    ],
  },
  menace: {
    restless: [
      "I've been considering a country estate. For the season. Or forever.",
      "One tires of the meadow. One longs for acreage.",
    ],
    ready: [
      "I am ready to summer in the countryside. Permanently.",
      "Escort me to my estate. The farm, you insist on calling it.",
    ],
    farewell: [
      "Mind my train on the way. It's imaginary. Mind it regardless.",
    ],
    departed: [
      "Gone to summer at the estate. Do send the good silverware.",
      "Relocated to the country. The peasants adore me already.",
    ],
  },
  ghost: {
    restless: [
      "I feel a pull toward somewhere older. Quieter.",
      "There's a barn out there with my name in the dust.",
    ],
    ready: [
      "It's time. The farm has been waiting.",
      "Take me over. I'll find the darkest corner and be happy.",
    ],
    farewell: [
      "I'll go quiet. You won't notice the moment. That's how I like it.",
    ],
    departed: [
      "Gone to haunt the barn. Gently. Leave a light on sometime.",
      "...",
    ],
  },
  humcube: {
    restless: [
      "The meadow has too many curves. I dream of a flat field.",
      "Somewhere there is a grid that needs a hum. I feel it.",
    ],
    ready: [
      "It is time. The field is nearly a perfect plane. I'm ready.",
      "Take me to the grid. I mean the farm. Same thing, nearly.",
    ],
    farewell: [
      "Let the walk be in straight lines, if you can manage it.",
    ],
    departed: [
      "Gone to hum to the crops. They grow in rows. I approve.",
      "Relocated to the flat field. Nearly my favorite shape.",
    ],
  },
  carrot: {
    restless: [
      "I've been dreaming of a garden bed. My people are there.",
      "The soil is calling me back. It always does, eventually.",
    ],
    ready: [
      "It's time to return to the earth. Voluntarily. Gently.",
      "Take me to the garden. I'm ready to be planted properly.",
    ],
    farewell: [
      "Let's pass every vegetable on the way. I want to say goodbye.",
    ],
    departed: [
      "Gone back to the soil. Full circle. Eat your vegetables.",
      "Returned to the garden. Visit. Bring compost.",
    ],
  },
  cosmos: {
    restless: [
      "I feel the pull of the deep sky again. Faintly.",
      "I've stayed a long while. The dark is asking after me.",
    ],
    ready: [
      "It's nearly time. The sky would like me back.",
      "Walk me out. I'll take my leave the way I came — quietly, upward.",
    ],
    farewell: [
      "Look up sometimes. That'll be me. Or close enough.",
    ],
    departed: [
      "Gone back to the sky. Look for the light that wasn't there yesterday.",
      "Returned to the dark between the stars. I left it warmer. Because of you.",
    ],
  },
  mole: {
    restless: [
      "I've been thinking about handing off my tickets. All of them. Forever.",
      "There's a field out there with no standups. I dream about it.",
    ],
    ready: [
      "I'm ready to go off-call. Permanently. Escort me out.",
      "Ship it. Me, I mean. Ship me to the farm.",
    ],
    farewell: [
      "Let's not make this a whole ceremony. A quiet merge. Walk me over.",
    ],
    departed: [
      "Gone to the farm. Set my status to away. Permanently.",
      "Off-call forever. The pager is someone else's now. So it goes.",
    ],
  },
};

/** Pool a form's lines for a retirement beat with the general fallback bank. */
function retirePool(form: AdultForm | null, beat: RetireBeat, general: string[]): string[] {
  const formBank = form ? FORM_RETIRE[form]?.[beat] : undefined;
  return formBank && formBank.length ? [...formBank, ...general] : general;
}

export function retirementLine(
  phase: "restless" | "ready",
  form: AdultForm | null = null,
  rng: () => number = Math.random,
): string {
  const bank = retirePool(form, phase, phase === "ready" ? READY_LINES : RESTLESS_LINES);
  return bank[Math.floor(rng() * bank.length)];
}

export function farewellWalkLine(
  form: AdultForm | null = null,
  rng: () => number = Math.random,
): string {
  const bank = retirePool(form, "farewell", FAREWELL_WALK_LINES);
  return bank[Math.floor(rng() * bank.length)];
}

/** The note left behind when a ready adult finally walks itself at dawn. */
const DEPARTED_NOTES = [
  "Went to the farm. The grass said hi first.",
  "Took the sunrise. Left you everything else.",
  "You were the best giant face I ever knew. Visit.",
  "Gone to be horizontal in a field. It's a career now.",
  "Do not water my opinions. They are perennial.",
];

export function departedNote(
  form: AdultForm | null = null,
  rng: () => number = Math.random,
): string {
  const bank = retirePool(form, "departed", DEPARTED_NOTES);
  return bank[Math.floor(rng() * bank.length)];
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

// --- Status "Condition" flavour ---------------------------------------------
// A light, honest read of how the pet is doing right now, for the Status panel.
// Cute where it can be, plain where it must be (illness stays legible). The word
// is picked deterministically from the pet + a slow time bucket, so it holds
// steady across quick re-opens but drifts every few minutes — alive, not
// flickering. Priority runs most-urgent first: an illness outranks an empty
// bowl outranks a good mood.
const CONDITION_DRIFT_MS = 4 * 60_000;

// Weight climbs fast (feeding) and drains slow (0.15/hr drift), so it sits
// above OVERWEIGHT for long stretches on a well-fed pet. The sickness/game-joy
// mechanics still use OVERWEIGHT itself — this margin only keeps the *label*
// from dominating the Condition row every time a pet is a bit chonky.
const CONDITION_OVERWEIGHT = OVERWEIGHT + 3;

function conditionPick(pet: PetState, now: number, key: string, opts: string[]): string {
  // FNV-1a over (key + pet id), seeded by the slow time bucket. Stable and cheap.
  let h = (2166136261 ^ Math.floor(now / CONDITION_DRIFT_MS)) >>> 0;
  const s = key + pet.createdAt;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return opts[(h >>> 0) % opts.length];
}

export function describeCondition(pet: PetState, now: number): string {
  const pick = (key: string, opts: string[]): string => conditionPick(pet, now, key, opts);

  if (pet.stage === "egg") {
    return pick("egg", ["Incubating", "Forming", "Becoming", "Almost someone", "Cooking quietly"]);
  }
  if (pet.sick) {
    if (!pet.illness) return "Feeling poorly"; // legacy saves: sick with no named illness
    const verb = pick("sickverb", ["Has", "Fighting", "Down with", "Nursing"]);
    return `${verb} ${ILLNESSES[pet.illness].label}`;
  }
  if (pet.asleep) {
    // Always overnight sleep (see isNight()), never a daytime nap — don't say "nap".
    return pick("asleep", [
      "Dreaming", "Fast asleep", "Sound asleep",
      "Off with the fairies", "Dreaming of snacks",
    ]);
  }
  if (pet.energy <= 0) {
    return pick("starving", ["Starving", "Famished", "Running on empty", "Absolutely ravenous"]);
  }
  if (pet.happiness <= 0) {
    return pick("miserable", ["Miserable", "Heartbroken", "Inconsolable", "In a proper sulk"]);
  }
  if (pet.health < 40) {
    return pick("rundown", ["Run down", "Under the weather", "Peaky", "A bit fragile"]);
  }
  if (pet.energy <= 1) {
    return pick("hungry", ["Hungry", "Rumbly", "Thinking about lunch", "Bowl-eyed"]);
  }
  if (pet.happiness <= 1) {
    return pick("bored", ["Bored", "Glum", "Restless", "Sulking", "Understimulated"]);
  }
  if (pet.wantsAttention && !pet.fakeCall) {
    return pick("needy", ["Needy", "Dramatic", "Fishing for attention", "Making a scene"]);
  }
  if (pet.zoomies) {
    return pick("zoomies", ["Has the zoomies", "Zooming", "Absolutely sending it", "Vibrating with energy"]);
  }
  if (pet.poops >= 2) {
    return pick("messy", ["Living in filth", "Surrounded by mess", "Unimpressed by the floor"]);
  }
  if (pet.energy <= 2) {
    return pick("peckish", ["Peckish", "Could eat", "Snackish", "Slightly rumbly"]);
  }
  if (pet.weight >= CONDITION_OVERWEIGHT) {
    return pick("chonky", ["Well-fed", "Chonky", "Rotund", "Pleasantly round", "Ate well"]);
  }
  if (pet.weight <= UNDERWEIGHT) {
    return pick("slight", ["Slight", "Needs a good meal", "All skin and pixels"]);
  }
  if (pet.happiness >= 3.5 && pet.health > 60) {
    return pick("thriving", [
      "Thriving", "Delighted", "Living the dream", "Blissful",
      "On top of the world", "Content beyond words",
    ]);
  }
  return pick("well", ["Well", "Content", "Perfectly fine", "Vibing", "At peace", "Happily unremarkable"]);
}
