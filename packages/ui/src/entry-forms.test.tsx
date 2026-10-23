import type { EntryValues } from "@perch/core/entry-form.ts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdoptForm, EntryEditor } from "./entry-forms.tsx";
import { mockEntryForm } from "./mock-birds.ts";

afterEach(cleanup);

function adoptForm() {
  const onAdopt = vi.fn();
  const onCancel = vi.fn();
  const form = mockEntryForm("dev/odin/hello");
  render(
    <AdoptForm
      entryKey="dev/odin/hello"
      scannedName={form.scannedName}
      wires={form.options.wires}
      defaultWire={form.options.defaultWire}
      onAdopt={onAdopt}
      onCancel={onCancel}
    />,
  );
  return { onAdopt, onCancel };
}

function editor(id: string, change: Partial<EntryValues> = {}) {
  const onSave = vi.fn();
  const onUnadopt = vi.fn();
  const onCancel = vi.fn();
  const form = mockEntryForm(id);
  if (form.values === null) throw new Error(`${id} has no entry`);
  render(
    <EntryEditor
      entryKey={form.key ?? id}
      scannedName={form.scannedName}
      values={{ ...form.values, ...change }}
      options={form.options}
      onSave={onSave}
      onUnadopt={onUnadopt}
      onCancel={onCancel}
    />,
  );
  return { onSave, onUnadopt, onCancel, values: form.values };
}

const save = () =>
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

describe("the adopt form", () => {
  it("starts on the default wire with the scanned name, and adopts with nothing set", () => {
    const { onAdopt } = adoptForm();

    expect(
      (screen.getByRole("radio", { name: "Projects" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      screen.getByRole("textbox", { name: "Name" }).getAttribute("placeholder"),
    ).toBe("hello");
    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));

    expect(onAdopt).toHaveBeenCalledWith({ wire: null, name: null });
  });

  it("adopts onto the wire picked, under the name given", () => {
    const { onAdopt } = adoptForm();

    fireEvent.click(screen.getByRole("radio", { name: "Machine & Home" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Hello Odin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adopt" }));

    expect(onAdopt).toHaveBeenCalledWith({
      wire: "Machine & Home",
      name: "Hello Odin",
    });
  });

  it("names the key the entry is written under, and cancels", () => {
    const { onAdopt, onCancel } = adoptForm();

    expect(screen.getByText('[items."dev/odin/hello"]')).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onAdopt).not.toHaveBeenCalled();
  });
});

describe("the entry editor", () => {
  it("saves the entry unchanged when nothing is touched", () => {
    const { onSave, values } = editor("dev/perch");

    save();

    expect(onSave).toHaveBeenCalledWith(values);
  });

  it("edits the wire, name, importance and expectations, the default choice setting null", () => {
    const { onSave, values } = editor("obsidian/Hothouse");

    fireEvent.click(screen.getByRole("radio", { name: "Projects" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "server" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Tickets" }));
    save();

    expect(onSave).toHaveBeenCalledWith({
      ...values,
      wire: null,
      name: null,
      importance: "server",
      expect: ["tickets"],
    });
  });

  it("edits key files and roadmaps as lists of paths, back to the defaults or to none", () => {
    const { onSave, values } = editor("dev/perch");

    fireEvent.click(
      screen.getByRole("button", { name: "Remove key file docs/spec.md" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Add a key file" }), {
      target: { value: "docs/build-log.md" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add the key file" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Add a roadmap" }), {
      target: { value: "docs/roadmap.md" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Add a roadmap" }), {
      key: "Enter",
    });
    save();

    expect(onSave).toHaveBeenLastCalledWith({
      ...values,
      keyFiles: ["README.md", "docs/roadmap.md", "docs/build-log.md"],
      roadmaps: ["docs/roadmap.md"],
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Remove roadmap docs/roadmap.md" }),
    );
    expect(screen.getByText("None")).toBeDefined();
    fireEvent.click(
      screen.getByRole("button", { name: "Use the default key files" }),
    );
    save();

    expect(onSave).toHaveBeenLastCalledWith({
      ...values,
      keyFiles: null,
      roadmaps: [],
    });
  });

  it("sets threshold overrides over the global defaults, and clears them back", () => {
    const { onSave, values } = editor("undev/spool", {
      thresholds: { unsafe_amber_hours: 12, unsafe_red_hours: 48 },
    });
    const stalledAmber = screen.getByRole("spinbutton", {
      name: "Stalled flight, amber after days",
    });

    expect(stalledAmber.getAttribute("placeholder")).toBe("7");
    fireEvent.change(stalledAmber, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear Unsafe work" }));
    save();

    expect(onSave).toHaveBeenCalledWith({
      ...values,
      thresholds: { stalled_amber_days: 3 },
    });
  });

  it("holds Save while the thresholds cannot be written, and says why", () => {
    const { onSave } = editor("undev/spool");

    fireEvent.change(
      screen.getByRole("spinbutton", {
        name: "Stalled flight, amber after days",
      }),
      { target: { value: "40" } },
    );

    expect(
      screen.getByText("Stalled flight: amber must come before red"),
    ).toBeDefined();
    expect(
      (screen.getByRole("button", { name: "Save" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    save();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("unadopts only after a second press", () => {
    const { onUnadopt } = editor("undev/spool");

    fireEvent.click(screen.getByRole("button", { name: "Unadopt" }));
    expect(onUnadopt).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Return to the fence" }),
    );

    expect(onUnadopt).toHaveBeenCalledTimes(1);
  });
});
