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

/** One GitHub card, the-undev's, and nothing else. */
const oneGithub: SourcesConfig = {
  ...none,
  github: [...mockSources.github.slice(1, 2)],
};

/** One Forgejo card, finch's at the mock's instance. */
const oneForgejo: SourcesConfig = {
  ...none,
  forgejo: [...mockSources.forgejo.slice(0, 1)],
};

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
          unfold={null}
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
        rule="The picker offers every kind but Uptime Kuma, which waits for server monitoring: each a sentence and what it needs, and it opens in place. Picking one appends a card of that kind after its kind's last, open, its empty fields named. A new GitHub card starts with github.com in its hosts; a Forgejo card's hosts take the host of its base URL once the address is typed, until the list is edited by hand. A kuma table already in the config keeps its card."
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
          rule="Every kind can be added again; the closing line keeps the door open for kinds Perch cannot read yet."
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
        title="The token and its test"
        rule="A GitHub or Forgejo card takes a pasted token into the system keyring under its keyring key, write-only: the field is never filled and empties once stored. Test lists the account's repositories with the stored token, as a scan does, and says so in one quiet sentence; a failure says what the keyring or the forge answered. Both are held while either runs and while the card has no key, and Test while it has no account or address. The manual command stays beside the key. An Uptime Kuma card has no token: its status pages are public reads. These stubs answer after a moment."
        min={640}
      >
        <PageSpecimen
          label="Stored and readable"
          rule="Open the card, paste anything and store it: the field empties and the sentence names the key. Test then reads the-undev: 5 repositories readable."
          start={oneGithub}
          cards={mockSnapshot.sourceCards}
          answers={keyringTakes}
        />
        <PageSpecimen
          label="The keyring refuses, and holds no token"
          rule="Storing answers with the keyring's own words and the pasted token stays in the field. Testing finds nothing under the key."
          start={oneGithub}
          cards={mockSnapshot.sourceCards}
          answers={{
            stored: {
              ok: false,
              problem:
                "the keyring did not take it: Cannot create an item in a locked collection",
            },
            tested: {
              ok: false,
              problem: "no token in the keyring under github-the-undev",
            },
          }}
        />
        <PageSpecimen
          label="The forge does not answer"
          rule="A Forgejo card tests at its own address; one that does not answer is named by host and port. A forge that refuses the token reads as its status, api.github.com answered HTTP 401."
          start={oneForgejo}
          cards={mockSnapshot.sourceCards}
          answers={{
            stored: { ok: true },
            tested: {
              ok: false,
              problem: "no answer from forge.example.lan:3000",
            },
          }}
        />
        <PageSpecimen
          label="A test still running"
          rule="This stub never answers: after Test, both buttons stay held and the sentence says testing."
          start={oneGithub}
          cards={mockSnapshot.sourceCards}
          answers={{ stored: { ok: true }, tested: "never" }}
        />
        <PageSpecimen
          label="A new card with no key yet"
          rule="Store and Test are held until the card has a keyring key, which follows the account as it is typed."
          start={withSourceAdded(none, "github")}
          cards={[]}
          answers={keyringTakes}
        />
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
            name: "unfold",
            type: "SourceCardKind | null",
            what: "The cards of this kind start unfolded, as a link to the page asks: a no-clone slip's Open Sources asks for local. Null for none.",
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
