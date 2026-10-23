import { BirdPortrait } from "@perch/ui/bird.tsx";
import { atRank, mockBird, withOutstanding } from "../specimens.ts";
import { Code, Plate, Section, Specimen, Usage } from "../usage.tsx";

const spool = mockBird("undev/spool");
const skiff = mockBird("undev/skiff");
const prism = mockBird("undev/prism");
const perch = mockBird("dev/perch");
const hothouse = mockBird("obsidian/Hothouse");
const plainSpool = withOutstanding(spool, 0);

export function BirdPage() {
  return (
    <>
      <Section
        title="Breast colour · health, worn as mood"
        rule="Green content, amber restless, red distressed. From CI failures, open bugs, unsafe work (24h amber, 72h red), and stalled flight (7d amber, 30d red). Worst input wins; per-bird thresholds in config."
        min={260}
      >
        <Specimen
          label="content"
          rule="Spool: nothing amber or red. All settled."
        >
          <Plate phase="day">
            <BirdPortrait bird={spool} facing="right" night={false} />
          </Plate>
        </Specimen>
        <Specimen
          label="restless"
          rule="Skiff: parked on a branch for three weeks, stalled flight past 7 days."
        >
          <Plate phase="day">
            <BirdPortrait bird={skiff} facing="right" night={false} />
          </Plate>
        </Specimen>
        <Specimen
          label="distressed"
          rule="Prism: CI failing on main. Red is rare enough to mean something."
        >
          <Plate phase="day">
            <BirdPortrait bird={prism} facing="right" night={false} />
          </Plate>
        </Specimen>
      </Section>

      <Section
        title="Restlessness · unhappiness in motion"
        rule="Everyone bobs gently. The unhappier the bird, the more it fidgets, and a distressed bird's tail flicks. Content birds barely move. Motion stays subtle; reduced motion is honoured and stills them all."
        min={260}
      >
        <Specimen
          label="content: a slow, small bob"
          rule="Lift 2px, about 3.1 to 4.6 seconds a breath."
        >
          <Plate phase="dusk">
            <BirdPortrait bird={plainSpool} facing="right" night={false} />
          </Plate>
        </Specimen>
        <Specimen
          label="restless: a quicker bob"
          rule="Lift 3px, a little faster."
        >
          <Plate phase="dusk">
            <BirdPortrait
              bird={withOutstanding(skiff, 0)}
              facing="right"
              night={false}
            />
          </Plate>
        </Specimen>
        <Specimen
          label="distressed: fidgeting, the tail flicks"
          rule="Lift 4.4px, faster still; the tail flicks every 9 to 14 seconds."
        >
          <Plate phase="dusk">
            <BirdPortrait
              bird={withOutstanding(prism, 0)}
              facing="right"
              night={false}
            />
          </Plate>
        </Specimen>
      </Section>

      <Section
        title="Size · importance"
        rule="The importance tier from config sets the bird's base size. Machine and home outrank projects. The view model gives the tier's rank and the tier count; the least important is 0.9, the most 1.8."
        min={260}
      >
        <Specimen label="projects tier, rank 2 of 3" rule="Scale 0.9.">
          <Plate phase="day">
            <BirdPortrait bird={plainSpool} facing="right" night={false} />
          </Plate>
        </Specimen>
        <Specimen
          label="machine tier, rank 1 of 3"
          rule="Scale 1.35, as Dotfiles and the Hothouse Vault."
        >
          <Plate phase="day">
            <BirdPortrait
              bird={atRank(plainSpool, 1)}
              facing="right"
              night={false}
            />
          </Plate>
        </Specimen>
        <Specimen
          label="server tier, rank 0 of 3"
          rule="Scale 1.8. Hand-built: no bird in the mock sits in the top tier."
        >
          <Plate phase="day">
            <BirdPortrait
              bird={atRank(plainSpool, 0)}
              facing="right"
              night={false}
            />
          </Plate>
        </Specimen>
      </Section>

      <Section
        title="Plumpness · outstanding work"
        rule="More open roadmap items and tickets means a plumper bird, capped at 50 so nobody bursts: up to 65 per cent larger. Volume at a glance; exact numbers live in the bubble."
        min={260}
      >
        {[0, 12, 25, 50].map((outstanding) => (
          <Specimen
            key={outstanding}
            label={`${outstanding} open items`}
            rule={
              outstanding === 50
                ? "At the cap: as plump as it gets."
                : `Fullness ${outstanding / 50}.`
            }
          >
            <Plate phase="day">
              <BirdPortrait
                bird={withOutstanding(spool, outstanding)}
                facing="right"
                night={false}
              />
            </Plate>
          </Specimen>
        ))}
      </Section>

      <Section
        title="♪ · being edited"
        rule="The song means your hands are in its files right now. Activity is behaviour, not feeling: a separate axis from health, so any mood can sing."
        min={260}
      >
        <Specimen
          label="content and editing"
          rule="Perch: uncommitted work younger than a day."
        >
          <Plate phase="day">
            <BirdPortrait bird={perch} facing="right" night={false} />
          </Plate>
        </Specimen>
        <Specimen
          label="restless and editing"
          rule="The Hothouse Vault: six changes past a day."
        >
          <Plate phase="day">
            <BirdPortrait bird={hothouse} facing="right" night={false} />
          </Plate>
        </Specimen>
        <Specimen
          label="distressed and editing"
          rule="Prism: CI failing while you work on it."
        >
          <Plate phase="day">
            <BirdPortrait bird={prism} facing="right" night={false} />
          </Plate>
        </Specimen>
      </Section>

      <Section
        title="Asleep · the night is cosmetic, sleep is earned"
        rule="At night a content bird that is not being edited sleeps: eyes closed, still. Restless and distressed birds stay awake, an edited bird sings whatever the hour, and the fence sleeps. Colours and positions never change by night."
        min={260}
      >
        <Specimen
          label="content, not edited: asleep"
          rule="Spool closes its eyes and stops bobbing."
        >
          <Plate phase="night">
            <BirdPortrait bird={spool} facing="right" night={true} />
          </Plate>
        </Specimen>
        <Specimen
          label="restless: awake"
          rule="Skiff lies awake over its stalled branch."
        >
          <Plate phase="night">
            <BirdPortrait bird={skiff} facing="right" night={true} />
          </Plate>
        </Specimen>
        <Specimen
          label="edited: singing"
          rule="Perch sings at night as by day."
        >
          <Plate phase="night">
            <BirdPortrait bird={perch} facing="right" night={true} />
          </Plate>
        </Specimen>
        <Specimen
          label="on the fence: asleep"
          rule="Every fence bird sleeps at night."
        >
          <Plate phase="night">
            <BirdPortrait
              bird={mockBird("dev/odin/hello")}
              facing="right"
              night={true}
            />
          </Plate>
        </Specimen>
      </Section>

      <Section
        title="Dimmed, on the fence · not adopted"
        rule="Everything found starts on the fence. A fence bird does not wear its mood: dim plumage, dim breast, a quieter name, and it bobs like a content bird whatever its health. Adopting it means adding it to config."
        min={260}
      >
        <Specimen
          label="one disk only"
          rule="hello: a local repository with no remote at all."
        >
          <Plate phase="day">
            <BirdPortrait
              bird={mockBird("dev/odin/hello")}
              facing="right"
              night={false}
            />
          </Plate>
        </Specimen>
        <Specimen
          label="found, undecided"
          rule="hearth-config: config has neither adopted nor ignored it."
        >
          <Plate phase="day">
            <BirdPortrait
              bird={mockBird("dev/hearth-config")}
              facing="right"
              night={false}
            />
          </Plate>
        </Specimen>
        <Specimen
          label="forge only"
          rule="obsidian-tidy: on GitHub, no clone on this machine."
        >
          <Plate phase="day">
            <BirdPortrait
              bird={mockBird("github:finch/obsidian-tidy")}
              facing="right"
              night={false}
            />
          </Plate>
        </Specimen>
      </Section>

      <Section
        title="Facing · inwards"
        rule="Birds look inwards: the left half of a wire faces right, the right half faces left. The scene decides; the bird takes it as a prop."
        min={260}
      >
        <Specimen label="facing right" rule="Left of the middle.">
          <Plate phase="day">
            <BirdPortrait bird={skiff} facing="right" night={false} />
          </Plate>
        </Specimen>
        <Specimen label="facing left" rule="Right of the middle.">
          <Plate phase="day">
            <BirdPortrait bird={skiff} facing="left" night={false} />
          </Plate>
        </Specimen>
      </Section>

      <Usage
        component="<Bird> and <BirdPortrait>"
        props={[
          {
            name: "bird",
            type: "Bird",
            what: "One bird from the view model: mood, activity, size, plumpness, adoption, sleep.",
          },
          {
            name: "facing",
            type: '"left" | "right"',
            what: "Which way it looks; the wire turns birds inwards.",
          },
          {
            name: "night",
            type: "boolean",
            what: "The sky is at night. Derive it outside: isNight(skyPhase(new Date())).",
          },
          {
            name: "x, y",
            type: "number",
            what: "Bird only: where the toes rest on the wire line, in scene units.",
          },
          {
            name: "namePlace",
            type: '{ drop: number; size: "full" | "small" }',
            what: "Bird only: how far below the wire the name sits and its type size; crowded neighbours alternate baselines and step down a size, from namePlace().",
          },
          {
            name: "speaking",
            type: "boolean",
            what: "Bird only: its bubble has just opened, so the beak wiggles. The aviary sets it.",
          },
        ]}
      >
        <p>
          The birds come from <Code>deriveAviary(snapshot, config)</Code> in{" "}
          <Code>@perch/core/viewmodel.ts</Code>: each wire&apos;s{" "}
          <Code>birds</Code> and the fence&apos;s. <Code>Bird</Code> is an SVG
          group drawn into a <Code>Scene</Code> (usually through{" "}
          <Code>Wire</Code> or <Code>Fence</Code>); <Code>BirdPortrait</Code> is
          a standalone SVG of one bird on a short wire at its true size.
        </p>
        <p>
          The drawn scale is <Code>birdScale(bird)</Code>: the importance
          tier&apos;s base, or 0.78 on the fence, times the plumpness.
          Animations run behind <Code>motion-safe</Code>.
        </p>
      </Usage>
    </>
  );
}
