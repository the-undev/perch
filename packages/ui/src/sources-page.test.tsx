import { mockSnapshot, mockUpdates } from "@perch/core/mock.ts";
import type { SettingsForm } from "@perch/core/settings-form.ts";
import type {
  KeyringCalls,
  SourceTested,
  TokenStored,
} from "@perch/core/sources-form.ts";
import type { SourceCard, SourceCardKind } from "@perch/core/viewmodel.ts";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSettingsForm } from "./mock-birds.ts";
import { SettingsEditor } from "./settings-forms.tsx";

afterEach(cleanup);

/** Four minutes after the mock's scan. */
const now = new Date("2026-10-22T09:04:00.000Z");

/** Keyring calls that record what they were asked and answer what the test says. */
function fakeKeyring(
  stored: () => Promise<TokenStored> = async () => ({ ok: true }),
  tested: () => Promise<SourceTested> = async () => ({ ok: true, count: 0 }),
) {
  const storeToken = vi.fn((_key: string, _token: string) => stored());
  const testSource = vi.fn(
    (_values: Parameters<KeyringCalls["testSource"]>[0]) => tested(),
  );
  const keyring: KeyringCalls = { storeToken, testSource };
  return { keyring, storeToken, testSource };
}

function sourcesPage(
  form: SettingsForm = mockSettingsForm(),
  cards: SourceCard[] | null = mockSnapshot.sourceCards,
  keyring: KeyringCalls = fakeKeyring().keyring,
  unfold: SourceCardKind | null = null,
) {
  const onSave = vi.fn();
  render(
    <SettingsEditor
      form={form}
      page="sources"
      cards={cards}
      now={now}
      keyring={keyring}
      unfold={unfold}
      update={mockUpdates.upToDate}
      updateCalls={{
        onCheck: () => {},
        onInstall: () => {},
        onRestart: () => {},
      }}
      onSave={onSave}
    />,
  );
  return { onSave, form };
}

const card = (name: string) => screen.getByRole("region", { name });

const open = (name: string) =>
  fireEvent.click(within(card(name)).getByRole("button", { name }));

const type = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } });

const saveButton = () =>
  screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

const noSources = (): SettingsForm => {
  const form = mockSettingsForm();
  return {
    ...form,
    values: {
      ...form.values,
      sources: { local: [], github: [], forgejo: [], kuma: [] },
    },
  };
};

describe("the sources page", () => {
  it("heads a card per source in config order, each with its last scan in words", () => {
    sourcesPage();
    const page = within(screen.getByRole("region", { name: "Sources" }));

    expect(
      page.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
    ).toEqual([
      "Local folders",
      "GitHub · finch",
      "GitHub · the-undev",
      "Forgejo · forge.example.lan:3000",
      "Forgejo · forge.example.lan:3000",
      "Uptime Kuma · Silo",
    ]);
    const local = within(card("Local folders"));
    expect(local.getByText("6 folders searched")).toBeDefined();
    expect(local.getByText("found 14 repositories · 4 min ago")).toBeDefined();
    expect(local.getByText("not found: ~/work")).toBeDefined();
    expect(
      within(card("GitHub · finch")).getByText(
        "read 5 repositories · 4 min ago",
      ),
    ).toBeDefined();
    const [forgejo] = screen.getAllByRole("region", {
      name: "Forgejo · forge.example.lan:3000",
    });
    expect(
      within(forgejo as HTMLElement).getByText(
        "failed: fetch failed: connect ETIMEDOUT forge.example.lan:3000",
      ),
    ).toBeDefined();
    expect(
      within(forgejo as HTMLElement).getByText("last read 19 min ago"),
    ).toBeDefined();
    expect(
      within(card("Uptime Kuma · Silo")).getByText("never scanned yet"),
    ).toBeDefined();
  });

  it("reads a card with no scan record yet as never scanned", () => {
    sourcesPage(mockSettingsForm(), null);

    expect(
      within(card("GitHub · finch")).getByText("never scanned yet"),
    ).toBeDefined();
  });

  it("opens a card to its fields, paths kept with ~", () => {
    sourcesPage();

    expect(
      within(card("Local folders")).queryByRole("textbox", {
        name: "folder 1",
      }),
    ).toBeNull();
    open("Local folders");

    const local = within(card("Local folders"));
    expect(
      (local.getByRole("textbox", { name: "folder 1" }) as HTMLInputElement)
        .value,
    ).toBe("~/dev");
    expect(
      (
        local.getByRole("textbox", {
          name: "excluded folder 1",
        }) as HTMLInputElement
      ).value,
    ).toBe("~/dev/archived");
  });

  it("starts the cards of the kind a link asks for unfolded, the rest folded", () => {
    sourcesPage(
      mockSettingsForm(),
      mockSnapshot.sourceCards,
      fakeKeyring().keyring,
      "local",
    );

    expect(
      (
        within(card("Local folders")).getByRole("textbox", {
          name: "folder 1",
        }) as HTMLInputElement
      ).value,
    ).toBe("~/dev");
    expect(
      within(card("GitHub · finch"))
        .getByRole("button", { name: "GitHub · finch" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("shows the keyring key's manual command beside it", () => {
    sourcesPage();
    open("GitHub · the-undev");

    expect(
      within(card("GitHub · the-undev")).getByText(
        "secret-tool store --label perch service perch key github-the-undev",
      ),
    ).toBeDefined();
  });

  it("opens the picker with every offered kind on a page with no sources", () => {
    sourcesPage(noSources(), []);

    expect(screen.getByText("No sources yet")).toBeDefined();
    const kinds = within(screen.getByRole("list", { name: "Kinds of source" }));
    expect(
      kinds.getAllByRole("button").map((button) => button.ariaLabel),
    ).toEqual(["Add Local folders", "Add GitHub", "Add Forgejo"]);
    expect(
      screen.getByText(
        "Every kind can be added again · more kinds are added in later versions.",
      ),
    ).toBeDefined();
  });

  it("keeps an existing Uptime Kuma card while the picker no longer offers the kind", () => {
    sourcesPage();

    expect(card("Uptime Kuma · Silo")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
    expect(screen.getByRole("list", { name: "Kinds of source" })).toBeDefined();
    expect(
      screen.queryByRole("button", { name: "Add Uptime Kuma" }),
    ).toBeNull();
  });

  it("appends a card of the kind picked, open with its empty fields named, the key following the account", () => {
    const { onSave, form } = sourcesPage();

    expect(screen.queryByRole("list", { name: "Kinds of source" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
    fireEvent.click(screen.getByRole("button", { name: "Add GitHub" }));

    expect(screen.queryByRole("list", { name: "Kinds of source" })).toBeNull();
    const added = within(card("GitHub"));
    expect(added.getByText("needs an account")).toBeDefined();
    expect(saveButton().disabled).toBe(true);
    type(added.getByRole("textbox", { name: "Account" }), "someone");
    const named = within(card("GitHub · someone"));
    expect(
      (named.getByRole("textbox", { name: "Keyring key" }) as HTMLInputElement)
        .value,
    ).toBe("github-someone");
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      sources: {
        ...form.values.sources,
        github: [
          ...form.values.sources.github,
          {
            account: "someone",
            key: "github-someone",
            hosts: ["github.com"],
            trackedForks: [],
          },
        ],
      },
    });
  });

  it("starts a GitHub card with github.com in its hosts and fills a Forgejo card's from its typed base URL", () => {
    sourcesPage();
    fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
    fireEvent.click(screen.getByRole("button", { name: "Add GitHub" }));
    expect(
      within(card("GitHub")).getByRole("textbox", { name: "host 1" }),
    ).toHaveProperty("value", "github.com");

    fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Forgejo" }));
    const added = within(card("Forgejo"));
    expect(added.queryByRole("textbox", { name: "host 1" })).toBeNull();
    type(
      added.getByRole("textbox", { name: "Base URL" }),
      "https://forge.example.lan",
    );

    expect(
      within(card("Forgejo · forge.example.lan")).getByRole("textbox", {
        name: "host 1",
      }),
    ).toHaveProperty("value", "forge.example.lan");
  });

  it("removes a card only on the second press", () => {
    const { onSave, form } = sourcesPage();
    open("GitHub · finch");

    fireEvent.click(
      within(card("GitHub · finch")).getByRole("button", {
        name: "Remove this source",
      }),
    );
    expect(card("GitHub · finch")).toBeDefined();
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(
      within(card("GitHub · finch")).getByRole("button", {
        name: "Stop looking here",
      }),
    );

    expect(screen.queryByRole("region", { name: "GitHub · finch" })).toBeNull();
    expect(
      within(card("GitHub · the-undev")).queryByRole("button", {
        name: "Stop looking here",
      }),
    ).toBeNull();
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      sources: {
        ...form.values.sources,
        github: [form.values.sources.github[1]],
      },
    });
  });

  it("names each problem beside its field, and holds Save", () => {
    sourcesPage();
    open("GitHub · the-undev");
    open("Uptime Kuma · Silo");

    const account = within(card("GitHub · the-undev")).getByRole("textbox", {
      name: "Account",
    });
    type(account, "FINCH");
    const address = within(card("Uptime Kuma · Silo")).getByRole("textbox", {
      name: "Base URL",
    });
    type(address, "forge.example.lan:3001");

    expect(
      within(account.parentElement as HTMLElement).getByText(
        "another GitHub source reads this account",
      ),
    ).toBeDefined();
    expect(
      within(address.parentElement as HTMLElement).getByText(
        "must start with http:// or https://",
      ),
    ).toBeDefined();
    expect(
      screen.getByText(
        "GitHub source 2, account: another GitHub source reads this account",
      ),
    ).toBeDefined();
    expect(saveButton().disabled).toBe(true);
  });
});

/** A promise and the call that settles it, so a test can look while a call runs. */
function deferred<T>() {
  let settle: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

const tokenField = (name: string) =>
  within(card(name)).getByLabelText("Token") as HTMLInputElement;

const cardButton = (name: string, button: string) =>
  within(card(name)).getByRole("button", { name: button }) as HTMLButtonElement;

describe("a forge card's token", () => {
  it("is a write-only field, never filled, that empties once its token is stored", async () => {
    const { keyring, storeToken } = fakeKeyring();
    sourcesPage(mockSettingsForm(), mockSnapshot.sourceCards, keyring);
    open("GitHub · the-undev");

    const field = tokenField("GitHub · the-undev");
    expect(field.type).toBe("password");
    expect(field.autocomplete).toBe("off");
    expect(field.value).toBe("");
    type(field, "github_pat_11ABC");
    fireEvent.click(cardButton("GitHub · the-undev", "Store in the keyring"));

    expect(storeToken).toHaveBeenCalledWith(
      "github-the-undev",
      "github_pat_11ABC",
    );
    expect(
      await within(card("GitHub · the-undev")).findByText(
        "stored in the keyring under github-the-undev",
      ),
    ).toBeDefined();
    expect(tokenField("GitHub · the-undev").value).toBe("");
  });

  it("keeps the token and says what the keyring answered when it refuses", async () => {
    const { keyring } = fakeKeyring(async () => ({
      ok: false,
      problem: "the keyring did not take it: the collection is locked",
    }));
    sourcesPage(mockSettingsForm(), mockSnapshot.sourceCards, keyring);
    open("GitHub · the-undev");

    type(tokenField("GitHub · the-undev"), "github_pat_11ABC");
    fireEvent.click(cardButton("GitHub · the-undev", "Store in the keyring"));

    expect(
      await within(card("GitHub · the-undev")).findByText(
        "the keyring did not take it: the collection is locked",
      ),
    ).toBeDefined();
    expect(tokenField("GitHub · the-undev").value).toBe("github_pat_11ABC");
  });

  it("holds Store and Test while a call runs, then says what the test read", async () => {
    const test = deferred<SourceTested>();
    const { keyring, testSource } = fakeKeyring(undefined, () => test.promise);
    sourcesPage(mockSettingsForm(), mockSnapshot.sourceCards, keyring);
    open("GitHub · the-undev");
    type(tokenField("GitHub · the-undev"), "github_pat_11ABC");

    fireEvent.click(cardButton("GitHub · the-undev", "Test"));

    expect(testSource).toHaveBeenCalledWith({
      kind: "github",
      account: "the-undev",
      key: "github-the-undev",
    });
    expect(cardButton("GitHub · the-undev", "Test").disabled).toBe(true);
    expect(
      cardButton("GitHub · the-undev", "Store in the keyring").disabled,
    ).toBe(true);
    expect(
      within(card("GitHub · the-undev")).getByRole("status").textContent,
    ).toBe("testing");
    await act(async () => test.settle({ ok: true, count: 18 }));

    expect(
      within(card("GitHub · the-undev")).getByRole("status").textContent,
    ).toBe("the-undev: 18 repositories readable");
    expect(cardButton("GitHub · the-undev", "Test").disabled).toBe(false);
    expect(
      cardButton("GitHub · the-undev", "Store in the keyring").disabled,
    ).toBe(false);
  });

  it("holds Store and Test while the card has no keyring key", () => {
    sourcesPage();
    open("GitHub · the-undev");
    type(tokenField("GitHub · the-undev"), "github_pat_11ABC");

    type(
      within(card("GitHub · the-undev")).getByRole("textbox", {
        name: "Keyring key",
      }),
      "",
    );

    expect(
      cardButton("GitHub · the-undev", "Store in the keyring").disabled,
    ).toBe(true);
    expect(cardButton("GitHub · the-undev", "Test").disabled).toBe(true);
  });

  it("tests a Forgejo card at its address and says what failed", async () => {
    const { keyring, testSource } = fakeKeyring(undefined, async () => ({
      ok: false,
      problem: "no answer from forge.example.lan:3000",
    }));
    sourcesPage(mockSettingsForm(), mockSnapshot.sourceCards, keyring);
    const [forgejo] = screen.getAllByRole("region", {
      name: "Forgejo · forge.example.lan:3000",
    }) as HTMLElement[];
    const forgejoCard = within(forgejo as HTMLElement);
    fireEvent.click(
      forgejoCard.getByRole("button", {
        name: "Forgejo · forge.example.lan:3000",
      }),
    );

    fireEvent.click(forgejoCard.getByRole("button", { name: "Test" }));

    expect(testSource).toHaveBeenCalledWith({
      kind: "forgejo",
      account: "finch",
      key: "forgejo-finch",
      baseUrl: "http://forge.example.lan:3000",
    });
    expect(
      await forgejoCard.findByText("no answer from forge.example.lan:3000"),
    ).toBeDefined();
  });

  it("is not on an Uptime Kuma card, whose status pages are public", () => {
    sourcesPage();
    open("Uptime Kuma · Silo");

    const kuma = within(card("Uptime Kuma · Silo"));
    expect(kuma.queryByLabelText("Token")).toBeNull();
    expect(kuma.queryByRole("button", { name: "Test" })).toBeNull();
  });
});
