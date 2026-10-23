import { mockAviary } from "@perch/core/mock.ts";
import type { Aviary, Bird, Wire } from "@perch/core/viewmodel.ts";
import { describe, expect, it } from "vitest";
import {
  arrangementKey,
  arrivalOrder,
  bubbleTailDrop,
  layoutAviary,
  placeBubble,
  placedBirds,
  rowCapacity,
  rowsFor,
  sceneHeightFor,
  toPixels,
} from "./aviary-layout.ts";
import { mockBird, mockBirds } from "./mock-birds.ts";
import {
  alternateBelow,
  fenceGap,
  lowerRowDrop,
  namePlace,
  placeSpacing,
  smallerBelow,
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

describe("the aviary's layout", () => {
  it("keeps the window's aspect within bounds", () => {
    expect(sceneHeightFor({ width: 1400, height: 800 })).toBe(1143);
    expect(sceneHeightFor({ width: 3440, height: 500 })).toBe(600);
    expect(sceneHeightFor({ width: 400, height: 1000 })).toBe(3000);
  });

  it("places every bird once, the wires top to bottom and the fence beneath", () => {
    const layout = layoutAviary(mockAviary, window);
    const ids = placedBirds(layout).map((entry) => entry.bird.id);

    expect([...ids].sort()).toEqual(mockBirds.map((bird) => bird.id).sort());
    const ys = layout.rows.map((row) => row.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(layout.fence.y).toBeGreaterThan(Math.max(...ys));
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
    expect(rowCapacity).toBe(6);
    expect([0, 1, 6, 7, 12, 13].map(rowsFor)).toEqual([1, 1, 1, 2, 2, 3]);
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
      expect(entry.facing).toBe(entry.x < 1000 ? "right" : "left");
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
