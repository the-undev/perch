import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StringList } from "./form-parts.tsx";

afterEach(cleanup);

/** The classes of the element named, as a list. */
const classesOf = (element: HTMLElement) => [...element.classList];

describe("the string list", () => {
  it("ends the add input flush with the value inputs, its button in the gutter", () => {
    render(
      <StringList
        noun="host"
        placeholder="github.com"
        values={["github.com", "github-work"]}
        onChange={vi.fn()}
      />,
    );
    const addLine = screen.getByRole("textbox", { name: "Add a host" })
      .parentElement as HTMLElement;
    const valueRow = screen.getByRole("textbox", { name: "host 1" })
      .parentElement as HTMLElement;
    const gutter = (button: HTMLElement) =>
      classesOf(button).filter((name) => /^w-\d+$/.test(name));

    // No cap on the add line, so it spans what the value rows span.
    expect(classesOf(addLine).some((name) => name.startsWith("max-w"))).toBe(
      false,
    );
    expect(classesOf(addLine)).toContain("w-full");
    // The add input fills its line like a value input, and the two buttons take one width.
    expect(
      classesOf(screen.getByRole("textbox", { name: "Add a host" })),
    ).toContain("w-full");
    expect(
      gutter(screen.getByRole("button", { name: "Add the host" })),
    ).toEqual(
      gutter(screen.getByRole("button", { name: "Remove host github.com" })),
    );
    expect(
      gutter(screen.getByRole("button", { name: "Add the host" })),
    ).toHaveLength(1);
    expect(classesOf(valueRow)).toContain("gap-1");
    expect(classesOf(addLine)).toContain("gap-1");
  });
});
