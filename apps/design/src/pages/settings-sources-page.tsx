// The settings page's Sources: a card per configured source in every scan state, the picker, the
// first-run page with no sources, and the problems a card can show, all from the mock dataset.

import type { SourcesConfig } from "@perch/core/config.ts";
import { mockSnapshot } from "@perch/core/mock.ts";
import { withSourceAdded } from "@perch/core/sources-form.ts";
import type { SourceCard } from "@perch/core/viewmodel.ts";
import { mockSettingsForm } from "@perch/ui/mock-birds.ts";
import { SourcePicker, SourcesPage } from "@perch/ui/sources-page.tsx";
import { useState } from "react";
import { type KeyringAnswers, stubKeyring } from "../specimens.ts";
import { Code, Pressed, Section, Specimen, Usage } from "../usage.tsx";

/** Four minutes after the mock's scan, the moment the cards are measured to. */
const afterScan = new Date(Date.parse(mockSnapshot.scannedAt) + 4 * 60_000);

const mockSources = mockSettingsForm().values.sources;

const none: SourcesConfig = { local: [], github: [], forgejo: [], kuma: [] };

/** The mock's records with the Forgejo instance failing on its very first read. */
const neverRead: SourceCard[] = mockSnapshot.sourceCards.map((card) =>
  card.result.state === "failed"
    ? { ...card, result: { ...card.result, lastSucceededAt: null } }
    : card,
);

/** The mock's sources with a second card for finch and a new Uptime Kuma card. */
const withProblems: SourcesConfig = withSourceAdded(
  {
    ...mockSources,
    github: [
      ...mockSources.github,
      {
        account: "Finch",
        key: "github-finch-work",
        hosts: ["github.com"],
        trackedForks: [],
      },
    ],
  },
  "kuma",
);

/** The keyring as it answers when the token is stored and reads the account. */
const keyringTakes: KeyringAnswers = {
  stored: { ok: true },
  tested: { ok: true, count: 5 },
};

/** The page in a state, editable here, its keyring calls answering as given. */
function PageSpecimen({
  label,
  rule,
  start,
  cards,
  answers,
}: {
  label: string;
  rule: string;
  start: SourcesConfig;
  cards: SourceCard[] | null;
  answers: KeyringAnswers;
}) {
  const [value, setValue] = useState(start);
  const [pressed, setPressed] = useState("nothing yet");
  return (
    <Specimen label={label} rule={rule}>
      <div className="max-w-190">
        <SourcesPage
          value={value}
          cards={cards}
          now={afterScan}
          keyring={stubKeyring(answers, setPressed)}
          onChange={setValue}
        />
      </div>
      <Pressed text={pressed} />
    </Specimen>
  );
}

export function SettingsSourcesPage() {
  const [pressed, setPressed] = useState("nothing yet");
  return (
    <>
      <Section
        title="Every scan state"
        rule="Each card opens with its last scan in words, matched to the snapshot's record by its id. Found or read with the count and the minutes since; failed with the reason in red, and when it last read once known; never scanned for a card with no record, a new one among them. A local card names its folders not found."
        min={640}
      >
        <PageSpecimen
          label="As the mock holds them, four minutes after its scan"
          rule="Local folders found 14 and misses ~/work; three GitHub accounts read; both Forgejo cards fail with the instance, last read 19 minutes before; the Silo page is never scanned. Press a heading to open its card."
          start={mockSources}
          cards={mockSnapshot.sourceCards}
          answers={keyringTakes}
        />
        <PageSpecimen
          label="A failure before any read"
          rule="The Forgejo instance has never answered: the card says why, and no last read."
          start={mockSources}
          cards={neverRead}
          answers={keyringTakes}
        />
        <PageSpecimen
          label="Before the first scan"
          rule="No snapshot holds the cards yet: every card is never scanned."
          start={mockSources}
          cards={null}
          answers={keyringTakes}
        />
      </Section>
      <Section
        title="Adding a source"
        rule="The picker offers every kind, each a sentence and what it needs, and opens in place. Picking one appends a card of that kind after its kind's last, open, its empty fields named."
        min={640}
      >
        <PageSpecimen
          label="No sources yet: the first-run page"
          rule="A fresh config holds none. The invitation shows with the picker already open."
          start={none}
          cards={[]}
          answers={keyringTakes}
        />
        <Specimen
          label="The picker on its own"
          rule="Every kind can be added again; the closing line keeps the door open for kinds perch cannot read yet."
        >
          <div className="max-w-190">
            <SourcePicker
              onPick={(kind) => setPressed(`onPick("${kind}")`)}
              onClose={() => setPressed("onClose()")}
            />
          </div>
          <Pressed text={pressed} />
        </Specimen>
      </Section>
      <Section
        title="Problems"
        rule="Each problem sits beneath its field, and the editor lists them beside Save, which stays off. A card that cannot be written starts open. The distinctness rules are the config parser's: one card per GitHub account in any case, per Forgejo account at one address, per Uptime Kuma name."
        min={640}
      >
        <PageSpecimen
          label="A repeated account and an empty new card"
          rule="Finch repeats finch; the new Uptime Kuma card has no name, address or status page."
          start={withProblems}
          cards={mockSnapshot.sourceCards}
          answers={keyringTakes}
        />
      </Section>
      <Usage
        component="<SourcesPage>"
        props={[
          {
            name: "value",
            type: "SourcesConfig",
            what: "Config's source tables as the draft holds them, local paths written with ~.",
          },
          {
            name: "cards",
            type: "SourceCard[] | null",
            what: "Each configured card's last scan from the latest snapshot; null until one holds them.",
          },
          {
            name: "now",
            type: "Date",
            what: "The moment the scan times are measured to.",
          },
          {
            name: "keyring",
            type: "KeyringCalls",
            what: "storeToken(key, token) writes a pasted token into the keyring; testSource(values) lists a forge card's repositories with the token its key holds. Each resolves ok or with a problem sentence, never with the token.",
          },
          {
            name: "onChange",
            type: "(value: SourcesConfig) => void",
            what: "A field edited, a card added or a card removed.",
          },
        ]}
      >
        <p>
          The editor renders it on the Sources page. Cards come from{" "}
          <Code>sourceCardsOf(value)</Code> in{" "}
          <Code>@perch/core/sources-form.ts</Code>; each is matched to its scan
          record by <Code>sourceCardId</Code>, the same id{" "}
          <Code>configuredCards</Code> gives the snapshot's cards, and its
          problems come from <Code>sourceProblems(value)</Code>. The desktop app
          passes <Code>sourceCards</Code> from its pushed state.
        </p>
      </Usage>
    </>
  );
}
