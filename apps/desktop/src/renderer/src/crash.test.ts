import { afterEach, beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await import("./crash.ts");
});

afterEach(() => {
  document.body.innerHTML = "";
});

function fireError(error: Error): void {
  window.dispatchEvent(
    new ErrorEvent("error", { error, message: error.message }),
  );
}

describe("crash screen", () => {
  it("draws the heading, message, stack and Reload when the root is empty", () => {
    document.body.innerHTML = '<div id="root"></div>';
    fireError(new ReferenceError("process is not defined"));
    const root = document.getElementById("root") as HTMLElement;
    expect(root.querySelector("h1")?.textContent).toBe("perch couldn't start");
    expect(root.querySelector(".message")?.textContent).toBe(
      "ReferenceError: process is not defined",
    );
    expect(root.querySelector("pre")?.textContent).toContain(
      "process is not defined",
    );
    expect(root.querySelector("button")?.textContent).toBe("Reload");
  });

  it("leaves a root that already has content alone", () => {
    document.body.innerHTML = '<div id="root"><p>app</p></div>';
    fireError(new Error("later"));
    expect(document.getElementById("root")?.innerHTML).toBe("<p>app</p>");
  });
});
