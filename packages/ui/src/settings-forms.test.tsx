import { defaultConfig } from "@perch/core/config-default.ts";
import {
  mockAviary,
  mockConfig,
  mockImage,
  mockLogin,
  mockUpdates,
} from "@perch/core/mock.ts";
import {
  type SettingsForm,
  settingsFormFor,
  sourceRunHeld,
} from "@perch/core/settings-form.ts";
import type { KeyringCalls } from "@perch/core/sources-form.ts";
import type { UpdateState } from "@perch/core/update.ts";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockHome, mockSettingsForm } from "./mock-birds.ts";
import {
  SettingsEditor,
  type SettingsPageName,
  type UpdateCalls,
} from "./settings-forms.tsx";
import { SettingsView, type SettingsViewProps } from "./settings-view.tsx";
import { skyPhase } from "./sky.ts";

afterEach(cleanup);

const now = new Date("2026-10-22T09:04:00.000Z");

/** Keyring calls these tests never make. */
const keyring: KeyringCalls = {
  storeToken: async () => ({ ok: true }),
  testSource: async () => ({ ok: true, count: 0 }),
};

/** Update calls as spies. */
const updateSpies = (): UpdateCalls => ({
  onCheck: vi.fn(),
  onInstall: vi.fn(),
  onRestart: vi.fn(),
});

/** The editor on one page, with no scan records. */
const editorOn = (
  page: SettingsPageName,
  form: SettingsForm,
  onSave: () => void,
  update: UpdateState = mockUpdates.upToDate,
  updateCalls: UpdateCalls = updateSpies(),
) => (
  <SettingsEditor
    form={form}
    page={page}
    cards={null}
    now={now}
    keyring={keyring}
    unfold={null}
    update={update}
    updateCalls={updateCalls}
    onSave={onSave}
  />
);

function editor(page: SettingsPageName, form = mockSettingsForm()) {
  const onSave = vi.fn();
  const view = render(editorOn(page, form, onSave));
  return { onSave, form, view };
}

/** The settings page with the rail's page held as the app's URL holds it, the mock up to date. */
function Railed(
  props: Omit<SettingsViewProps, "page" | "onPage" | "update" | "updateCalls">,
) {
  const [page, setPage] = useState<SettingsPageName>("sources");
  return (
    <SettingsView
      {...props}
      page={page}
      onPage={setPage}
      update={mockUpdates.upToDate}
      updateCalls={updateSpies()}
    />
  );
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
      wires.getByText("4 birds name this wire; they move to Projects."),
    ).toBeDefined();
    expect(remove().getAttribute("aria-describedby")).not.toBeNull();
    expect(saveButton().disabled).toBe(true);

    fireEvent.click(remove());
    expect(
      wires.queryByRole("button", { name: "Remove wire Machine & Home" }),
    ).toBeNull();
    expect(
      wires.getByText(
        ".dotfiles, obsidian/Hothouse, obsidian/Pocket and forgejo:finch/field-notes sit on Machine & Home, which is removed: saving moves them to the default wire, Projects.",
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
      wires.getByText("4 birds name this wire; they move to Projects."),
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

  it("puts the unit word beside each threshold field", () => {
    editor("judgement");
    const thresholds = group("Judgement");

    expect(thresholds.getAllByText("hours")).toHaveLength(2);
    expect(thresholds.getAllByText("days")).toHaveLength(2);
  });

  it("says what each window counts and what the defaults are", () => {
    editor("judgement");
    const thresholds = group("Judgement");

    expect(
      thresholds.getByText(
        "Hours since the oldest uncommitted change or unpushed commit; the defaults are 24 and 72.",
      ),
    ).toBeDefined();
    expect(
      thresholds.getByText(
        "Days a non-default branch has sat without a commit, even with everything pushed; the defaults are 7 and 30.",
      ),
    ).toBeDefined();
  });

  it("shows the defaults word at the defaults and a clear button once edited, clear restoring them", () => {
    editor(
      "judgement",
      settingsFormFor(defaultConfig(), mockHome, mockLogin, mockImage),
    );
    const thresholds = group("Judgement");
    const amber = () =>
      thresholds.getByRole("spinbutton", {
        name: "Unsafe work, amber after hours",
      }) as HTMLInputElement;

    expect(thresholds.getAllByText("the defaults")).toHaveLength(2);
    expect(
      thresholds.queryByRole("button", { name: "Clear Unsafe work" }),
    ).toBeNull();

    type(amber(), "12");

    expect(thresholds.getAllByText("the defaults")).toHaveLength(1);
    fireEvent.click(
      thresholds.getByRole("button", { name: "Clear Unsafe work" }),
    );

    expect(amber().value).toBe("24");
    expect(thresholds.getAllByText("the defaults")).toHaveLength(2);
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
  within(screen.getByRole("list", { name: "Kinds of action" })).getByRole(
    "button",
    {
      name: `Add ${name}`,
    },
  ) as HTMLButtonElement;

/** A text field's value and the default it shows in grey. */
const shownIn = (index: number, name: string) => {
  const field = cardAt(index).getByRole("textbox", {
    name,
  }) as HTMLInputElement;
  return [field.value, field.placeholder];
};

describe("the Launching page", () => {
  it("shows one closed card per action in config order, each its kind's name and verb", () => {
    editor("launching");

    expect(cardHeads()).toEqual([
      ["Obsidian", "Open in Obsidian", "false"],
      ["zellij tab", "Open the zellij tab", "false"],
      ["VS Code", "Open in VS Code", "false"],
      ["Folder", "Open the folder", "false"],
      ["nvim", "Open in nvim", "false"],
      ["Custom command", "Follow the log", "false"],
    ]);
  });

  it("shows a kind's defaults in grey until typed over, and refuses a command not in list form on the card in red and beside Save", () => {
    const { onSave, form } = editor("launching");
    openCard(2);

    expect(shownIn(2, "Action")).toEqual(["", "Open in VS Code"]);
    expect(shownIn(2, "Command")).toEqual(["", '["code", "{path}"]']);
    expect(
      cardAt(2).getByText(
        "Offered on every bird with a folder on this machine.",
      ),
    ).toBeDefined();
    const command = cardAt(2).getByRole("textbox", { name: "Command" });
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
    expect(cardHeads()[2]).toEqual(["VS Code", "Code it", "true"]);
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      launch: {
        actions: form.values.launch.actions.with(2, {
          kind: "vscode",
          verb: "Code it",
          command: '["code", "--title", "my \\"project\\"", "{path}"]',
        }),
      },
    });
  });

  it("refuses a custom command without words, and a placeholder the kind may not use", () => {
    editor("launching");
    openCard(0);
    openCard(5);

    expect(
      cardAt(0).getByText("Offered on Obsidian birds only."),
    ).toBeDefined();
    type(cardAt(5).getByRole("textbox", { name: "Action" }), "");
    type(
      cardAt(5).getByRole("textbox", { name: "Command" }),
      '["code", "{worktree}"]',
    );

    expect(cardHeads()[5]).toEqual(["Custom command", "no words yet", "true"]);
    expect(
      cardAt(5).getByText("needs words for the bird's page"),
    ).toBeDefined();
    expect(
      cardAt(5).getByText(
        "has no placeholder {worktree}; it may use {path} and {obsidian}",
      ),
    ).toBeDefined();
    expect(saveButton().disabled).toBe(true);
  });

  it("picks a custom command's icon from the row of line icons, which only custom cards hold", () => {
    const { onSave, form } = editor("launching");
    const custom = form.values.launch.actions[5];
    if (custom?.kind !== "command") throw new Error("the mock has no custom");
    openCard(2);
    openCard(5);
    const icons = cardAt(5).getAllByRole("radio") as HTMLInputElement[];

    expect(cardAt(2).queryAllByRole("radio")).toEqual([]);
    expect(
      icons.map((icon) => [icon.getAttribute("aria-label"), icon.checked]),
    ).toEqual([
      ["terminal", true],
      ["code", false],
      ["folder", false],
      ["forge", false],
      ["obsidian", false],
      ["adopt", false],
      ["edit", false],
    ]);
    fireEvent.click(cardAt(5).getByRole("radio", { name: "edit" }));
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      launch: {
        actions: form.values.launch.actions.with(5, {
          ...custom,
          icon: "edit",
        }),
      },
    });
  });

  it("orders the cards with the arrows and removes one, saving them in that order", () => {
    const { onSave, form } = editor("launching");
    const [obsidian, zellij, vscode, , nvim, custom] =
      form.values.launch.actions;

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
      cardAt(4).getByRole("button", { name: /later on the bird$/ }),
    ).toHaveProperty("disabled", true);
    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      launch: { actions: [obsidian, vscode, zellij, nvim, custom] },
    });
  });

  it("adds a kind's card at the end, holding just its kind and open alone, and holds zellij back while one exists", () => {
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
      "false",
      "false",
      "true",
    ]);
    expect(shownIn(6, "Command")).toEqual(["", '["xdg-open", "{path}"]']);
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      launch: {
        actions: [
          ...form.values.launch.actions,
          { kind: "folder", verb: "", command: "" },
        ],
      },
    });
  });

  it("starts with the shelf alone, offers zellij until one is added, and holds a custom card until it is written", () => {
    editor(
      "launching",
      settingsFormFor(defaultConfig(), mockHome, mockLogin, mockImage),
    );

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

  it("holds the zellij action's commands, session and sessions by root on its card, its defaults in grey", () => {
    const { onSave, form } = editor("launching");
    const zellij = form.values.launch.actions[1];
    if (zellij?.kind !== "zellij") throw new Error("the mock has no zellij");
    openCard(1);

    expect(
      ["zellij command", "Terminal command", "Session"].map((name) =>
        shownIn(1, name),
      ),
    ).toEqual([
      ["", '["zellij"]'],
      [
        '["alacritty", "-e", "zellij", "attach", "-c", "{session}"]',
        '["alacritty", "--working-directory", "{cwd}", "-e", "zellij", "attach", "-c", "{session}"]',
      ],
      ["home", "main"],
    ]);
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

describe("the Window page", () => {
  /** The mock's settings with an autostart entry running an older image. */
  const loginOn = () =>
    settingsFormFor(
      mockConfig,
      mockHome,
      {
        ...mockLogin,
        on: true,
        target: `${mockHome}/Applications/perch-0.1.0-x86_64.AppImage`,
      },
      mockImage,
    );

  /** The mock's settings run from source, no entry written. */
  const fromSource = () =>
    settingsFormFor(
      mockConfig,
      mockHome,
      {
        ...mockLogin,
        held: sourceRunHeld,
      },
      null,
    );

  const page = () => group("Window");
  const toggle = (name: string) =>
    page().getByRole("switch", { name }) as HTMLButtonElement;

  it("says what each row's state does, the login row following the tray switch", () => {
    editor("window");

    expect(toggle("Stay in the tray").getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(toggle("Start at login").getAttribute("aria-checked")).toBe("false");
    expect(
      page().getByText(
        "Closing the window hides it. The tray icon shows it, rescans and quits; clicking the icon toggles the window.",
      ),
    ).toBeDefined();
    expect(
      page().getByText(
        "Off. Turned on, Perch starts when you log in, hidden in the tray.",
      ),
    ).toBeDefined();

    fireEvent.click(toggle("Stay in the tray"));

    expect(
      page().getByText("Off. No tray icon; closing the window quits Perch."),
    ).toBeDefined();
    expect(
      page().getByText(
        "Off. Turned on, Perch starts when you log in, with the window open.",
      ),
    ).toBeDefined();
  });

  it("names the entry and the image it runs beneath a login row that is on", () => {
    editor("window", loginOn());

    expect(
      page().getByText("Perch starts when you log in, hidden in the tray."),
    ).toBeDefined();
    expect(
      page().getByText(
        "~/.config/autostart/perch.desktop → ~/Applications/perch-0.1.0-x86_64.AppImage",
      ),
    ).toBeDefined();

    fireEvent.click(toggle("Stay in the tray"));

    expect(
      page().getByText("Perch starts when you log in, with the window open."),
    ).toBeDefined();
    fireEvent.click(toggle("Start at login"));
    expect(page().queryByText(/→/)).toBeNull();
  });

  it("marks the form edited when a switch is toggled, and saves both values", () => {
    const { onSave, form } = editor("window");

    expect(saveButton().disabled).toBe(true);
    fireEvent.click(toggle("Start at login"));
    expect(screen.getByText("Unsaved changes")).toBeDefined();
    fireEvent.click(toggle("Stay in the tray"));
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      ...form.values,
      window: { tray: false, login: true },
    });
  });

  it("holds the login switch from source, saying why in amber, the tray switch still editable", () => {
    editor("window", fromSource());
    const login = toggle("Start at login");

    expect(login.getAttribute("aria-disabled")).toBe("true");
    expect(
      page().getByText(
        "Held: Perch is running from source, so there is no AppImage to point the login entry at.",
      ).className,
    ).toContain("text-amber");
    fireEvent.click(login);
    expect(login.getAttribute("aria-checked")).toBe("false");
    expect(saveButton().disabled).toBe(true);

    fireEvent.click(toggle("Stay in the tray"));
    expect(toggle("Stay in the tray").getAttribute("aria-checked")).toBe(
      "false",
    );
    expect(saveButton().disabled).toBe(false);
  });
});

describe("the Updates page", () => {
  const page = () => group("Updates");
  const toggle = (name: string) =>
    page().getByRole("switch", { name }) as HTMLButtonElement;

  /** The editor on the Updates page in an update state, with the calls it makes. */
  function updates(
    update: UpdateState,
    form: SettingsForm = mockSettingsForm(),
  ) {
    const onSave = vi.fn();
    const calls = updateSpies();
    render(editorOn("updates", form, onSave, update, calls));
    return { onSave, calls, form };
  }

  const status = () => page().getByRole("status");
  const slot = (name: string) =>
    page().getByRole("button", { name }) as HTMLButtonElement;
  const releasesLink = () =>
    page().getByRole("link", { name: "github.com/the-undev/perch/releases" });

  it("sits last on the rail's pages, writing [update]", () => {
    updates(mockUpdates.upToDate);

    expect(page().getByText("[update]")).toBeDefined();
    expect(
      page().getByText(
        "How Perch learns of new releases, and whether it installs them.",
      ),
    ).toBeDefined();
  });

  it("says the running version is the latest, links the releases page, and checks now quietly", () => {
    const { calls } = updates(mockUpdates.upToDate);

    expect(status().textContent).toBe(
      "Running 0.2.0, the latest release. Checked 8 minutes ago.",
    );
    expect(releasesLink().getAttribute("href")).toBe(
      "https://github.com/the-undev/perch/releases",
    );
    expect(slot("Check now").className).toContain("border-edge");
    fireEvent.click(slot("Check now"));
    expect(calls.onCheck).toHaveBeenCalledOnce();
  });

  it("says no check has run yet, and that checking is off when it is", () => {
    updates(mockUpdates.noCheck);
    expect(status().textContent).toBe("Running 0.2.0. No check yet.");
    cleanup();

    updates(mockUpdates.checkOff);
    expect(status().textContent).toBe(
      "Running 0.2.0. Checking is off; press to check once.",
    );
    expect(slot("Check now").disabled).toBe(false);
  });

  it("quiets the button while a check runs", () => {
    updates(mockUpdates.checking);

    expect(status().textContent).toBe("Checking…");
    expect(slot("Check now").disabled).toBe(true);
  });

  it("opens the release's page in the browser with install off, as the primary action", () => {
    updates(mockUpdates.found);

    expect(status().textContent).toBe(
      "0.3.0 is out. This is 0.2.0. Checked 16 minutes ago.",
    );
    const open = page().getByRole("link", { name: "Open the releases page" });
    expect(open.getAttribute("href")).toBe(
      "https://github.com/the-undev/perch/releases/tag/v0.3.0",
    );
    expect(open.getAttribute("target")).toBe("_blank");
    expect(open.className).toContain("bg-paper");
    expect(page().queryByRole("button", { name: "Check now" })).toBeNull();
  });

  it("offers the install with install on, and holds it with the bar while downloading", () => {
    const { calls } = updates(mockUpdates.foundInstall);
    fireEvent.click(slot("Install 0.3.0"));
    expect(calls.onInstall).toHaveBeenCalledOnce();
    cleanup();

    updates(mockUpdates.downloading);
    expect(status().textContent).toBe("Downloading 0.3.0: 41 of 89 MB.");
    expect(
      page()
        .getByRole("progressbar", { name: "Download" })
        .getAttribute("aria-valuenow"),
    ).toBe("46");
    expect(slot("Install 0.3.0").disabled).toBe(true);
    expect(page().queryByRole("link", { name: /releases/ })).toBeNull();
  });

  it("offers the restart once downloaded, saying when the image is replaced", () => {
    const { calls } = updates(mockUpdates.ready);

    expect(status().textContent).toBe(
      "0.3.0 is downloaded. It runs from the next start.",
    );
    expect(
      page().getByText(
        "The image at ~/AppImages/perch.appimage is replaced when Perch quits.",
      ),
    ).toBeDefined();
    fireEvent.click(slot("Restart now"));
    expect(calls.onRestart).toHaveBeenCalledOnce();
  });

  it("puts a failed download or check in amber, the last answer above and the button returned", () => {
    updates(mockUpdates.downloadFailed);
    expect(
      page().getByText("The download failed: the connection was reset.")
        .className,
    ).toContain("text-amber");
    expect(slot("Install 0.3.0").disabled).toBe(false);
    cleanup();

    updates(mockUpdates.checkFailed);
    expect(status().textContent).toBe(
      "Running 0.2.0. Last known: 0.3.0 is out.",
    );
    expect(
      page().getByText("The check failed: api.github.com did not answer.")
        .className,
    ).toContain("text-amber");
  });

  it("says what each switch does, and saves both, the image named beneath install", () => {
    const { onSave, form } = updates(mockUpdates.upToDate);

    expect(toggle("Check for updates").getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(toggle("Install updates").getAttribute("aria-checked")).toBe(
      "false",
    );
    expect(
      page().getByText(
        "Each scan, at most hourly, Perch reads the latest release from GitHub and says here and in the tray when it is newer.",
      ),
    ).toBeDefined();
    expect(page().getByText("~/AppImages/perch.appimage")).toBeDefined();
    expect(saveButton().disabled).toBe(true);

    fireEvent.click(toggle("Check for updates"));
    fireEvent.click(toggle("Install updates"));

    expect(
      page().getByText(
        "Off. Perch never calls GitHub by itself. Check now, above, still does.",
      ),
    ).toBeDefined();
    expect(
      page().getByText(
        "A newer release, however learned of, is downloaded and the image replaced in place. The new version runs from the next start.",
      ),
    ).toBeDefined();
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      ...form.values,
      update: { check: false, install: true },
    });
  });

  it("holds the install switch from source, saying why in amber, the check switch still editable", () => {
    updates(
      mockUpdates.sourceRun,
      settingsFormFor(mockConfig, mockHome, mockLogin, null),
    );
    const install = toggle("Install updates");

    expect(install.getAttribute("aria-disabled")).toBe("true");
    expect(
      page().getByText("Held: run from source there is no image to replace.")
        .className,
    ).toContain("text-amber");
    expect(
      page().getByText("Off. A newer release is only pointed at."),
    ).toBeDefined();
    fireEvent.click(install);
    expect(install.getAttribute("aria-checked")).toBe("false");
    expect(saveButton().disabled).toBe(true);

    fireEvent.click(toggle("Check for updates"));
    expect(saveButton().disabled).toBe(false);
    expect(status().textContent).toBe("Running 0.3.0-dev. No check yet.");
  });
});

describe("the settings page", () => {
  it("shows the main process's problems, and rides home on Escape and from the brand", () => {
    const onHome = vi.fn();
    render(
      <Railed
        form={mockSettingsForm()}
        cards={null}
        now={now}
        aviary={mockAviary}
        scanning={false}
        onRescan={() => {}}
        onOpenConfig={() => {}}
        keyring={keyring}
        problems={[
          "The config was not changed: Wires: two wires are named Projects; each name may appear once",
        ]}
        unfold={null}
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
    fireEvent.click(screen.getByRole("button", { name: "Perch" }));

    expect(onHome).toHaveBeenCalledTimes(2);
  });

  it("opens on Sources, switches pages from the rail, and keeps the draft across them", () => {
    const onSave = vi.fn();
    const form = mockSettingsForm();
    render(
      <Railed
        form={form}
        cards={null}
        now={now}
        aviary={mockAviary}
        scanning={false}
        onRescan={() => {}}
        onOpenConfig={() => {}}
        keyring={keyring}
        problems={[]}
        unfold={null}
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
      "Window",
      "Updates",
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

  it("carries the camera's scan line in its header, and scans again when it is pressed", () => {
    const onRescan = vi.fn();
    render(
      <Railed
        form={mockSettingsForm()}
        cards={null}
        now={now}
        aviary={mockAviary}
        scanning={false}
        onRescan={onRescan}
        onOpenConfig={() => {}}
        keyring={keyring}
        problems={[]}
        unfold={null}
        onSave={() => {}}
        onHome={() => {}}
      />,
    );

    const line = screen.getByTitle("Scan now");
    expect(line.textContent).toMatch(
      new RegExp(`^${skyPhase(now)}, scanned \\d\\d:\\d\\d, 4 min ago$`),
    );
    expect(screen.getByText("couldn't read 1 source")).toBeDefined();
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(line);

    expect(onRescan).toHaveBeenCalledTimes(1);
  });

  it("says quietly in its header while a scan runs, and waits for it", () => {
    const onRescan = vi.fn();
    render(
      <Railed
        form={mockSettingsForm()}
        cards={null}
        now={now}
        aviary={mockAviary}
        scanning
        onRescan={onRescan}
        onOpenConfig={() => {}}
        keyring={keyring}
        problems={[]}
        unfold={null}
        onSave={() => {}}
        onHome={() => {}}
      />,
    );

    expect(screen.getByRole("status").textContent).toBe("scanning");
    fireEvent.click(screen.getByTitle("Scan now"));

    expect(onRescan).not.toHaveBeenCalled();
  });

  it("says in its header that no scan has finished before the first one does", () => {
    render(
      <Railed
        form={mockSettingsForm()}
        cards={null}
        now={now}
        aviary={null}
        scanning={false}
        onRescan={() => {}}
        onOpenConfig={() => {}}
        keyring={keyring}
        problems={[]}
        unfold={null}
        onSave={() => {}}
        onHome={() => {}}
      />,
    );

    expect(screen.getByTitle("Scan now").textContent).toBe(
      `${skyPhase(now)}, no scan yet`,
    );
    expect(screen.queryByText(/couldn't read/)).toBeNull();
  });

  it("opens the config file from the path in its header", () => {
    const onOpenConfig = vi.fn();
    render(
      <Railed
        form={mockSettingsForm()}
        cards={null}
        now={now}
        aviary={mockAviary}
        scanning={false}
        onRescan={() => {}}
        onOpenConfig={onOpenConfig}
        keyring={keyring}
        problems={[]}
        unfold={null}
        onSave={() => {}}
        onHome={() => {}}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "~/.config/perch/config.toml" }),
    );

    expect(onOpenConfig).toHaveBeenCalledTimes(1);
  });

  it("says it is reading the config until the form arrives", () => {
    render(
      <Railed
        form={null}
        cards={null}
        now={now}
        aviary={mockAviary}
        scanning={false}
        onRescan={() => {}}
        onOpenConfig={() => {}}
        keyring={keyring}
        problems={[]}
        unfold={null}
        onSave={() => {}}
        onHome={() => {}}
      />,
    );

    expect(screen.getByRole("status").textContent).toBe("Reading the config");
    expect(screen.queryByRole("form", { name: "Settings" })).toBeNull();
  });
});
