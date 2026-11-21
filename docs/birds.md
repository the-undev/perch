# Birds

How a bird looks, in the words of [GLOSSARY.md](../GLOSSARY.md).

## Look

The look is worked out at render from the bird and the current local time.
It is decided in this order: not adopted, snoozed and not past its end date,
then mood, editing and the hour.
Birds sleep from midnight to 06:00, whatever the sky shows.

| Bird | Hour | Colour | State word | Eyes | Mark | Motion |
| --- | --- | --- | --- | --- | --- | --- |
| On the fence | 06:00 to midnight | dimmed | not adopted | open | none | gentle bob |
| On the fence | midnight to 06:00 | dimmed | not adopted | closed | z | still |
| Snoozed | any | dimmed | snoozed | closed | z | still |
| Content, not edited | 06:00 to midnight | green | content | open | none | gentle bob |
| Content, not edited | midnight to 06:00 | green | content | closed | z | still |
| Content, edited | any | green | content | open | note | gentle bob |
| Restless, not edited | 06:00 to midnight | amber | restless | open | none | higher, quicker bob |
| Restless, not edited | midnight to 06:00 | amber | restless | closed | z | still |
| Restless, edited | any | amber | restless | open | note | higher, quicker bob |
| Distressed, not edited | any | red | distressed | open | none | highest bob, tail flicks |
| Distressed, edited | any | red | distressed | open | note | highest bob, tail flicks |

- In flight and settled change nothing on the bird, only its speech.
- The z sits where the note sits, in the bird's own colour. A bird never shows
  both.
- A click on a bird with closed eyes opens its bubble with "Mm? You woke me."
  before its speech. A click never ends a snooze.
- A snoozed bird keeps its plumpness, its wire and its chips' true levels. Its
  bubble says when the snooze ends: "until Friday" within six days, "until 4
  December" beyond, or "until you wake it".
- A snooze ends at the start of its end date, and the bird wears its mood at
  once, with no scan.

## Snooze

An adopted bird's bubble and page offer a Snooze key, whatever its mood. It
opens the durations: 1 day, 3 days, 1 week, 2 weeks, 1 month and indefinitely.
A snoozed bird offers a Wake key in its place, and a bird whose snooze has run
out offers Snooze again. A fence bird has neither.

## Fly-in

Birds land wires before fence, worst mood first, then plumpest. A snoozed bird
lands after every bird on a wire that is not snoozed, and before the fence. A
tab in the camera opens the bird that would land first.
