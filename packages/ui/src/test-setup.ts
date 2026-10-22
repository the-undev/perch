// What jsdom lacks and the composed views use: element resizing, media queries and the Web
// Animations API. Each stands still: nothing resizes, no motion is asked to reduce, and no
// animation ever finishes, so a test sees its first frame.

class StillResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = StillResizeObserver;

window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

Element.prototype.animate = function animate() {
  return {
    finished: new Promise(() => {}),
    cancel: () => {},
  } as unknown as Animation;
};
