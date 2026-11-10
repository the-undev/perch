import "./index.css";
import "./crash.css";

const HEADING = "perch couldn't start";
const LINE =
  "The window failed while loading. The error below is from the renderer.";

/** Splits a thrown value into the headline and stack the screen shows. */
function describe(thrown: unknown): { message: string; stack: string } {
  if (thrown instanceof Error) {
    return {
      message: `${thrown.name}: ${thrown.message}`,
      stack: thrown.stack ?? "",
    };
  }
  return { message: String(thrown), stack: "" };
}

/** Draws the load-failure screen into the root with plain DOM. */
function draw(root: HTMLElement, thrown: unknown): void {
  const { message, stack } = describe(thrown);
  const screen = document.createElement("div");
  screen.className = "fault-screen";
  const fault = document.createElement("div");
  fault.className = "fault";

  const heading = document.createElement("h1");
  heading.textContent = HEADING;
  const what = document.createElement("p");
  what.className = "what";
  what.textContent = LINE;
  const messageLine = document.createElement("p");
  messageLine.className = "message";
  messageLine.textContent = message;
  const stackBlock = document.createElement("pre");
  stackBlock.textContent = stack;
  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "Reload";
  reload.addEventListener("click", () => location.reload());

  fault.append(heading, what, messageLine, stackBlock, reload);
  screen.append(fault);
  root.append(screen);
}

/** Shows the screen only while the root is empty, so a mounted app is left alone. */
function show(thrown: unknown): void {
  const root = document.getElementById("root");
  if (!root || root.hasChildNodes()) return;
  draw(root, thrown);
}

window.addEventListener("error", (event) => show(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => show(event.reason));
