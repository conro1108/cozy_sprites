# Cozy Sprites — State of the Union

A pocket pet. Hatch it, raise it, watch who it becomes. This is a plain-language
tour of how the game actually works today — not a design wishlist (see
`AREAS.md` for that), just what's live.

## The arc

**Egg → Baby → Child → Teen → Adult.** One straight line, no branching stage
tree — the *branching* all happens in which of nine adult personalities you
land on. Each stage has its own rhythm:

- **Egg** — inert. Nothing drains, nothing can go wrong. It just waits to hatch.
- **Baby** — hectic on purpose. Needs fall fast, it hatches already hungry, and
  it can't yet be disciplined — you're just learning the controls together.
- **Child / Teen** — the long middle. Needs drain at a calmer pace. Teens start
  testing boundaries: more attention calls, and a good chunk of them are fake.
- **Adult** — the destination. Growth stops; personality is locked in and the
  game becomes about maintaining, not raising.

A pet only ages while it's awake — sleep (see below) effectively pauses the
clock, so neglecting bedtime is the fast way through childhood, not the slow one.

## The four visible meters

| Meter | What moves it | What happens at empty |
|---|---|---|
| **Hunger** | Food fills it, time drains it | Health bleeds down |
| **Happiness** | Play, pats, favorite foods fill it; time drains it | Same — health bleeds down |
| **Health** | Rises on good sustained care, falls from hunger, sickness, mess, and bad discipline calls | Pet is in mortal danger (see Death) |
| **Discipline** | Rises when you correctly call out a fake demand, falls when you get it wrong | No direct penalty — it's a track record, and it quietly steers who the pet grows into |

Hunger and happiness are the day-to-day dial you're turning. Health is the
lagging scorecard for how well you've been turning it — it only really moves
when things have been good *or* bad for a while, not from a single meal.

## Mess and sickness

Food isn't magic — it has fiber, and fiber becomes a poop on a short digestive
delay. Leave poop on the floor and it drags on health and raises the odds of
falling sick. Sickness itself is random but weighted: bad health, an unclean
floor, and a heavy cake habit all load the dice. Medicine cures it — most
ailments in one dose, the plague takes two. Giving medicine when nothing's
wrong is a small ding against you (don't cry wolf with the medicine cabinet).

## Day, night, and sleep

There's a day/night cycle. At night, turning the lights off lets the pet
sleep — sleeping pets can't be fed, played with, or patted, but they also stop
aging and their needs drain much more slowly. Leaving the lights on at night
costs happiness (it can't sleep with them on). Morning relights the lantern on
its own — nobody has to remember to do it.

Caring for the pet specifically at night, in the dark, is its own quiet thread
— more on that below.

## Attention calls, and the honesty game

Periodically the pet calls for something: a pat, a snack, or play. Some calls
are **genuine** — it actually needs that thing. From the teen stage onward,
some are **fake** — testing you. The whole discipline system is about telling
the two apart:

- Meet a **genuine** call → happiness reward, discipline untouched.
- Meet a **fake** call → the pet is delighted, but you've spoiled it: a mark
  against you.
- **Discipline** a fake call correctly → discipline goes up.
- **Discipline** a genuine call by mistake → discipline, happiness, and health
  all take a hit. Don't scold real hunger.

Separately, poking the pet (as opposed to answering a real call) is a light
running gag: the first poke gets a reaction, a poking streak gets progressively
ignored, and pushing a streak too far annoys it. A **pat** is the gentle,
always-welcome counterpart — it never backfires, it just eventually stops
paying out if you overdo it.

## Feeding, playing, and favorites

Five foods (burger, cake, carrot, noodles, the mysterious cube), six mini-games
(Higher/Lower, Fetch, Rock-Paper-Scissors, Hide & Seek, Would You Rather, and
the secret-feeling Cube's Hum). Every adult form has a favorite food (a bonus
when fed) and usually a disliked one (a small penalty) — before adulthood,
nobody has any opinions yet.

## Death

The one hard failure state, and it's slow and telegraphed: health has to sit
at rock bottom for a *sustained* stretch before the pet actually dies. A bad
week doesn't kill it; abandoning it does. Eggs can't die at all. Death ends in
a memorial and a fresh egg — the finished pet joins the Farm archive.

## Becoming someone: the nine adult forms

You are never shown a formula. The personality that emerges is a quiet read of
*how* you raised it — what it ate, what it played, how honest you were with
discipline, whether you ever cared for it in the dark. Six forms are visible
from the start; three are secrets nobody tells you about until you earn one.

| Form | Emerges from |
|---|---|
| **Loyal Dog Thing** | A fetch enthusiast, consistently well cared for |
| **Dramatic Blob** | A cake habit, plus a bit of drama and mild neglect |
| **Gremlin** | Chaos: care mistakes, low discipline, a taste for the cube |
| **Little Scholar** | High discipline, a Higher/Lower streak, and going easy on cake |
| **Tired Office Creature** | The default — nothing about the upbringing strongly committed to anything |
| **Fancy Little Menace** | High discipline, refined (cake-leaning) taste, very few mistakes |
| **Quiet Ghost** *(secret)* | Raised mostly at night — care consistently given with the lights off |
| **The Humming Cube** *(secret)* | A real cube diet paired with a devotion to the Cube's Hum game — calm, not chaotic |
| **The Blessed Carrot** *(secret)* | Total dietary purity: carrots, every single meal, no exceptions |

If the upbringing genuinely didn't lean anywhere — a real toss-up between two
paths — the game breaks the tie randomly rather than always picking the same
winner, so an ambiguous raising doesn't always resolve the same way twice.

Once the form is set, it colors everything downstream: favorite/disliked food,
preferred game, how much it enjoys being patted, and its entire dialogue voice.
