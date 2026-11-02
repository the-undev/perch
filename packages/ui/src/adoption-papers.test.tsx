import { emptyEntryValues } from "@perch/core/entry-form.ts";
import { mockSnapshot } from "@perch/core/mock.ts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdoptionPapers } from "./adoption-papers.tsx";
import { mockBird, mockEntryForm } from "./mock-birds.ts";

afterEach(cleanup);

const now = new Date(mockSnapshot.scannedAt);

function papers(id: string, problems: string[] = []) {
  const onSign = vi.fn();
  const onReturn = vi.fn();
  const onClose = vi.fn();
  const form = mockEntryForm(id);
  render(
    <AdoptionPapers
      bird={mockBird(id)}
      form={form}
      night={false}
      now={now}
      problems={problems}
      onSign={onSign}
      onReturn={onReturn}
      onClose={onClose}
    />,
  );
  return { onSign, onReturn, onClose, form };
}

const press = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));

const checked = (role: "radio" | "checkbox", name: string | RegExp) =>
  (screen.getByRole(role, { name }) as HTMLInputElement).checked;

const openFold = () => press(/^More particulars/);

describe("the adoption papers", () => {
  it("head the sheet with the bird's name and ring, and set out what the scan found", () => {
    papers("dev/odin/hello");

    expect(
      screen.getByRole("form", { name: "Adoption papers for hello" }),
    ).toBeDefined();
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("hello");
    expect(screen.getByText("ring dev/odin/hello")).toBeDefined();
    const seen = document.querySelector('[data-part="seen"]');
    expect(seen?.textContent).toContain("found at ~/dev/odin/hello");
    expect(seen?.textContent).toMatch(/last commit .* ago · "mli for shape"/);
    expect(seen?.querySelector("input")).toBeNull();
  });

  it("say where a forge-only bird lives, with nothing found on disk", () => {
    papers("github:finch/obsidian-tidy");

    const seen = document.querySelector('[data-part="seen"]');
    expect(seen?.textContent).not.toContain("found at");
    expect(seen?.textContent).toContain(
      "lives at github.com/finch/obsidian-tidy",
    );
  });

  it("adopt with every untouched field null, onto the default wire", () => {
    const { onSign } = papers("dev/odin/hello");

    expect(checked("radio", "Projects · the default")).toBe(true);
    press("Adopt onto Projects");

    expect(onSign).toHaveBeenCalledWith(emptyEntryValues());
  });

  it("name the chosen wire on the signature button", () => {
    papers("dev/odin/hello");

    fireEvent.click(screen.getByRole("radio", { name: "Machine & Home" }));

    expect(
      screen.getByRole("button", { name: "Adopt onto Machine & Home" }),
    ).toBeDefined();
    expect(
      document
        .querySelector('[data-wire="Machine & Home"]')
        ?.getAttribute("data-chosen"),
    ).toBe("true");
  });

  it("store null when the default wire is chosen again, and what differs otherwise", () => {
    const { onSign } = papers("dev/odin/hello");

    fireEvent.click(screen.getByRole("radio", { name: "Machine & Home" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Goes by" }), {
      target: { value: "Hello" },
    });
    press("Adopt onto Machine & Home");
    expect(onSign).toHaveBeenLastCalledWith({
      ...emptyEntryValues(),
      wire: "Machine & Home",
      name: "Hello",
    });

    fireEvent.click(
      screen.getByRole("radio", { name: "Projects · the default" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Goes by" }), {
      target: { value: " " },
    });
    press("Adopt onto Projects");
    expect(onSign).toHaveBeenLastCalledWith(emptyEntryValues());
  });

  it("hold no tier row and no expectations row: what you say is the wire and the name", () => {
    papers("dev/odin/hello");

    expect(screen.queryByText("How much it matters")).toBeNull();
    expect(screen.queryByText(/tier|size/)).toBeNull();
    expect(screen.queryByText("What it should have")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "Machine & Home" })).toBeDefined();
    expect(
      screen.getByRole("radio", { name: "Projects · the default" }),
    ).toBeDefined();
  });

  it("name the fold's contents while closed, and open it onto key files, roadmaps, session and thresholds", () => {
    const { onSign } = papers("dev/odin/hello");
    const fold = screen.getByRole("button", {
      name: "More particulars · its windows, key files, roadmaps and session",
    });

    expect(fold.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("spinbutton")).toBeNull();
    openFold();

    expect(fold.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("spinbutton")).toHaveLength(4);
    expect(screen.getByText("The README and the roadmaps")).toBeDefined();
    expect(screen.getByText("The standard roadmap names")).toBeDefined();
    const session = screen.getByRole("textbox", { name: "Zellij session" });
    expect(session.getAttribute("placeholder")).toBe("home");
    fireEvent.change(session, { target: { value: "work" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Add a key file" }), {
      target: { value: "docs/spec.md" },
    });
    press("Add the key file");
    fireEvent.change(screen.getByRole("textbox", { name: "Add a roadmap" }), {
      target: { value: "docs/roadmap.md" },
    });
    press("Add the roadmap");
    fireEvent.change(
      screen.getByRole("spinbutton", {
        name: "Stalled flight, amber after days",
      }),
      { target: { value: "3" } },
    );
    press("Adopt onto Projects");

    expect(onSign).toHaveBeenCalledWith({
      ...emptyEntryValues(),
      keyFiles: ["docs/spec.md"],
      roadmaps: ["docs/roadmap.md"],
      thresholds: { stalled_amber_days: 3 },
      zellijSession: "work",
    });
  });

  it("hold the signature while a threshold cannot be written, and say why", () => {
    const { onSign } = papers("undev/spool");
    openFold();

    fireEvent.change(
      screen.getByRole("spinbutton", {
        name: "Stalled flight, amber after days",
      }),
      { target: { value: "40" } },
    );

    expect(
      screen.getByText("Stalled flight: amber must come before red"),
    ).toBeDefined();
    const sign = screen.getByRole("button", { name: "Amend the papers" });
    expect((sign as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(sign.closest("form") as HTMLFormElement);
    expect(onSign).not.toHaveBeenCalled();
  });

  it("amend from the entry as written, signing it unchanged when nothing is touched", () => {
    const { onSign, form } = papers("obsidian/Hothouse");

    expect(checked("radio", "Machine & Home")).toBe(true);
    expect(
      (screen.getByRole("textbox", { name: "Goes by" }) as HTMLInputElement)
        .value,
    ).toBe("Hothouse Vault");
    expect(screen.queryByRole("button", { name: /^Adopt onto/ })).toBeNull();
    press("Amend the papers");

    expect(onSign).toHaveBeenCalledWith(form.values);
  });

  it("return to the fence only on the second press, which says every line is struck out", () => {
    const { onReturn, onSign } = papers("dev/perch");

    press("Return to the fence");
    expect(onReturn).not.toHaveBeenCalled();
    expect(
      screen.getByText("Every line of these papers is struck out."),
    ).toBeDefined();
    press("Keep the papers");
    expect(
      screen.queryByText("Every line of these papers is struck out."),
    ).toBeNull();

    press("Return to the fence");
    press("Return it to the fence");
    expect(onReturn).toHaveBeenCalledTimes(1);
    expect(onSign).not.toHaveBeenCalled();
  });

  it("offer no return to the fence while adopting", () => {
    papers("dev/odin/hello");

    expect(
      screen.queryByRole("button", { name: "Return to the fence" }),
    ).toBeNull();
  });

  it("show a refused write above the signature", () => {
    papers("dev/perch", ["The config was not changed: the disk is read-only"]);

    expect(screen.getByRole("alert").textContent).toBe(
      "The config was not changed: the disk is read-only",
    );
  });

  it("fold away on Not now or Escape without signing, before the camera hears the key", () => {
    const { onClose, onSign } = papers("dev/odin/hello");
    const heard = vi.fn();
    window.addEventListener("keydown", heard);

    press("Not now");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Goes by" }), {
      key: "Escape",
    });
    window.removeEventListener("keydown", heard);

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(heard).not.toHaveBeenCalled();
    expect(onSign).not.toHaveBeenCalled();
  });
});
