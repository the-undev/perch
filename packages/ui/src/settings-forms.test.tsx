import type { SettingsForm } from "@perch/core/settings-form.ts";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSettingsForm } from "./mock-birds.ts";
import { SettingsEditor } from "./settings-forms.tsx";
import { SettingsView } from "./settings-view.tsx";

afterEach(cleanup);

function editor(form: SettingsForm = mockSettingsForm()) {
  const onSave = vi.fn();
  const view = render(<SettingsEditor form={form} onSave={onSave} />);
  return { onSave, form, view };
}

const group = (name: string) => within(screen.getByRole("region", { name }));

const saveButton = () =>
  screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

const type = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } });

describe("the settings editor", () => {
  it("holds Save until something changes, and discards back to the file's values", () => {
    const { onSave } = editor();

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
    const { onSave, form } = editor();
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
        names: ["Projects", "Machine & Home", "Someday"],
        default: "Someday",
      },
    });
  });

  it("keeps the default with a wire renamed in place, and says a wire needs a name", () => {
    const { onSave, form } = editor();
    const wires = group("Wires");

    type(wires.getByRole("textbox", { name: "wire 2" }), "Work");
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenLastCalledWith({
      ...form.values,
      wires: { names: ["Machine & Home", "Work"], default: "Work" },
    });

    type(wires.getByRole("textbox", { name: "wire 1" }), " ");
    expect(screen.getByText("Wires: every wire needs a name")).toBeDefined();
  });

  it("warns that removing a wire entries name moves them to the default, and still saves", () => {
    const { onSave } = editor();
    const wires = group("Wires");

    fireEvent.click(
      wires.getByRole("button", { name: "Remove wire Machine & Home" }),
    );

    expect(
      wires.getByText(
        ".dotfiles, obsidian/Hothouse and obsidian/Pocket sit on Machine & Home, which is removed: saving moves them to the default wire, Projects.",
      ),
    ).toBeDefined();
    expect(saveButton().disabled).toBe(false);
    fireEvent.click(saveButton());
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("says a default wire must be one of the wires", () => {
    editor();

    fireEvent.click(
      group("Wires").getByRole("button", { name: "Remove wire Projects" }),
    );

    expect(
      screen.getByText("Wires: the default wire must be one of the wires"),
    ).toBeDefined();
    expect(saveButton().disabled).toBe(true);
  });

  it("holds the global thresholds to amber before red, in whole numbers", () => {
    editor();
    const thresholds = group("Thresholds");

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

  it("edits the finalised commit count in the scan group", () => {
    const { onSave, form } = editor();

    type(
      group("Scan").getByRole("spinbutton", { name: "Finalised commits" }),
      "4",
    );
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      scan: { ...form.values.scan, finalisedCommits: 4 },
    });
  });

  it("shows no source groups, which have pages of their own", () => {
    editor();

    for (const name of ["Local paths", "Forges", "Server"]) {
      expect(screen.queryByRole("region", { name })).toBeNull();
    }
  });

  it("says an interval must be whole minutes above zero", () => {
    editor();

    type(
      screen.getByRole("spinbutton", { name: "Scan interval in minutes" }),
      "0",
    );

    expect(
      screen.getByText("Scan interval: must be whole minutes above zero"),
    ).toBeDefined();
  });

  it("edits a launch command as a list line, quoting kept, and removes one emptied", () => {
    const { onSave, form } = editor();
    const launch = group("Launch");
    const vscode = launch.getByRole("textbox", { name: "VS Code command" });

    expect((vscode as HTMLInputElement).value).toBe('["code", "{path}"]');
    type(vscode, "code {path}");
    expect(
      screen.getByText(
        'Launch command vscode: must be a list in brackets of strings in double quotes, such as ["code", "{path}"]',
      ),
    ).toBeDefined();
    type(vscode, '["code", "--title", "my \\"project\\"", "{path}"]');
    type(launch.getByRole("textbox", { name: "Folder command" }), "");
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      launch: {
        ...form.values.launch,
        commands: {
          ...form.values.launch.commands,
          vscode: '["code", "--title", "my \\"project\\"", "{path}"]',
          folder: "",
        },
      },
    });
  });

  it("edits zellij sessions by root as rows", () => {
    const { onSave, form } = editor();

    fireEvent.click(
      group("Launch").getByRole("button", { name: "Add session root" }),
    );
    type(
      screen.getByRole("textbox", { name: "session root 2, root" }),
      "~/work",
    );
    type(
      screen.getByRole("textbox", { name: "session root 2, session" }),
      "work",
    );
    fireEvent.click(saveButton());

    expect(onSave).toHaveBeenCalledWith({
      ...form.values,
      launch: {
        ...form.values.launch,
        zellijSessions: [
          { root: "~/undev", session: "undev" },
          { root: "~/work", session: "work" },
        ],
      },
    });
  });

  it("adds a join as a list line and an ignored presence", () => {
    const { onSave, form } = editor();
    const presences = group("Joins and ignores");

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
    const { view } = editor(first);
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

    view.rerender(<SettingsEditor form={fromDisk(20)} onSave={() => {}} />);
    expect(interval()).toBe("20");

    type(
      screen.getByRole("spinbutton", {
        name: "Archived scan interval in hours",
      }),
      "48",
    );
    view.rerender(<SettingsEditor form={fromDisk(25)} onSave={() => {}} />);
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
    const { view } = editor(first);

    type(
      screen.getByRole("spinbutton", { name: "Scan interval in minutes" }),
      "30",
    );
    fireEvent.click(saveButton());
    view.rerender(
      <SettingsEditor
        form={{
          ...first,
          values: {
            ...first.values,
            scan: { ...first.values.scan, intervalMinutes: 30 },
          },
        }}
        onSave={() => {}}
      />,
    );

    expect(screen.queryByText(/The config file changed/)).toBeNull();
    expect(saveButton().disabled).toBe(true);
  });
});

describe("the settings page", () => {
  it("shows the main process's problems, and rides home on Escape and from the brand", () => {
    const onHome = vi.fn();
    render(
      <SettingsView
        form={mockSettingsForm()}
        problems={["The config was not changed: Wires: each wire once"]}
        onSave={() => {}}
        onHome={onHome}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeDefined();
    expect(
      screen.getByText("The config was not changed: Wires: each wire once"),
    ).toBeDefined();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "perch" }));

    expect(onHome).toHaveBeenCalledTimes(2);
  });

  it("says it is reading the config until the form arrives", () => {
    render(
      <SettingsView
        form={null}
        problems={[]}
        onSave={() => {}}
        onHome={() => {}}
      />,
    );

    expect(screen.getByRole("status").textContent).toBe("Reading the config");
    expect(screen.queryByRole("form", { name: "Settings" })).toBeNull();
  });
});
