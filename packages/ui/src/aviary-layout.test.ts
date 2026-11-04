import { mockAviary } from "@perch/core/mock.ts";
import type { Aviary, Bird, Wire } from "@perch/core/viewmodel.ts";
import { describe, expect, it } from "vitest";
import {
  type AviaryLayout,
  arrangementKey,
  arrivalOrder,
  bubbleTailDrop,
  layoutAviary,
  pixelsPerUnit,
  placeBubble,
  placedBirds,
  rowCapacity,
  rowPlaces,
  rowStep,
  rowStepFor,
  rowsFor,
  sceneHeightFor,
  staggerFor,
  toPixels,
  wholeStepBelow,
  wireRowsCap,
  wireStep,
} from "./aviary-layout.ts";
import { roomyName } from "./bird.tsx";
import { mockBird, mockBirds } from "./mock-birds.ts";
import {
  lightAt,
  minPixelsPerUnit,
  sceneWidth,
  sceneWidthFor,
  sunRadius,
} from "./scene.tsx";
import {
  alternateBelow,
  byPosition,
  columnEdgeFor,
  edgeMarginFor,
  fenceGap,
  lowerRowDrop,
  namePlace,
  placeSpacing,
  smallerBelow,
  wireGap,
  wireHeight,
} from "./wire.tsx";

const window = { width: 1400, height: 800 };

/** A wire of `count` birds, copies of the mock's with their own ids. */
function wireOf(count: number): Wire {
  const birds: Bird[] = Array.from({ length: count }, (_, position) => {
    const source = mockBirds[position % mockBirds.length] as Bird;
    return {
      ...source,
      id: `copy-${position}`,
      adopted: true,
      position,
    };
  });
  return { name: "Crowded", birds };
}

function aviaryOf(wires: Wire[]): Aviary {
  return { ...mockAviary, wires };
}

/** A fence of `count` birds, copies of the mock's fence birds with their own ids. */
function fenceOf(count: number): Aviary {
  const birds: Bird[] = Array.from({ length: count }, (_, position) => {
    const source = mockAviary.fence.birds[
      position % mockAviary.fence.birds.length
    ] as Bird;
    return { ...source, id: `fence-${position}`, position };
  });
  return { ...mockAviary, fence: { birds } };
}

/** A value to two places. */
const round = (value: number) => Math.round(value * 100) / 100;

/** The x of each bird on the named wire, one list per row. */
function acrossOf(layout: AviaryLayout, name: string): number[][] {
  return layout.rows
    .filter((row) => row.wire.name === name)
    .map((row) => row.birds.map((entry) => entry.x));
}

/** Each row's height, then each bird's perch, then the fence's height and its birds' x, to two places. */
function pinned(aviary: Aviary, size: { width: number; height: number }) {
  const layout = layoutAviary(aviary, size);
  return {
    width: layout.width,
    height: layout.height,
    rows: layout.rows.map((row) => [
      round(row.y),
      ...row.birds.map((entry) => [round(entry.x), round(entry.y)]),
    ]),
    fence: [
      round(layout.fence.y),
      ...layout.fence.birds.map((entry) => round(entry.x)),
    ],
  };
}

describe("the aviary's layout", () => {
  it("keeps the window's aspect at the scene's width within bounds", () => {
    expect(sceneHeightFor({ width: 1920, height: 1000 })).toBe(1042);
    expect(sceneHeightFor({ width: 1400, height: 800 })).toBe(889);
    expect(sceneHeightFor({ width: 3440, height: 500 })).toBe(480);
    expect(sceneHeightFor({ width: 400, height: 3000 })).toBe(3000);
  });

  it("pins a full-width window's layout", () => {
    expect(pinned(mockAviary, { width: 1920, height: 1000 })).toEqual({
      width: 2000,
      height: 1042,
      rows: [
        [208.4, [550, 210.09], [890, 213.2], [1230, 212.54], [1570, 208.09]],
        [
          448.06,
          [380, 446.78],
          [720, 451.78],
          [1060, 453],
          [1400, 450.45],
          [1740, 444.11],
        ],
        [591.86, [550, 593.55], [890, 596.66], [1230, 595.99], [1570, 591.55]],
      ],
      fence: [937.8, 855, 1060, 1265],
    });
    expect(pinned(mockAviary, { width: 3440, height: 1380 })).toEqual({
      width: 2000,
      height: 802,
      rows: [
        [180.11, [550, 181.8], [890, 184.91], [1230, 184.25], [1570, 179.8]],
        [
          364.57,
          [380, 363.29],
          [720, 368.29],
          [1060, 369.51],
          [1400, 366.96],
          [1740, 360.62],
        ],
        [475.25, [550, 476.94], [890, 480.05], [1230, 479.38], [1570, 474.94]],
      ],
      fence: [743.88, 855, 1060, 1265],
    });
  });

  it("grows a unit past one pixel in a window wider than the scene, and shrinks it down to the floor", () => {
    for (const width of [3440, 2000, 1900, 1800]) {
      const size = { width, height: 1400 };
      const layout = layoutAviary(mockAviary, size);

      expect(layout.width).toBe(sceneWidth);
      expect(pixelsPerUnit(layout, size)).toBeCloseTo(width / sceneWidth);
    }
    expect(sceneWidth * minPixelsPerUnit).toBe(1800);
  });

  it("holds a unit at the floor in a short window, down to 432 pixels tall", () => {
    for (const [size, unit] of [
      [{ width: 1100, height: 450 }, minPixelsPerUnit],
      [{ width: 3440, height: 450 }, 450 / 480],
      [{ width: 3440, height: 432 }, minPixelsPerUnit],
    ] as const) {
      const layout = layoutAviary(mockAviary, size);

      expect(pixelsPerUnit(layout, size)).toBeCloseTo(unit);
      expect(pixelsPerUnit(layout, size)).toBeGreaterThanOrEqual(
        minPixelsPerUnit - 1e-9,
      );
    }
  });

  it("holds a unit at the floor below the floor's width while the scene's units narrow", () => {
    for (const width of [1799, 1400, 900, 600, 320]) {
      const size = { width, height: 1000 };
      const layout = layoutAviary(mockAviary, size);

      expect(layout.width).toBeCloseTo(width / minPixelsPerUnit);
      expect(layout.width).toBe(sceneWidthFor(width));
      expect(pixelsPerUnit(layout, size)).toBeCloseTo(minPixelsPerUnit);
    }
  });

  it("bunches a narrow window's wire, closing its gaps and wrapping it to a second row", () => {
    const perRow = (birds: number, width: number) =>
      layoutAviary(aviaryOf([wireOf(birds)]), { width, height: 1000 }).rows.map(
        (row) => row.birds.length,
      );
    const gap = (width: number) => {
      const [first, second] =
        layoutAviary(aviaryOf([wireOf(5)]), {
          width,
          height: 1000,
        }).rows[0]?.birds ?? [];
      return (second?.x ?? 0) - (first?.x ?? 0);
    };

    expect(perRow(6, 1920)).toEqual([6]);
    expect(perRow(6, 1400)).toEqual([3, 3]);
    expect(perRow(6, 700)).toEqual([3, 3]);
    expect(perRow(9, 1920)).toEqual([5, 4]);
    expect(perRow(9, 900)).toEqual([5, 4]);
    expect(gap(1920)).toBe(wireGap);
    expect(gap(1400)).toBeLessThan(wireGap);
    const narrow = sceneWidthFor(1400);
    expect(gap(1400)).toBeCloseTo(
      (narrow - columnEdgeFor(narrow) - edgeMarginFor(narrow)) / 4,
    );
  });

  it(`keeps a crowded wire's birds apart: none within ${wholeStepBelow} units across unless a whole wire step down`, () => {
    for (const [aviary, size] of [
      [aviaryOf([wireOf(8)]), { width: 1290, height: 800 }],
      [aviaryOf([wireOf(10)]), { width: 1290, height: 800 }],
      [aviaryOf([wireOf(13)]), { width: 1100, height: 800 }],
      [aviaryOf([wireOf(13)]), { width: 1920, height: 1000 }],
      [mockAviary, { width: 1290, height: 800 }],
      [mockAviary, { width: 1400, height: 800 }],
      [mockAviary, { width: 1920, height: 1000 }],
    ] as const) {
      const layout = layoutAviary(aviary, size);
      const second = layout.rows.findIndex((row) => row.index === 1);
      const crowded = layout.rows[second];
      const step =
        ((crowded?.y ?? 0) - (layout.rows[second - 1]?.y ?? 0)) /
        rowStepFor(acrossOf(layout, crowded?.wire.name ?? ""));

      expect(second).toBeGreaterThan(0);
      for (const wire of aviary.wires) {
        const perches = layout.rows
          .filter((row) => row.wire.name === wire.name)
          .flatMap((row) => row.birds.map((entry) => ({ x: entry.x, row })));
        for (const [i, one] of perches.entries()) {
          for (const other of perches.slice(i + 1)) {
            if (Math.abs(one.x - other.x) >= wholeStepBelow) continue;
            expect(Math.abs(one.row.y - other.row.y)).toBeGreaterThanOrEqual(
              wireStep * step - 1e-9,
            );
          }
        }
      }
    }
  });

  it("spreads a one-row wire at the full gap, centred in the birds' room", () => {
    for (const [count, size, xs] of [
      [3, { width: 1100, height: 800 }, [307.78, 647.78, 987.78]],
      [4, { width: 1920, height: 1000 }, [550, 890, 1230, 1570]],
    ] as const) {
      const layout = layoutAviary(aviaryOf([wireOf(count)]), size);
      const birds = layout.rows[0]?.birds ?? [];

      expect(layout.rows).toHaveLength(1);
      expect(birds.map((entry) => Math.round(entry.x * 100) / 100)).toEqual(xs);
      expect(birds.map((entry) => entry.namePlace)).toEqual(
        birds.map(() => roomyName),
      );
    }
  });

  it("starts every wire's and the fence's birds at the column edge, at any window", () => {
    for (const width of [320, 500, 760, 1100, 1400, 1920, 3440]) {
      for (const aviary of [mockAviary, aviaryOf([wireOf(13)]), fenceOf(21)]) {
        const layout = layoutAviary(aviary, { width, height: 800 });

        for (const entry of placedBirds(layout)) {
          expect(entry.x).toBeGreaterThanOrEqual(columnEdgeFor(layout.width));
        }
      }
    }
  });

  it("never moves a bird for its wire's name or tally", () => {
    const wire = wireOf(8);
    const named = { ...wire, name: "A wire with a very long name indeed" };
    const settled = {
      ...wire,
      birds: wire.birds.map((bird) => ({ ...bird, mood: "content" as const })),
    };
    const xs = (aviary: Aviary) =>
      layoutAviary(aviary, { width: 1100, height: 800 }).rows.flatMap((row) =>
        row.birds.map((entry) => entry.x),
      );

    expect(xs(aviaryOf([named]))).toEqual(xs(aviaryOf([wire])));
    expect(xs(aviaryOf([settled]))).toEqual(xs(aviaryOf([wire])));
  });

  it("reads a crowded wire like text: blocks in its order, top row first, each left to right", () => {
    for (const [count, size, sizes] of [
      [9, { width: 1290, height: 800 }, [5, 4]],
      [7, { width: 1920, height: 1000 }, [4, 3]],
      [13, { width: 1100, height: 800 }, [7, 6]],
      [24, { width: 1920, height: 1000 }, [12, 12]],
    ] as const) {
      const wire = wireOf(count);
      const layout = layoutAviary(
        aviaryOf([{ ...wire, birds: [...wire.birds].reverse() }]),
        size,
      );

      expect(layout.rows.map((row) => row.birds.length)).toEqual(sizes);
      expect(
        layout.rows.flatMap((row) =>
          row.birds.map((entry) => entry.bird.position),
        ),
      ).toEqual(Array.from({ length: count }, (_, position) => position));
      for (const row of layout.rows) {
        const xs = row.birds.map((entry) => entry.x);
        expect(xs.slice(1).every((x, i) => x > (xs[i] ?? 0))).toBe(true);
      }
    }
  });

  it("centres each row on its own, at most the wire gap apart", () => {
    expect(rowPlaces(9, 2000).map((xs) => xs.map(round))).toEqual([
      [380, 720, 1060, 1400, 1740],
      [550, 890, 1230, 1570],
    ]);
  });

  it("keeps an uneven row centred, which already sits half a spacing across from the row above", () => {
    expect(rowPlaces(7, 2000).map((xs) => xs.map(round))).toEqual([
      [550, 890, 1230, 1570],
      [720, 1060, 1400],
    ]);
    expect(rowPlaces(7, sceneWidthFor(1290))[1]?.map(round)).toEqual([
      419.67, 759.67, 1099.67,
    ]);
  });

  it("shifts a row right by its stagger where centring would stack it on the row above", () => {
    const width = sceneWidthFor(1290);
    const [first, second] = rowPlaces(6, width);

    expect(staggerFor(3, width)).toBe(wireGap / 2);
    expect(second).toEqual(first?.map((x) => x + staggerFor(3, width)));
    expect(rowPlaces(8, 2000).map((xs) => xs.map(round))).toEqual([
      [550, 890, 1230, 1570],
      [720, 1060, 1400, 1740],
    ]);
  });

  it("takes its stagger only out of a row's slack, so a full row stays put", () => {
    const [first, second] = rowPlaces(12, 2000);

    expect(staggerFor(6, 2000)).toBe(0);
    expect(second).toEqual(first);
  });

  it("spreads a wire's rows 0.6 of a step apart while they sit apart across, and a whole step once any two come close", () => {
    for (const [count, width, wanted] of [
      [9, 2000, rowStep],
      [7, 2000, rowStep],
      [8, 2000, rowStep],
      [6, sceneWidthFor(1290), rowStep],
      [7, sceneWidthFor(1290), rowStep],
      [12, 2000, wireStep],
      [13, 2000, wireStep],
      [8, sceneWidthFor(1290), wireStep],
      [9, sceneWidthFor(1290), wireStep],
    ] as const) {
      expect(rowStepFor(rowPlaces(count, width))).toBe(wanted);
    }
    for (const [count, share] of [
      [9, rowStep],
      [12, wireStep],
    ] as const) {
      const layout = layoutAviary(
        aviaryOf([
          { ...wireOf(4), name: "Above" },
          { ...wireOf(count), name: "Crowded" },
        ]),
        { width: 1920, height: 1000 },
      );
      const [above, first, second] = layout.rows.map((row) => row.y);

      expect((second ?? 0) - (first ?? 0)).toBeCloseTo(
        share * ((first ?? 0) - (above ?? 0)),
      );
    }
  });

  it("keeps every bird of a crowded wire inside the birds' room, in any window with room for one", () => {
    for (const width of [500, 760, 1100, 1290, 1400, 1920, 3440]) {
      for (let count = 1; count <= 30; count++) {
        const layout = layoutAviary(aviaryOf([wireOf(count)]), {
          width,
          height: 800,
        });

        for (const entry of placedBirds(layout)) {
          expect(entry.x).toBeGreaterThanOrEqual(columnEdgeFor(layout.width));
          expect(entry.x).toBeLessThanOrEqual(
            layout.width - edgeMarginFor(layout.width) + 1e-9,
          );
        }
        expect(layout.rows.length).toBeLessThanOrEqual(wireRowsCap);
      }
    }
  });

  it("sets a crowded wire's names by the gap to the nearest bird on the same row", () => {
    const layout = layoutAviary(aviaryOf([wireOf(13)]), {
      width: 1100,
      height: 800,
    });
    const width = layout.width;

    expect(placeSpacing(13, wireGap, width)).toBeLessThan(smallerBelow);
    expect(
      layout.rows.flatMap((row) => row.birds.map((entry) => entry.namePlace)),
    ).toEqual(Array.from({ length: 13 }, () => roomyName));
  });

  it("places every bird once, the wires top to bottom and the fence beneath", () => {
    const layout = layoutAviary(mockAviary, window);
    const ids = placedBirds(layout).map((entry) => entry.bird.id);

    expect([...ids].sort()).toEqual(mockBirds.map((bird) => bird.id).sort());
    const ys = layout.rows.map((row) => row.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(layout.fence.y).toBeGreaterThan(Math.max(...ys));
  });

  it("keeps a fifth of the scene above the top wire, or the bubble's room where that is more, up to 0.3 of the scene", () => {
    const tall = { width: 1920, height: 1200 };
    const short = { width: 3440, height: 1380 };
    const shorter = { width: 1100, height: 450 };
    const tallLayout = layoutAviary(mockAviary, tall);
    const shortLayout = layoutAviary(mockAviary, short);
    const shorterLayout = layoutAviary(mockAviary, shorter);

    expect(tallLayout.rows[0]?.y).toBeCloseTo(tallLayout.height * 0.2);
    expect(shortLayout.rows[0]?.y).toBeCloseTo(
      (26 * shortLayout.height) / short.height + 165,
    );
    expect(shortLayout.rows[0]?.y).toBeGreaterThan(shortLayout.height * 0.2);
    expect(shorterLayout.rows[0]?.y).toBeCloseTo(shorterLayout.height * 0.3);
    expect(shorterLayout.rows[0]?.y).toBeLessThan(
      (26 * shorterLayout.height) / shorter.height + 165,
    );
  });

  it("hangs the sun 0.09 down the scene, its disc at least 50 units clear of the top wire beneath it", () => {
    expect(lightAt(2000, 1000)).toEqual({ x: 1700, y: 90 });
    for (const size of [
      { width: 1100, height: 800 },
      { width: 1290, height: 800 },
      { width: 1920, height: 1000 },
      { width: 3440, height: 1380 },
      { width: 3440, height: 1540 },
      { width: 3440, height: 500 },
      { width: 800, height: 1600 },
    ]) {
      const layout = layoutAviary(mockAviary, size);
      const light = lightAt(layout.width, layout.height);
      const wire = wireHeight(layout.rows[0]?.y ?? 0, light.x, layout.width);

      expect(wire - (light.y + sunRadius)).toBeGreaterThanOrEqual(50);
      expect(light.y - sunRadius).toBeGreaterThan(0);
    }
  });

  it("keeps 100 window pixels below the fence, or an eighth of a shorter window", () => {
    for (const [size, pixels] of [
      [{ width: 1100, height: 800 }, 100],
      [{ width: 1920, height: 1000 }, 100],
      [{ width: 3440, height: 1380 }, 100],
      [{ width: 3440, height: 500 }, 62.5],
      [{ width: 1100, height: 450 }, 56.25],
    ] as const) {
      const layout = layoutAviary(mockAviary, size);
      const rail = toPixels({ x: 0, y: layout.fence.y }, layout, size);
      const foot = toPixels({ x: 0, y: layout.height }, layout, size);

      expect(foot.y - rail.y).toBeCloseTo(pixels, 0);
    }
  });

  it("splits a crowded wire over two rows, the first five on top and the rest beneath", () => {
    const layout = layoutAviary(mockAviary, window);
    const projects = layout.rows.filter((row) => row.wire.name === "Projects");
    const machine = layout.rows.filter(
      (row) => row.wire.name === "Machine & Home",
    );
    const order = byPosition(projects[0]?.wire.birds ?? []).map(
      (bird) => bird.id,
    );

    expect(machine).toHaveLength(1);
    expect(projects).toHaveLength(2);
    expect(projects[0]?.birds.map((entry) => entry.bird.id)).toEqual(
      order.slice(0, 5),
    );
    expect(projects[1]?.birds.map((entry) => entry.bird.id)).toEqual(
      order.slice(5),
    );
  });

  it("takes a second row past a row's worth of birds, and never a third", () => {
    expect(rowCapacity(sceneWidth)).toBe(6);
    expect(wireRowsCap).toBe(2);
    expect(
      [0, 1, 6, 7, 12, 13, 30].map((count) => rowsFor(count, sceneWidth)),
    ).toEqual([1, 1, 1, 2, 2, 2, 2]);
    for (const width of [300, 555.6, 791.1, 1000, 1433.3, 2000]) {
      for (let count = 0; count <= 40; count++) {
        expect(rowsFor(count, width)).toBeLessThanOrEqual(wireRowsCap);
      }
    }
    const layout = layoutAviary(aviaryOf([wireOf(13)]), window);

    expect(layout.rows.map((row) => row.birds.length)).toEqual([7, 6]);
  });

  it("scales the margins with the scene, today's 240 and 120 at full width and floored at 130 and 60", () => {
    expect(columnEdgeFor(2000)).toBe(240);
    expect(edgeMarginFor(2000)).toBe(120);
    expect(columnEdgeFor(1433.33)).toBeCloseTo(172);
    expect(edgeMarginFor(1433.33)).toBeCloseTo(86);
    expect(columnEdgeFor(1000)).toBe(130);
    expect(edgeMarginFor(1000)).toBe(60);
    expect(columnEdgeFor(500)).toBe(130);
    expect(edgeMarginFor(500)).toBe(60);
  });

  it("lays a 712 by 623 window's wires of five and nine out in two rows each, a step about 93 units", () => {
    const layout = layoutAviary(
      aviaryOf([
        { ...wireOf(5), name: "Important" },
        { ...wireOf(9), name: "Projects" },
      ]),
      { width: 712, height: 623 },
    );
    const width = layout.width;
    const [important, importantBelow, projects, projectsBelow] =
      layout.rows.map((row) => row.y);
    const step = (projects ?? 0) - (importantBelow ?? 0);

    expect(width).toBeCloseTo(791.11);
    expect(columnEdgeFor(width)).toBe(130);
    expect(edgeMarginFor(width)).toBe(60);
    expect(width - columnEdgeFor(width) - edgeMarginFor(width)).toBeCloseTo(
      601.11,
    );
    expect(rowCapacity(width)).toBe(3);
    expect(layout.rows.map((row) => row.birds.length)).toEqual([3, 2, 5, 4]);
    expect(acrossOf(layout, "Projects").map((xs) => xs.map(round))).toEqual([
      [130, 280.28, 430.56, 580.83, 731.11],
      [130, 330.37, 530.74, 731.11],
    ]);
    expect(step).toBeCloseTo(93.11, 2);
    expect((importantBelow ?? 0) - (important ?? 0)).toBeCloseTo(
      rowStep * step,
    );
    expect((projectsBelow ?? 0) - (projects ?? 0)).toBeCloseTo(wireStep * step);
  });

  it("keeps every wire, an empty one included", () => {
    const layout = layoutAviary(
      aviaryOf([...mockAviary.wires, { name: "Empty", birds: [] }]),
      window,
    );

    expect(layout.rows.map((row) => row.wire.name)).toContain("Empty");
  });

  it("turns birds inwards and puts the beak tip 45 units per scale above the wire", () => {
    const layout = layoutAviary(mockAviary, window);
    const birds = placedBirds(layout);

    for (const entry of birds) {
      expect(entry.facing).toBe(entry.x < layout.width / 2 ? "right" : "left");
      expect(entry.y - entry.beak.y).toBeCloseTo(45 * entry.scale);
    }
  });

  it("maps scene units onto the window, the scene centred when the aspect is bounded", () => {
    const wide = { width: 3440, height: 500 };
    const layout = layoutAviary(mockAviary, wide);
    const k = 500 / 480;
    const corner = toPixels({ x: 0, y: 0 }, layout, wide);

    expect(corner.x).toBeCloseTo((3440 - 2000 * k) / 2);
    expect(corner.y).toBeCloseTo(0);
  });

  it("maps a narrowed scene edge to edge across its window", () => {
    const narrow = { width: 900, height: 900 };
    const layout = layoutAviary(mockAviary, narrow);
    const corner = toPixels(
      { x: layout.width, y: layout.height },
      layout,
      narrow,
    );

    expect(layout.width).toBeCloseTo(1000);
    expect(toPixels({ x: 0, y: 0 }, layout, narrow)).toEqual({ x: 0, y: 0 });
    expect(corner.x).toBeCloseTo(900);
    expect(corner.y).toBeCloseTo(900);
  });
});

describe("the names on a crowded perch", () => {
  it("keeps every name on one baseline at full size while neighbours have room", () => {
    const spacing = placeSpacing(3, fenceGap, 2000);

    expect(spacing).toBe(fenceGap);
    expect([0, 1, 2].map((index) => namePlace(index, spacing, 30))).toEqual([
      { drop: 30, size: "full" },
      { drop: 30, size: "full" },
      { drop: 30, size: "full" },
    ]);
  });

  it("alternates names between two baselines once neighbours are close", () => {
    const spacing = alternateBelow - 1;

    expect([0, 1, 2, 3].map((index) => namePlace(index, spacing, 30))).toEqual([
      { drop: 30, size: "full" },
      { drop: 30 + lowerRowDrop, size: "full" },
      { drop: 30, size: "full" },
      { drop: 30 + lowerRowDrop, size: "full" },
    ]);
  });

  it("alternates and drops a size step at the live machine's fence of 21 birds", () => {
    const spacing = placeSpacing(21, fenceGap, 2000);

    expect(spacing).toBe(82);
    expect(spacing).toBeLessThan(smallerBelow);
    expect([0, 1].map((index) => namePlace(index, spacing, 30))).toEqual([
      { drop: 30, size: "small" },
      { drop: 30 + lowerRowDrop, size: "small" },
    ]);
  });

  it("lays a crowded fence's names out alternately, and a sparse one's on one line", () => {
    const crowded = layoutAviary(fenceOf(21), window).fence.birds;
    const sparse = layoutAviary(mockAviary, window).fence.birds;

    expect(crowded.map((entry) => entry.namePlace.drop)).toEqual(
      crowded.map((_, i) => (i % 2 === 1 ? 30 + lowerRowDrop : 30)),
    );
    expect(new Set(sparse.map((entry) => entry.namePlace.drop))).toEqual(
      new Set([30]),
    );
  });
});

describe("the arrival", () => {
  it("lands the wires before the fence, the worst first, then the plumpest", () => {
    const order = arrivalOrder(mockAviary);
    const sorted = [...order.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => mockBird(id));
    const fenceStart = sorted.findIndex((bird) => !bird.adopted);

    expect(sorted.slice(fenceStart).every((bird) => !bird.adopted)).toBe(true);
    expect(sorted[0]?.mood).toBe("distressed");
    const moods = sorted.slice(0, fenceStart).map((bird) => bird.mood);
    expect(moods.indexOf("content")).toBeGreaterThan(
      moods.lastIndexOf("restless"),
    );
  });

  it("runs again when a bird changes place between wires or the fence, not on a reorder", () => {
    const [machine, projects] = mockAviary.wires as [Wire, Wire];
    const reordered = aviaryOf([
      { ...machine, birds: [...machine.birds].reverse() },
      projects,
    ]);
    const moved = aviaryOf([
      { ...machine, birds: machine.birds.slice(1) },
      { ...projects, birds: [...projects.birds, machine.birds[0] as Bird] },
    ]);

    expect(arrangementKey(reordered)).toBe(arrangementKey(mockAviary));
    expect(arrangementKey(moved)).not.toBe(arrangementKey(mockAviary));
  });
});

describe("the bubble's place", () => {
  it("opens away from a right-facing bird's tail, its tail tip on the beak", () => {
    const beak = { x: 400, y: 500 };
    const placement = placeBubble(beak, "right", window, 180);

    expect(placement.tail.side).toBe("left");
    expect(placement.left + placement.tail.inset).toBe(beak.x);
    expect(placement.top + 180 + bubbleTailDrop).toBe(beak.y);
  });

  it("opens the other way for a left-facing bird", () => {
    const beak = { x: 1000, y: 500 };
    const placement = placeBubble(beak, "left", window, 180);

    expect(placement.tail.side).toBe("right");
    expect(placement.left + placement.width - placement.tail.inset).toBe(
      beak.x,
    );
  });

  it("stays inside the window", () => {
    const placement = placeBubble({ x: 1390, y: 60 }, "right", window, 180);

    expect(placement.left + placement.width).toBeLessThanOrEqual(1388);
    expect(placement.top).toBe(12);
  });
});
