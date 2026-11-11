import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FaultBoundary } from "./fault-boundary.tsx";

afterEach(cleanup);

function Thrower(): never {
  throw new TypeError("level is undefined");
}

describe("FaultBoundary", () => {
  it("draws the second heading and the message when a child throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <FaultBoundary>
        <Thrower />
      </FaultBoundary>,
    );
    expect(
      screen.getByRole("heading", {
        name: "Perch stopped drawing this window",
      }),
    ).toBeTruthy();
    expect(screen.getByText("TypeError: level is undefined")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
  });

  it("renders its children when nothing throws", () => {
    render(
      <FaultBoundary>
        <p>fine</p>
      </FaultBoundary>,
    );
    expect(screen.getByText("fine")).toBeTruthy();
  });
});
