import { defaultConfig } from "@perch/core/config-default.ts";
import {
  type SettingsForm,
  settingsFormFor,
} from "@perch/core/settings-form.ts";
import type { KeyringCalls } from "@perch/core/sources-form.ts";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockHome, mockSettingsForm } from "./mock-birds.ts";
import { SettingsEditor, type SettingsPageName } from "./settings-forms.tsx";
import { SettingsView } from "./settings-view.tsx";

afterEach(cleanup);

const now = new Date("2026-10-22T09:04:00.000Z");

/** Keyring calls these tests never make. */
const keyring: KeyringCalls = {
  storeToken: async () => ({ ok: true }),
  testSource: async () => ({ ok: true, count: 0 }),
};

/** The editor on one page, with no scan records. */
const editorOn = (
  page: SettingsPageName,
  form: SettingsForm,
  onSave: () => void,
) => (
  <SettingsEditor
    form={form}
    page={page}
    cards={null}
    now={now}
    keyring={keyring}
    onSave={onSave}
  />
);

function editor(page: SettingsPageName, form = mockSettingsForm()) {
  const onSave = vi.fn();
  const view = render(editorOn(page, form, onSave));
  return { onSave, form, view };
}

const group = (name: string) => within(screen.getByRole("region", { name }));

const saveButton = () =>
  screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

const type = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } });

const machine = { from: "Machine & Home", name: "Machine & Home" };
const projects = { from: "Projects", name: "Projects" };

describe("the settings editor", () => {
  it("holds Save until something changes, and discards back to the file's values", () => {
    const { onSave } = editor("scanning");

    expect(saveButton().disabled).toBe(true);
    type(
      screen.getByRole("spinbutton", { name: "Scan interval in minutes" }),
      "30",
    );
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(
      (
        screen.getByRole("spinbutton", {
          name: "Scan interval in minutes",
        }) as HTMLInputElement
      ).value,
    ).toBe("15");
    expect(saveButton().disabled).toBe(true);
    fireEvent.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("orders the wires, adds one and picks the default from them", () => {
    const { onSave, form } = editor("wires");
    const wires = group("Wires");

    expect(
      (
        wires.getByRole("button", {
          name: "Move wire Machine & Home up",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      wires.getByRole("button", { name: "Move wire Projects up" }),
    );
    type(wires.getByRole("textbox", { name: "Add a wire" }), "Someday");
    fireEvent.keyDown(wires.getByRole("textbox", { name: "Add a wire" }), {
      key: "Enter",
    });
    fireEvent.click(wires.getByRole("radio", { name: "Someday" }));
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      wires: {
        rows: [projects, machine, { from: null, name: "Someday" }],
        defaultRow: 2,
      },
    });
  });

  it("says a wire edited in place is a rename, keeps it the default, and says a wire needs a name", () => {
    const { onSave, form } = editor("wires");
    const wires = group("Wires");

    expect(wires.queryByText(/^was /)).toBeNull();
    type(wires.getByRole("textbox", { name: "wire 2" }), "Work");
    expect(wires.getByText("was Projects")).toBeDefined();
    expect(
      (wires.getByRole("radio", { name: "Work" }) as HTMLInputElement).checked,
    ).toBe(true);
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenLastCalledWith({
      ...form.values,
      wires: {
        rows: [machine, { from: "Projects", name: "Work" }],
        defaultRow: 1,
      },
    });

    type(wires.getByRole("textbox", { name: "wire 2" }), "Projects");
    expect(wires.queryByText(/^was /)).toBeNull();
    type(wires.getByRole("textbox", { name: "wire 1" }), " ");
    expect(screen.getByText("Wires: every wire needs a name")).toBeDefined();
  });

  it("keeps a moved row's from, so its rename and the default move with it", () => {
    const { onSave, form } = editor("wires");
    const wires = group("Wires");

    type(wires.getByRole("textbox", { name: "wire 2" }), "Work");
    fireEvent.click(wires.getByRole("button", { name: "Move wire Work up" }));

    expect(
      (wires.getByRole("textbox", { name: "wire 1" }) as HTMLInputElement)
        .value,
    ).toBe("Work");
    expect(wires.getByText("was Projects")).toBeDefined();
    expect(
      (wires.getByRole("radio", { name: "Work" }) as HTMLInputElement).checked,
    ).toBe(true);
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      wires: {
        rows: [{ from: "Projects", name: "Work" }, machine],
        defaultRow: 0,
      },
    });
  });

  it("swaps two wires' names, the default staying on its row", () => {
    const { onSave, form } = editor("wires");
    const wires = group("Wires");

    type(wires.getByRole("textbox", { name: "wire 1" }), "Projects");
    expect(
      screen.getByText(
        "Wires: two wires are named Projects; each name may appear once",
      ),
    ).toBeDefined();
    type(wires.getByRole("textbox", { name: "wire 2" }), "Machine & Home");
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      wires: {
        rows: [
          { from: "Machine & Home", name: "Projects" },
          { from: "Projects", name: "Machine & Home" },
        ],
        defaultRow: 1,
      },
    });
  });

  it("removes a wire on the second press, having said how many birds move to the default", () => {
    const { onSave, form } = editor("wires");
    const wires = group("Wires");
    const remove = () =>
      wires.getByRole("button", { name: "Remove wire Machine & Home" });

    fireEvent.click(remove());
    expect(
      (wires.getByRole("textbox", { name: "wire 1" }) as HTMLInputElement)
        .value,
    ).toBe("Machine & Home");
    expect(
      wires.getByText("3 birds name this wire; they move to Projects."),
    ).toBeDefined();
    expect(remove().getAttribute("aria-describedby")).not.toBeNull();
    expect(saveButton().disabled).toBe(true);

    fireEvent.click(remove());
    expect(
      wires.queryByRole("button", { name: "Remove wire Machine & Home" }),
    ).toBeNull();
    expect(
      wires.getByText(
        ".dotfiles, obsidian/Hothouse and obsidian/Pocket sit on Machine & Home, which is removed: saving moves them to the default wire, Projects.",
      ),
    ).toBeDefined();
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      wires: { rows: [projects], defaultRow: 0 },
    });
  });

  it("counts a renamed wire's birds by the wire it was, asks through a move, keeps on keep, and says plainly when none name it", () => {
    editor("wires");
    const wires = group("Wires");

    type(wires.getByRole("textbox", { name: "wire 1" }), "Home");
    fireEvent.click(wires.getByRole("button", { name: "Remove wire Home" }));
    expect(
      wires.getByText("3 birds name this wire; they move to Projects."),
    ).toBeDefined();
    fireEvent.click(wires.getByRole("button", { name: "Move wire Home down" }));
    expect(
      wires
        .getByRole("button", { name: "Remove wire Home" })
        .getAttribute("aria-describedby"),
    ).not.toBeNull();
    fireEvent.click(wires.getByRole("button", { name: "keep" }));
    expect(wires.queryByText(/name this wire/)).toBeNull();

    type(wires.getByRole("textbox", { name: "Add a wire" }), "Someday");
    fireEvent.click(wires.getByRole("button", { name: "Add the wire" }));
    fireEvent.click(wires.getByRole("button", { name: "Remove wire Someday" }));
    expect(wires.getByText("No bird names this wire.")).toBeDefined();
    fireEvent.click(wires.getByRole("button", { name: "Remove wire Someday" }));

    expect(
      wires.queryByRole("button", { name: "Remove wire Someday" }),
    ).toBeNull();
    expect(
      wires.getByRole("button", { name: "Remove wire Home" }),
    ).toBeDefined();
  });

  it("holds the default wire's removal until another wire is the default", () => {
    editor("wires");
    const wires = group("Wires");
    const removeProjects = () =>
      wires.getByRole("button", {
        name: "Remove wire Projects",
      }) as HTMLButtonElement;

    expect(removeProjects().disabled).toBe(true);
    fireEvent.click(wires.getByRole("radio", { name: "Machine & Home" }));

    expect(removeProjects().disabled).toBe(false);
  });

  it("holds two windows on the Judgement page: unsafe work and stalled flight", () => {
    editor("judgement");

    expect(
      group("Judgement")
        .getAllByRole("spinbutton")
        .map((field) => field.getAttribute("aria-label")),
    ).toEqual([
      "Unsafe work, amber after hours",
      "Unsafe work, red after hours",
      "Stalled flight, amber after days",
      "Stalled flight, red after days",
    ]);
  });

  it("holds the global thresholds to amber before red, in whole numbers", () => {
    editor("judgement");
    const thresholds = group("Judgement");

    type(
      thresholds.getByRole("spinbutton", {
        name: "Stalled flight, amber after days",
      }),
      "40",
    );
    type(
      thresholds.getByRole("spinbutton", {
        name: "Unsafe work, red after hours",
      }),
      "",
    );

    expect(
      screen.getByText("Stalled flight: amber must come before red"),
    ).toBeDefined();
    expect(
      screen.getByText(
        "Unsafe work: thresholds must be whole hours above zero",
      ),
    ).toBeDefined();
    expect(saveButton().disabled).toBe(true);
  });

  it("edits the finalised commit count in the scan group, which holds no archived interval", () => {
    const { onSave, form } = editor("scanning");

    expect(
      group("Scanning")
        .getAllByRole("spinbutton")
        .map((field) => field.getAttribute("aria-label")),
    ).toEqual(["Scan interval in minutes", "Finalised commits"]);
    type(
      group("Scanning").getByRole("spinbutton", { name: "Finalised commits" }),
      "4",
    );
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      scan: { ...form.values.scan, finalisedCommits: 4 },
    });
  });

  it("says an interval must be whole minutes above zero", () => {
    editor("scanning");

    type(
      screen.getByRole("spinbutton", { name: "Scan interval in minutes" }),
      "0",
    );

    expect(
      screen.getByText("Scan interval: must be whole minutes above zero"),
    ).toBeDefined();
  });

  it("adds a join as a list line and an ignored presence", () => {
    const { onSave, form } = editor("joining");
    const presences = group("Joining up");

    type(
      presences.getByRole("textbox", { name: "Add a join" }),
      "github:a/b forgejo:a/b",
    );
    fireEvent.click(presences.getByRole("button", { name: "Add the join" }));
    expect(screen.getByText(/^Joins: each join must be a list/)).toBeDefined();
    type(
      presences.getByRole("textbox", { name: "join 1" }),
      '["github:a/b", "forgejo:a/b"]',
    );
    type(
      presences.getByRole("textbox", { name: "Add an ignored presence" }),
      "github:a/old",
    );
    fireEvent.click(
      presences.getByRole("button", { name: "Add the ignored presence" }),
    );
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      joins: ['["github:a/b", "forgejo:a/b"]'],
      ignore: ["github:a/old"],
    });
  });

  it("follows the file while untouched, and notes a change to it once edited", () => {
    const first = mockSettingsForm();
    const { view } = editor("scanning", first);
    const fromDisk = (intervalMinutes: number): SettingsForm => ({
      ...first,
      values: {
        ...first.values,
        scan: { ...first.values.scan, intervalMinutes },
      },
    });
    const interval = () =>
      (
        screen.getByRole("spinbutton", {
          name: "Scan interval in minutes",
        }) as HTMLInputElement
      ).value;

    view.rerender(editorOn("scanning", fromDisk(20), () => {}));
    expect(interval()).toBe("20");

    type(screen.getByRole("spinbutton", { name: "Finalised commits" }), "4");
    view.rerender(editorOn("scanning", fromDisk(25), () => {}));
    expect(interval()).toBe("20");
    expect(
      screen.getByText(/The config file changed since this form was edited/),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(interval()).toBe("25");
    expect(screen.queryByText(/The config file changed/)).toBeNull();
  });

  it("takes the file's values after its own save", () => {
    const first = mockSettingsForm();
    const { view } = editor("scanning", first);

    type(
      screen.getByRole("spinbutton", { name: "Scan interval in minutes" }),
      "30",
    );
    fireEvent.click(saveButton());
    view.rerender(
      editorOn(
        "scanning",
        {
          ...first,
          values: {
            ...first.values,
            scan: { ...first.values.scan, intervalMinutes: 30 },
          },
        },
        () => {},
      ),
    );

    expect(screen.queryByText(/The config file changed/)).toBeNull();
    expect(saveButton().disabled).toBe(true);
  });
});

/** Each action card on the Launching page, in order. */
const actionCards = () => group("Launching").queryAllByRole("region");

/** One action card's head: its name, its verb, and whether it is open. */
const cardHeads = () =>
  actionCards().map((card) => {
    const head = within(card).getAllByRole("button")[0] as HTMLElement;
    return [
      head.textContent,
      head.closest("h3")?.nextElementSibling?.textContent,
      head.getAttribute("aria-expanded"),
    ];
  });

/** The card at a place, for queries within it. */
const cardAt = (index: number) => within(actionCards()[index] as HTMLElement);

/** Opens the card at a place by its head. */
const openCard = (index: number) =>
  fireEvent.click(cardAt(index).getAllByRole("button")[0] as HTMLElement);

const shelfAdd = (name: string) =>
  within(screen.getByRole("list", { name: "Presets" })).getByRole("button", {
    name: `Add ${name}`,
  }) as HTMLButtonElement;

describe("the Launching page", () => {
  it("shows one closed card per action in config order, named by its preset, its verb greyed", () => {
    editor("launching");

    expect(cardHeads()).toEqual([
      ["Obsidian", "Open in Obsidian", "false"],
      ["zellij tab", "Open the zellij tab", "false"],
      ["VS Code", "Open in VS Code", "false"],
      ["Custom command", "Open the folder", "false"],
    ]);
  });

  it("opens a card by its head, and refuses a command not in list form on the card in red and beside Save", () => {
    const { onSave, form } = editor("launching");
    openCard(2);
    const command = cardAt(2).getByRole("textbox", { name: "Command" });

    expect((command as HTMLInputElement).value).toBe('["code", "{path}"]');
    expect(
      cardAt(2).getByText(/^Offered on every bird with a folder/),
    ).toBeDefined();
    type(command, "code {path}");
    expect(
      cardAt(2).getByText(/^must be a list in brackets/).className,
    ).toContain("text-red");
    expect(
      screen.getByText(/^Launch action 3, command: must be a list in brackets/),
    ).toBeDefined();
    expect(saveButton().disabled).toBe(true);
    type(command, '["code", "--title", "my \\"project\\"", "{path}"]');
    type(cardAt(2).getByRole("textbox", { name: "Action" }), "Code it");
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      launch: {
        actions: form.values.launch.actions.with(2, {
          kind: "command",
          verb: "Code it",
          command: '["code", "--title", "my \\"project\\"", "{path}"]',
        }),
      },
    });
  });

  it("refuses a blank verb and a placeholder the action may not use", () => {
    editor("launching");
    openCard(0);
    expect(
      cardAt(0).getByText(
        /^Uses \{obsidian\}, so it is offered on Obsidian birds only\./,
      ),
    ).toBeDefined();

    type(cardAt(0).getByRole("textbox", { name: "Action" }), " ");
    type(
      cardAt(0).getByRole("textbox", { name: "Command" }),
      '["code", "{worktree}"]',
    );

    expect(cardHeads()[0]).toEqual(["Custom command", "no words yet", "true"]);
    expect(
      cardAt(0).getByText("needs words for the bird's page"),
    ).toBeDefined();
    expect(
      cardAt(0).getByText(
        "has no placeholder {worktree}; it may use {path} and {obsidian}",
      ),
    ).toBeDefined();
    expect(saveButton().disabled).toBe(true);
  });

  it("orders the cards with the arrows and removes one, saving them in that order", () => {
    const { onSave, form } = editor("launching");
    const [obsidian, zellij, vscode] = form.values.launch.actions;

    fireEvent.click(
      cardAt(2).getByRole("button", {
        name: "Move Open in VS Code earlier on the bird",
      }),
    );
    fireEvent.click(
      cardAt(3).getByRole("button", { name: "Remove Open the folder" }),
    );
    fireEvent.click(saveButton());

    expect(
      cardAt(0).getByRole("button", { name: /earlier on the bird$/ }),
    ).toHaveProperty("disabled", true);
    expect(
      cardAt(2).getByRole("button", { name: /later on the bird$/ }),
    ).toHaveProperty("disabled", true);
    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      launch: { actions: [obsidian, vscode, zellij] },
    });
  });

  it("adds a preset's card at the end, filled in and open alone, and holds zellij back while one exists", () => {
    const { onSave, form } = editor("launching");
    openCard(0);

    expect(shelfAdd("zellij tab").disabled).toBe(true);
    expect(shelfAdd("zellij tab").closest("li")?.textContent).toContain(
      "already added",
    );
    fireEvent.click(shelfAdd("Folder"));

    expect(cardHeads().map(([, , expanded]) => expanded)).toEqual([
      "false",
      "false",
      "false",
      "false",
      "true",
    ]);
    expect(
      (cardAt(4).getByRole("textbox", { name: "Command" }) as HTMLInputElement)
        .value,
    ).toBe('["xdg-open", "{path}"]');
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      launch: {
        actions: [
          ...form.values.launch.actions,
          {
            kind: "command",
            verb: "Open the folder",
            command: '["xdg-open", "{path}"]',
          },
        ],
      },
    });
  });

  it("starts with the shelf alone, offers zellij until one is added, and holds a custom card until it is written", () => {
    editor("launching", settingsFormFor(defaultConfig(), mockHome));

    expect(actionCards()).toEqual([]);
    fireEvent.click(shelfAdd("zellij tab"));
    expect(shelfAdd("zellij tab").disabled).toBe(true);
    fireEvent.click(shelfAdd("Custom command"));

    expect(cardHeads()).toEqual([
      ["zellij tab", "Open the zellij tab", "false"],
      ["Custom command", "no words yet", "true"],
    ]);
    expect(
      screen.getAllByText(/^Launch action 2, /).map((line) => line.textContent),
    ).toEqual([
      "Launch action 2, action: needs words for the bird's page",
      "Launch action 2, command: needs a command",
    ]);
    expect(saveButton().disabled).toBe(true);
  });

  it("holds the zellij action's commands, session and sessions by root on its card", () => {
    const { onSave, form } = editor("launching");
    const zellij = form.values.launch.actions[1];
    if (zellij?.kind !== "zellij") throw new Error("the mock has no zellij");
    openCard(1);

    expect(
      ["zellij command", "Terminal command", "Session"].map(
        (name) =>
          (cardAt(1).getByRole("textbox", { name }) as HTMLInputElement).value,
      ),
    ).toEqual([zellij.zellij, zellij.terminal, "home"]);
    fireEvent.click(
      cardAt(1).getByRole("button", { name: "Add session root" }),
    );
    type(
      cardAt(1).getByRole("textbox", { name: "session root 2, root" }),
      "~/work",
    );
    type(
      cardAt(1).getByRole("textbox", { name: "session root 2, session" }),
      "work",
    );
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      launch: {
        actions: form.values.launch.actions.with(1, {
          ...zellij,
          sessions: [
            { root: "~/undev", session: "undev" },
            { root: "~/work", session: "work" },
          ],
        }),
      },
    });
  });
});

describe("the settings page", () => {
  it("shows the main process's problems, and rides home on Escape and from the brand", () => {
    const onHome = vi.fn();
    render(
      <SettingsView
        form={mockSettingsForm()}
        cards={null}
        now={now}
        keyring={keyring}
        problems={[
          "The config was not changed: Wires: two wires are named Projects; each name may appear once",
        ]}
        onSave={() => {}}
        onHome={onHome}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeDefined();
    expect(
      screen.getByText(
        "The config was not changed: Wires: two wires are named Projects; each name may appear once",
      ),
    ).toBeDefined();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "perch" }));

    expect(onHome).toHaveBeenCalledTimes(2);
  });

  it("opens on Sources, switches pages from the rail, and keeps the draft across them", () => {
    const onSave = vi.fn();
    const form = mockSettingsForm();
    render(
      <SettingsView
        form={form}
        cards={null}
        now={now}
        keyring={keyring}
        problems={[]}
        onSave={onSave}
        onHome={() => {}}
      />,
    );
    const rail = within(
      screen.getByRole("navigation", { name: "Settings pages" }),
    );

    expect(
      rail.getAllByRole("button").map((button) => button.textContent),
    ).toEqual([
      "Sources",
      "Joining up",
      "Wires",
      "Judgement",
      "Scanning",
      "Launching",
    ]);
    expect(
      rail
        .getByRole("button", { name: "Sources" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.getByRole("region", { name: "Sources" })).toBeDefined();
    fireEvent.click(rail.getByRole("button", { name: "Scanning" }));

    expect(screen.queryByRole("region", { name: "Sources" })).toBeNull();
    expect(
      rail
        .getByRole("button", { name: "Scanning" })
        .getAttribute("aria-current"),
    ).toBe("page");
    type(
      group("Scanning").getByRole("spinbutton", { name: "Finalised commits" }),
      "4",
    );
    fireEvent.click(rail.getByRole("button", { name: "Wires" }));
    fireEvent.click(
      group("Wires").getByRole("button", { name: "Move wire Projects up" }),
    );
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      wires: { rows: [projects, machine], defaultRow: 0 },
      scan: { ...form.values.scan, finalisedCommits: 4 },
    });
  });

  it("says it is reading the config until the form arrives", () => {
    render(
      <SettingsView
        form={null}
        cards={null}
        now={now}
        keyring={keyring}
        problems={[]}
        onSave={() => {}}
        onHome={() => {}}
      />,
    );

    expect(screen.getByRole("status").textContent).toBe("Reading the config");
    expect(screen.queryByRole("form", { name: "Settings" })).toBeNull();
  });
});
