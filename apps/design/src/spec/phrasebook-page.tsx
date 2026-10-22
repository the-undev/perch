// The phrasebook: every situation the speech knows, each rendered by running the real speak()
// over a subject built from the mock, so the page always says what the code says. A situation
// the mock does not hold is the nearest mock bird's subject with one fact changed, named as such.

import { mockConfig, mockSnapshot } from "@perch/core/mock.ts";
import { type SpeechSubject, speak, wakingPrefix } from "@perch/core/speech.ts";
import {
  type Bird,
  type HealthCause,
  type Mood,
  speechSubjectFor,
} from "@perch/core/viewmodel.ts";
import { SpeakingBird } from "../speaking-bird.tsx";
import { mockBird } from "../specimens.ts";
import { Code, Plate, Section, Specimen } from "../usage.tsx";

const scannedAt = new Date(mockSnapshot.scannedAt);

/** The speech subject the view model built a mock bird's speech from. */
function subjectOf(id: string): SpeechSubject {
  const item = mockSnapshot.items.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`the mock has no item ${id}`);
  return speechSubjectFor(item, mockConfig, scannedAt);
}

/** A cause of a mock bird's, its level changed. */
function causeAt(
  subject: SpeechSubject,
  level: HealthCause["level"],
): HealthCause {
  const cause = subject.causes[0];
  if (cause === undefined) throw new Error("the subject has no cause");
  return { ...cause, level };
}

interface Entry {
  name: string;
  when: string;
  /** The mock bird who speaks it. */
  id: string;
  subject: SpeechSubject;
  /** What was changed from the mock bird's own subject, when anything was. */
  changed: string | null;
  /** The mood the speaker wears, when the change moves it. */
  mood: Mood | null;
}

/** A situation a mock bird is in, spoken from its own subject. */
function entry(name: string, when: string, id: string): Entry {
  return { name, when, id, subject: subjectOf(id), changed: null, mood: null };
}

/** A situation no mock bird is in: the nearest one's subject with one fact changed. */
function variant(
  name: string,
  when: string,
  id: string,
  change: { subject: SpeechSubject; changed: string; mood: Mood | null },
): Entry {
  return { name, when, id, ...change };
}

const glyphDocs = subjectOf("undev/glyph-docs");
const spool = subjectOf("undev/spool");
const dotfiles = subjectOf(".dotfiles");
const skiff = subjectOf("undev/skiff");
const prism = subjectOf("undev/prism");

interface Group {
  title: string;
  word: string;
  rule: string;
  entries: Entry[];
}

const book: Group[] = [
  {
    title: "Content",
    word: "content",
    rule: "Green birds are brief. Contentment never needs more than two sentences, and the backlog is an invitation, not a nag.",
    entries: [
      entry(
        "Settled",
        "No unsafe work, no stalled flight, nothing red. The default state.",
        "undev/spool",
      ),
      entry(
        "Being edited",
        "Activity is editing. The song plays; the speech acknowledges you.",
        "dev/perch",
      ),
      entry(
        "Settled with a backlog",
        "Green with open roadmap items. The items are an offer.",
        "obsidian/Pocket",
      ),
      entry(
        "Out on a branch",
        "In flight on a non-default branch, all of it younger than the amber window.",
        "undev/glyph-docs",
      ),
      variant(
        "Commits waiting to go up",
        "In flight on the default branch with fresh unpushed commits.",
        "undev/glyph-docs",
        {
          subject: { ...glyphDocs, branch: glyphDocs.defaultBranch },
          changed: "on its default branch",
          mood: null,
        },
      ),
      variant(
        "Settled, nothing known",
        "Settled with no commit to measure from.",
        "undev/spool",
        {
          subject: { ...spool, lastTouchedHours: null },
          changed: "no last commit",
          mood: null,
        },
      ),
    ],
  },
  {
    title: "Restless",
    word: "restless",
    rule: "Amber birds nudge. They name the quantity and the time and stop there; the closing remark may be dry, never wounded.",
    entries: [
      entry(
        "Uncommitted work ageing",
        "Oldest uncommitted change past 24 hours (default), under 72.",
        "obsidian/Hothouse",
      ),
      entry(
        "Unpushed backlog",
        "Oldest unpushed commit past 24 hours, under 72.",
        ".dotfiles",
      ),
      entry(
        "Stalled flight",
        "HEAD on a non-default branch, no movement for 7 days (default).",
        "undev/skiff",
      ),
      variant(
        "Stalled with work unsafe",
        "Stalled flight while something is uncommitted or unpushed.",
        "undev/skiff",
        {
          subject: {
            ...skiff,
            causes: skiff.causes.map((cause) =>
              cause.kind === "stalled"
                ? { ...cause, everythingPushed: false }
                : cause,
            ),
          },
          changed: "not everything pushed",
          mood: null,
        },
      ),
      entry(
        "An expectation, waiting",
        "A config expectation unmet for 7 days (default).",
        "undev/harbour",
      ),
    ],
  },
  {
    title: "Distressed",
    word: "distressed",
    rule: "Red birds are blunt and lead with the worst thing. One secondary fact at most; the rest waits in the chips.",
    entries: [
      variant(
        "CI failing",
        "Latest CI on the default branch failed.",
        "undev/prism",
        {
          subject: { ...prism, causes: prism.causes.slice(0, 1) },
          changed: "its other causes removed",
          mood: null,
        },
      ),
      entry("Open bugs", "Bugs open on the roadmap.", "undev/Hollow-legacy"),
      entry(
        "Unsafe work gone stale",
        "Oldest uncommitted change past 72 hours (default).",
        "undev/gramophone",
      ),
      variant(
        "Unpushed work gone stale",
        "Oldest unpushed commit past 72 hours (default).",
        ".dotfiles",
        {
          subject: { ...dotfiles, causes: [causeAt(dotfiles, "red")] },
          changed: "the backlog past the red window",
          mood: "distressed",
        },
      ),
      entry(
        "An expectation, soured",
        "A config expectation unmet for 30 days (default).",
        "undev/oxbow",
      ),
      entry(
        "Several things at once",
        "Worst input speaks first, one secondary follows, chips hold the rest.",
        "undev/prism",
      ),
    ],
  },
  {
    title: "On the fence",
    word: "not adopted",
    rule: "Fence birds state their situation without pleading, and carry no chips. The decision is the owner's; the bird just says where it stands.",
    entries: [
      entry(
        "Forge only",
        "A repository on a forge with no local clone.",
        "github:finch/obsidian-tidy",
      ),
      entry(
        "Found, undecided",
        "A local repository config has not adopted or ignored.",
        "dev/hearth-config",
      ),
      entry(
        "One disk only",
        "A local repository with no remote at all.",
        "dev/odin/hello",
      ),
    ],
  },
];

/** The speaker as the entry has it: the mock bird, saying what speak() said for the subject. */
function speaker(entry: Entry): Bird {
  const bird = mockBird(entry.id);
  const speech = speak(entry.subject);
  const mood = entry.mood ?? bird.mood;
  return {
    ...bird,
    mood,
    bubble: {
      ...bird.bubble,
      stateWord: bird.adopted ? mood : bird.bubble.stateWord,
      speech,
      wokenSpeech:
        bird.bubble.wokenSpeech === null ? null : `${wakingPrefix} ${speech}`,
    },
  };
}

/** The causes the speech was chosen from, worst first. */
function causeWords(subject: SpeechSubject): string {
  if (subject.fence !== null) return `fence: ${subject.fence.kind}`;
  if (subject.causes.length === 0)
    return `no causes; activity ${subject.activity ?? "none"}`;
  return subject.causes
    .map((cause) => `${cause.kind} ${cause.level}`)
    .join(", ");
}

function Rules() {
  return (
    <div className="mt-6 max-w-[900px] rounded-xl border border-edge bg-panel px-5.5 py-4.5">
      <h2 className="m-0 mb-2 font-bold font-display text-[17px]">The voice</h2>
      <ul className="m-0 list-disc space-y-1 pl-5 text-[13.5px] text-ink-muted leading-relaxed">
        <li>First person, present tense, three sentences at most.</li>
        <li>
          The worst input speaks first; at most one secondary follows;
          everything else stays in the chips.
        </li>
        <li>
          Numbers name quantity and time plainly, as durations measured at the
          scan; judgement lives in tone, never in adjectives about the owner.
        </li>
        <li>
          Tone follows mood: content birds are brief, restless birds nudge,
          distressed birds are blunt but never hysterical.
        </li>
        <li>
          No suggestions, with one exception: a bird may echo the owner&apos;s
          own config expectations back.
        </li>
        <li>
          At night a sleeping bird, clicked, is woken and says so first; awake
          birds never gain the prefix.
        </li>
        <li>Calm punctuation: no exclamation marks, ever.</li>
      </ul>
    </div>
  );
}

/** The phrasebook's bubbles are specimens: their buttons do nothing here. */
function ignore() {}

export function PhrasebookPage() {
  return (
    <>
      <Rules />
      <p className="mt-4 mb-0 max-w-[90ch] text-[13px] text-ink-faint">
        Each bubble holds what <Code>speak(subject)</Code> in{" "}
        <Code>packages/core/src/speech.ts</Code> returns for the subject{" "}
        <Code>speechSubjectFor(item, config, scannedAt)</Code> builds from the
        mock snapshot. Where the mock holds no bird in a situation, the nearest
        bird&apos;s subject has one fact changed, and the entry says which.
      </p>
      {book.map((group) => (
        <Section
          key={group.title}
          title={`${group.title} · ${group.word}`}
          rule={group.rule}
          min={440}
        >
          {group.entries.map((item) => (
            <Specimen
              key={item.name}
              label={item.name}
              rule={
                <>
                  {item.when}{" "}
                  <span className="font-mono text-[11.5px] text-ink-faint/80">
                    {causeWords(item.subject)}
                  </span>
                  {item.changed !== null && (
                    <span className="text-amber">
                      {" "}
                      {mockBird(item.id).name}, {item.changed}.
                    </span>
                  )}
                </>
              }
            >
              <Plate phase="dusk">
                <SpeakingBird
                  bird={speaker(item)}
                  night={false}
                  onPress={ignore}
                />
              </Plate>
            </Specimen>
          ))}
        </Section>
      ))}
      <Section
        title="At night · any mood"
        rule="Sleep is earned. At night a content bird that is not being edited sleeps, and so does the fence; restless and distressed birds lie awake, and an edited bird sings whatever the hour."
        min={440}
      >
        <Specimen
          label="Woken"
          rule={`A sleeping bird clicked at night: the prefix "${wakingPrefix}" joins its usual speech.`}
        >
          <Plate phase="night">
            <SpeakingBird
              bird={mockBird("undev/spool")}
              night={true}
              onPress={ignore}
            />
          </Plate>
        </Specimen>
        <Specimen
          label="Awake anyway"
          rule="Restless, so it never slept and is not woken."
        >
          <Plate phase="night">
            <SpeakingBird
              bird={mockBird("undev/skiff")}
              night={true}
              onPress={ignore}
            />
          </Plate>
        </Specimen>
      </Section>
      <Section
        title="Candidates"
        rule="Lines the board proposed that wait on a fact the scan does not yet gather. They are not spoken; each has its roadmap item."
        min={440}
      >
        <Specimen
          label="Just pushed"
          rule="Everything made safe within the last hour. Waits on the time work was last pushed: roadmap, Just pushed."
        >
          <p className="m-0 text-[13.5px] text-ink-muted italic">
            &ldquo;Everything&apos;s just gone up. Feeling light.&rdquo;
          </p>
        </Specimen>
      </Section>
    </>
  );
}
