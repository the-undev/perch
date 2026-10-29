import { mockAviary } from "@perch/core/mock.ts";
import type { Aviary, Bird, Wire } from "@perch/core/viewmodel.ts";
import { describe, expect, it } from "vitest";
import {
  arrangementKey,
  arrivalOrder,
  bubbleTailDrop,
  layoutAviary,
  pixelsPerUnit,
  placeBubble,
  placedBirds,
  rowCapacity,
  rowStep,
  rowsFor,
  sceneHeightFor,
  toPixels,
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
  edgeMargin,
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

/** Each row's height, then each bird's perch, then the fence's height and its birds' x, to two places. */
function pinned(aviary: Aviary, size: { width: number; height: number }) {
  const layout = layoutAviary(aviary, size);
  const round = (value: number) => Math.round(value * 100) / 100;
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
    expect(sceneHeightFor({ width: 3440, height: 500 })).toBe(600);
    expect(sceneHeightFor({ width: 400, height: 3000 })).toBe(3000);
  });

  it("pins a full-width window's layout", () => {
    expect(pinned(mockAviary, { width: 1920, height: 1000 })).toEqual({
      width: 2000,
      height: 1042,
      rows: [
        [208.4, [660, 211.51], [1000, 213.4], [1340, 211.51]],
        [
          448.06,
          [120, 440.41],
          [560, 449.9],
          [1000, 453.06],
          [1440, 449.9],
          [1880, 440.41],
        ],
        [591.86, [340, 589.74], [780, 596.07], [1220, 596.07], [1660, 589.74]],
      ],
      fence: [937.8, 795, 1000, 1205],
    });
    expect(pinned(mockAviary, { width: 3440, height: 1380 })).toEqual({
      width: 2000,
      height: 802,
      rows: [
        [180.11, [660, 183.22], [1000, 185.11], [1340, 183.22]],
        [
          364.57,
          [120, 356.92],
          [560, 366.41],
          [1000, 369.57],
          [1440, 366.41],
          [1880, 356.92],
        ],
        [475.25, [340, 473.13], [780, 479.46], [1220, 479.46], [1660, 473.13]],
      ],
      fence: [743.88, 795, 1000, 1205],
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

  it("holds a unit at the floor below the floor's width while the scene's units narrow", () => {
    for (const width of [1799, 1400, 900, 600, 320]) {
      const size = { width, height: 1000 };
      const layout = layoutAviary(mockAviary, size);

      expect(layout.width).toBeCloseTo(width / minPixelsPerUnit);
      expect(layout.width).toBe(sceneWidthFor(width));
      expect(pixelsPerUnit(layout, size)).toBeCloseTo(minPixelsPerUnit);
    }
  });

  it("bunches a narrow window's wire, closing its gaps and wrapping it to more rows", () => {
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
    expect(perRow(6, 700)).toEqual([2, 2, 2]);
    expect(perRow(9, 1920)).toEqual([5, 4]);
    expect(perRow(9, 900)).toEqual([3, 3, 3]);
    expect(gap(1920)).toBe(wireGap);
    expect(gap(1400)).toBeLessThan(wireGap);
    expect(gap(1400)).toBeCloseTo((sceneWidthFor(1400) - 2 * edgeMargin) / 4);
  });

  it("keeps a crowded wire's birds apart: none within 120 units across unless a whole wire step down", () => {
    for (const [aviary, size] of [
      [aviaryOf([wireOf(8)]), { width: 1100, height: 800 }],
      [mockAviary, { width: 1100, height: 800 }],
      [mockAviary, { width: 1290, height: 800 }],
    ] as const) {
      const layout = layoutAviary(aviary, size);
      const second = layout.rows.findIndex((row) => row.index === 1);
      const step =
        ((layout.rows[second]?.y ?? 0) - (layout.rows[second - 1]?.y ?? 0)) /
        rowStep;

      expect(second).toBeGreaterThan(0);
      for (const wire of aviary.wires) {
        const perches = layout.rows
          .filter((row) => row.wire.name === wire.name)
          .flatMap((row) => row.birds.map((entry) => ({ x: entry.x, row })));
        for (const [i, one] of perches.entries()) {
          for (const other of perches.slice(i + 1)) {
            if (Math.abs(one.x - other.x) >= 120) continue;
            expect(Math.abs(one.row.y - other.row.y)).toBeGreaterThanOrEqual(
              wireStep * step - 1e-9,
            );
          }
        }
      }
    }
  });

  it("lays a wire that fits one row out as before", () => {
    const layout = layoutAviary(aviaryOf([wireOf(4)]), {
      width: 1100,
      height: 800,
    });
    const birds = layout.rows[0]?.birds ?? [];

    expect(layout.rows).toHaveLength(1);
    expect(birds.map((entry) => Math.round(entry.x * 100) / 100)).toEqual([
      120, 447.41, 774.81, 1102.22,
    ]);
    expect(birds.map((entry) => entry.namePlace)).toEqual(
      birds.map(() => roomyName),
    );
  });

  it("spreads a crowded wire left to right in its order, inside the margins", () => {
    for (const [count, size] of [
      [13, { width: 1100, height: 800 }],
      [24, { width: 1920, height: 1000 }],
      [13, { width: 640, height: 900 }],
    ] as const) {
      const wire = wireOf(count);
      const layout = layoutAviary(
        aviaryOf([{ ...wire, birds: [...wire.birds].reverse() }]),
        size,
      );
      const xs = layout.rows
        .flatMap((row) => row.birds)
        .sort((a, b) => a.bird.position - b.bird.position)
        .map((entry) => entry.x);

      expect(layout.rows.length).toBeGreaterThan(1);
      expect(xs.slice(1).every((x, i) => x > (xs[i] ?? 0))).toBe(true);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(edgeMargin);
      expect(Math.max(...xs)).toBeLessThanOrEqual(
        layout.width - edgeMargin + 1e-9,
      );
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

  it("keeps a fifth of the scene above the top wire, or the bubble's room where that is more", () => {
    const tall = { width: 1920, height: 1200 };
    const short = { width: 3440, height: 1380 };
    const tallLayout = layoutAviary(mockAviary, tall);
    const shortLayout = layoutAviary(mockAviary, short);

    expect(tallLayout.rows[0]?.y).toBeCloseTo(tallLayout.height * 0.2);
    expect(shortLayout.rows[0]?.y).toBeCloseTo(
      (26 * shortLayout.height) / short.height + 165,
    );
    expect(shortLayout.rows[0]?.y).toBeGreaterThan(shortLayout.height * 0.2);
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

  it("keeps 100 window pixels below the fence", () => {
    for (const size of [
      { width: 1100, height: 800 },
      { width: 1920, height: 1000 },
      { width: 3440, height: 1380 },
      { width: 3440, height: 500 },
    ]) {
      const layout = layoutAviary(mockAviary, size);
      const rail = toPixels({ x: 0, y: layout.fence.y }, layout, size);
      const foot = toPixels({ x: 0, y: layout.height }, layout, size);

      expect(foot.y - rail.y).toBeCloseTo(100, 0);
    }
  });

  it("splits a crowded wire over two rows, dealing its birds in turn", () => {
    const layout = layoutAviary(mockAviary, window);
    const projects = layout.rows.filter((row) => row.wire.name === "Projects");
    const machine = layout.rows.filter(
      (row) => row.wire.name === "Machine & Home",
    );
    const order = projects[0]?.wire.birds.map((bird) => bird.id) ?? [];

    expect(machine).toHaveLength(1);
    expect(projects).toHaveLength(2);
    expect(projects[0]?.birds.map((entry) => entry.bird.id)).toEqual(
      order.filter((_, i) => i % 2 === 0),
    );
    expect(projects[1]?.birds.map((entry) => entry.bird.id)).toEqual(
      order.filter((_, i) => i % 2 === 1),
    );
  });

  it("takes another row for each row's worth of birds", () => {
    expect(rowCapacity(sceneWidth)).toBe(6);
    expect(
      [0, 1, 6, 7, 12, 13].map((count) => rowsFor(count, sceneWidth)),
    ).toEqual([1, 1, 1, 2, 2, 3]);
    const layout = layoutAviary(aviaryOf([wireOf(13)]), window);

    expect(layout.rows.map((row) => row.birds.length)).toEqual([5, 4, 4]);
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
    const k = 500 / 600;

    expect(toPixels({ x: 0, y: 0 }, layout, wide)).toEqual({
      x: (3440 - 2000 * k) / 2,
      y: 0,
    });
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

    expect(spacing).toBe(88);
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
