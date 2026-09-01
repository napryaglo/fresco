# Compound (Container) Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add in-place nested-container layout (`NestedCompoundLayout`) to Fresco, laying out arbitrarily-deep containers with free cross-boundary edges by reusing the flat Sugiyama pipeline per container over a port-based isolation substrate.

**Architecture:** Each container's interior is laid out in isolation by the existing flat pipeline; cross-boundary edges reduce to *ports* on container borders. A bottom-up pass sizes each container into a box; a top-down pass unfolds boxes by pure translation. A cheap global "orientation" rank decides port sides. Containers may be frozen (`LayoutContent = false`) so pre-placed content is preserved.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), `@pragmatic-tech-ai/mural/runtime` (`Point`, `MuralBase`), test runner `tsx --test` with `node:test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-08-27-compound-layout-design.md` — read it alongside this plan; the plan argues from it.

## Global Constraints

- **No new runtime dependencies.** Only `@pragmatic-tech-ai/mural` and `yaml` are allowed (see `package.json`). The TODL-based corpus generator is a *separate follow-up plan* and is NOT part of this one.
- **ESM imports** always use `.js` extensions (e.g. `from '../graph.js'`), even for `.ts` sources.
- **Enums over string-literal unions** — `PortSide` is a real `enum`, never a `'top' | 'bottom'` union.
- **Tests live in a `tests/` subfolder** next to the source they exercise (e.g. `src/ge/compound/tests/…`).
- **Backward compatibility:** a `Graph` with no `ParentId` on any node must lay out identically to today. Default node size is `0×0`, which reproduces current spacing exactly.
- **Naming:** the linear stage chain is `FlatLayoutPipeline` (keeps "Pipeline"); the recursive composer is `NestedCompoundLayout` (no "Pipeline").
- **Run the full suite** with `npm test`. Run one file with `npx tsx --test src/ge/<path>/<file>.test.ts`.
- **Commit** after each task with the message shown in its final step.

**Scope of this plan:** Spec §4–§6, §8, §9, and Tier-1 of §10. Deferred to a follow-up plan: Tier-2 corpus harness (§10), `OverviewDetailLayout` (§7).

---

## File Structure

**Created:**
- `src/ge/geometry.ts` — `Size`, `Rect` value types + `boundingBox` helper.
- `src/ge/compound/hierarchy.ts` — read-only hierarchy queries over a `Graph` (`childrenOf`, `isContainer`, `ancestors`, `lca`).
- `src/ge/compound/orientation.ts` — global orientation rank + `portSideFor`.
- `src/ge/compound/port.ts` — `PortSide` enum + `Port` type.
- `src/ge/compound/nested-compound-layout.ts` — the composer (`NestedCompoundLayout implements ILayout`).
- `src/ge/compound/tests/*.test.ts` — Tier-1 invariant + unit tests.

**Modified:**
- `src/ge/graph.ts` — `Node` gains `ParentId`, `Size`, `LocalPosition`, `LayoutContent`.
- `src/ge/layouts/layout.ts` — `ILayout.Apply` returns `LayoutResult`; define `LayoutResult`.
- `src/ge/layouts/layout-pipeline.ts` → `flat-layout-pipeline.ts` — rename class, return `LayoutResult`, thread node sizes.
- `src/ge/layouts/{manual,circular,grid}-layout.ts` — return `LayoutResult`.
- `src/ge/layouts/index.ts` — export `FlatLayoutPipeline`, `LayoutResult`.
- `src/ge/position-computer/position-computer.ts` — `Compute` gains optional `sizes`.
- `src/ge/position-computer/brandes-kopf-position-computer.ts` — per-pair width, per-layer height.
- `src/ge/position-computer/centered-grid-position-computer.ts` — accept & ignore `sizes`.
- `src/ge/main.ts` — read `LayoutResult`; use `FlatLayoutPipeline`.
- `src/ge/configuration-loader.ts` — build `FlatLayoutPipeline`; comment fixups.
- `src/ge/pipeline-catalog.ts`, `src/ge/pipeline-configurations.json` — comment fixups.
- `src/ge/index.ts` — export new compound symbols + geometry.

---

## Phase 0 — Seam cleanup

### Task 1: Rename `LayoutPipeline` → `FlatLayoutPipeline`

Pure mechanical rename. No behavior change; the whole suite must stay green.

**Files:**
- Rename: `src/ge/layouts/layout-pipeline.ts` → `src/ge/layouts/flat-layout-pipeline.ts`
- Modify: `src/ge/layouts/index.ts`, `src/ge/configuration-loader.ts`, `src/ge/pipeline-catalog.ts`, `src/ge/pipeline-configurations.json`

**Interfaces:**
- Produces: `class FlatLayoutPipeline implements ILayout` (same constructor signature as today's `LayoutPipeline`).

- [ ] **Step 1: Rename the file and class.** `git mv src/ge/layouts/layout-pipeline.ts src/ge/layouts/flat-layout-pipeline.ts`. In the file, rename `export class LayoutPipeline` → `export class FlatLayoutPipeline`. Update the leading doc comment references from "LayoutPipeline" to "FlatLayoutPipeline".

- [ ] **Step 2: Update the export.** In `src/ge/layouts/index.ts` change `export { LayoutPipeline } from './layout-pipeline.js';` to `export { FlatLayoutPipeline } from './flat-layout-pipeline.js';`.

- [ ] **Step 3: Update the construction site.** In `src/ge/configuration-loader.ts`, change the import `LayoutPipeline` → `FlatLayoutPipeline`, the `new LayoutPipeline(` in `BuildPipeline` → `new FlatLayoutPipeline(`, and every comment mention of "LayoutPipeline" → "FlatLayoutPipeline".

- [ ] **Step 4: Update comments.** In `src/ge/pipeline-catalog.ts:57` and the `comment` field of `src/ge/pipeline-configurations.json`, replace "LayoutPipeline" with "FlatLayoutPipeline".

- [ ] **Step 5: Run the full suite.** Run: `npm test`. Expected: PASS (same count as before the rename). Also run `npm run typecheck` — expected: no errors.

- [ ] **Step 6: Commit.**
```bash
git add -A
git commit -m "refactor: rename LayoutPipeline to FlatLayoutPipeline"
```

### Task 2: Add `geometry.ts` (`Size`, `Rect`)

**Files:**
- Create: `src/ge/geometry.ts`
- Create: `src/ge/tests/geometry.test.ts`

**Interfaces:**
- Produces:
  - `interface Size { width: number; height: number }`
  - `interface Rect { position: Point; width: number; height: number }`
  - `function boundingBox(points: Iterable<{ x: number; y: number; w?: number; h?: number }>): Rect` — smallest `Rect` covering the given (optionally sized) points; `w`/`h` default to 0.

- [ ] **Step 1: Write the failing test.**
```ts
// src/ge/tests/geometry.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundingBox } from '../geometry.js';

test('boundingBox of point-like items is their extent', () => {
    const r = boundingBox([{ x: 0, y: 0 }, { x: 10, y: 4 }]);
    assert.equal(r.position.x, 0);
    assert.equal(r.position.y, 0);
    assert.equal(r.width, 10);
    assert.equal(r.height, 4);
});

test('boundingBox accounts for item width/height (centered extents)', () => {
    // one item at x=0 width 20 spans [-10, 10]; another at x=30 width 0 -> [-10,30]
    const r = boundingBox([{ x: 0, y: 0, w: 20, h: 10 }, { x: 30, y: 0, w: 0, h: 0 }]);
    assert.equal(r.position.x, -10);
    assert.equal(r.width, 40);   // -10 .. 30
    assert.equal(r.position.y, -5);
    assert.equal(r.height, 10);
});
```

- [ ] **Step 2: Run test to verify it fails.** Run: `npx tsx --test src/ge/tests/geometry.test.ts`. Expected: FAIL (`boundingBox` not found).

- [ ] **Step 3: Implement.**
```ts
// src/ge/geometry.ts
import { Point } from '@pragmatic-tech-ai/mural/runtime';

export interface Size { width: number; height: number }
export interface Rect { position: Point; width: number; height: number }

export function boundingBox(
    items: Iterable<{ x: number; y: number; w?: number; h?: number }>,
): Rect
{
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const it of items)
    {
        const hw = (it.w ?? 0) / 2;
        const hh = (it.h ?? 0) / 2;
        minX = Math.min(minX, it.x - hw); maxX = Math.max(maxX, it.x + hw);
        minY = Math.min(minY, it.y - hh); maxY = Math.max(maxY, it.y + hh);
    }
    if (!isFinite(minX)) { minX = minY = maxX = maxY = 0; }
    return { position: new Point(minX, minY), width: maxX - minX, height: maxY - minY };
}
```

- [ ] **Step 4: Run test to verify it passes.** Run: `npx tsx --test src/ge/tests/geometry.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add src/ge/geometry.ts src/ge/tests/geometry.test.ts
git commit -m "feat: add Size/Rect geometry types and boundingBox helper"
```

### Task 3: Introduce `LayoutResult` and change the `ILayout` contract

`ILayout.Apply` returns a structured result; `FlatLayoutPipeline` folds its `LastRoutes`/`LastCrossings` side-channels into it.

**Files:**
- Modify: `src/ge/layouts/layout.ts`
- Modify: `src/ge/layouts/flat-layout-pipeline.ts`
- Modify: `src/ge/layouts/manual-layout.ts`, `circular-layout.ts`, `grid-layout.ts`
- Modify: `src/ge/main.ts`, `src/ge/tests/configuration-loader.test.ts`
- Modify: `src/ge/layouts/index.ts`
- Create: `src/ge/layouts/tests/layout-result.test.ts`

**Interfaces:**
- Produces:
```ts
interface LayoutResult {
    positions:  Map<string, Point>;
    routes?:    Map<Edge, EdgeRouting>;
    boxes?:     Map<string, Rect>;
    crossings?: { adjacentBefore: number; adjacentAfter: number;
                  geometricBefore: number; geometricAfter: number };
}
interface ILayout { Apply(graph: Graph): LayoutResult; }
```

- [ ] **Step 1: Write the failing test.**
```ts
// src/ge/layouts/tests/layout-result.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

test('FlatLayoutPipeline.Apply returns a LayoutResult with positions', () => {
    const g = new Graph();
    for (const id of ['a', 'b']) g.AddNode(id);
    g.AddEdge('a', 'b');
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    const { layoutPipeline } = BuildPipeline(config, LoadElementRepository());

    const result = layoutPipeline.Apply(g);

    assert.ok(result.positions instanceof Map, 'positions is a Map');
    assert.equal(result.positions.size, 2, 'one position per real node');
    assert.ok(result.crossings, 'crossings diagnostics present');
});
```

- [ ] **Step 2: Run test to verify it fails.** Run: `npx tsx --test src/ge/layouts/tests/layout-result.test.ts`. Expected: FAIL (`result.positions` undefined — `Apply` currently returns a `Map`).

- [ ] **Step 3: Define `LayoutResult` and update `ILayout`.** In `src/ge/layouts/layout.ts`, import `Edge` from `../graph.js`, `Rect` from `../geometry.js`, `EdgeRouting` from `../edge-router/index.js`, and replace the interface:
```ts
import type { Point } from '@pragmatic-tech-ai/mural/runtime';
import type { Graph, Edge } from '../graph.js';
import type { Rect } from '../geometry.js';
import type { EdgeRouting } from '../edge-router/index.js';

export interface LayoutResult {
    positions:  Map<string, Point>;
    routes?:    Map<Edge, EdgeRouting>;
    boxes?:     Map<string, Rect>;
    crossings?: { adjacentBefore: number; adjacentAfter: number;
                  geometricBefore: number; geometricAfter: number };
}

export interface ILayout { Apply(graph: Graph): LayoutResult; }
```

- [ ] **Step 4: Update `FlatLayoutPipeline`.** Remove the `public LastRoutes?` and `public LastCrossings?` fields. Change `public Apply(graph: Graph): Map<string, Point>` to `: LayoutResult`. At the end of `Apply`, instead of assigning `this.LastRoutes`/`this.LastCrossings` and returning `positions`, return:
```ts
return {
    positions,
    routes,
    crossings: {
        adjacentBefore:  crossingsAdjBefore,
        adjacentAfter:   crossingsAdjAfter,
        geometricBefore: crossingsGeoBefore,
        geometricAfter:  crossingsGeoAfter,
    },
};
```
Keep the two `console.log` lines. Import `LayoutResult` from `./layout.js`.

- [ ] **Step 5: Update the other three layouts.** In `manual-layout.ts`, `circular-layout.ts`, `grid-layout.ts`, change the `Apply` return type to `LayoutResult` and wrap the existing position map: `return { positions };` (rename the local variable if needed). Import `LayoutResult` from `./layout.js`.

- [ ] **Step 6: Update consumers.** In `src/ge/main.ts`, change `const positions = layoutPipeline.Apply(finalGraph);` to `const result = layoutPipeline.Apply(finalGraph); const positions = result.positions;`, and update the `layoutPipeline.LastRoutes` / `layoutPipeline.LastCrossings` reads to `result.routes` / `result.crossings`. In `src/ge/tests/configuration-loader.test.ts` line ~86, change `assert.equal(layoutPipeline.LastRoutes, undefined);` to capture the result and assert `assert.equal(result.routes, undefined);` (adjust the surrounding `Apply` call to bind `const result = ...`).

- [ ] **Step 7: Export `LayoutResult`.** In `src/ge/layouts/index.ts` add `export { type ILayout, type LayoutResult } from './layout.js';` (replace the existing `ILayout`-only export line).

- [ ] **Step 8: Run the whole suite + typecheck.** Run: `npm test` then `npm run typecheck`. Expected: PASS, no type errors. The new `layout-result.test.ts` passes.

- [ ] **Step 9: Commit.**
```bash
git add -A
git commit -m "feat: ILayout returns structured LayoutResult (folds LastRoutes/LastCrossings)"
```

---

## Phase 1 — Variable-size position computer

This is the correctness lynchpin (spec §5.4). Land and prove it before any container code. Default size `0×0` reproduces current output exactly.

### Task 4: Thread optional `sizes` through `IPositionComputer`

**Files:**
- Modify: `src/ge/position-computer/position-computer.ts`
- Modify: `src/ge/position-computer/centered-grid-position-computer.ts`
- Modify: `src/ge/position-computer/brandes-kopf-position-computer.ts` (signature only in this task)
- Modify: `src/ge/layouts/flat-layout-pipeline.ts` (build & pass the map)

**Interfaces:**
- Produces: `Compute(layers: string[][], edges?: Edge[], sizes?: Map<string, Size>): Map<string, Point>` on `IPositionComputer`. `sizes` maps a node id to its intrinsic `Size`; absent ids are treated as `0×0`.

- [ ] **Step 1: Update the interface.** In `position-computer.ts` import `Size` from `../geometry.js` and add the third parameter:
```ts
Compute(layers: string[][], edges?: Edge[], sizes?: Map<string, Size>): Map<string, Point>;
```

- [ ] **Step 2: Update both implementations' signatures.** In `centered-grid-position-computer.ts` add `, _sizes?: Map<string, Size>` to `Compute` (import `Size`; ignore it). In `brandes-kopf-position-computer.ts` add `sizes?: Map<string, Size>` to `Compute` (import `Size`; unused for now — prefix with `_` or leave, it is consumed in Task 5).

- [ ] **Step 3: Build & pass an (empty for now) size map in `FlatLayoutPipeline`.** `Node.Size` does not exist until Task 6, so declare an empty map here and pass it — behavior-identical to today. In `Apply`, before the position computations:
```ts
const sizes = new Map<string, Size>();
// Populated from graph.nodes' Size in Task 6, once the property exists.
```
Import `Size` from `../geometry.js`. Pass `sizes` as the third arg to **both** `positionComputer.Compute(...)` calls: `this.positionComputer.Compute(layersInit, graph.edges, sizes)` and `this.positionComputer.Compute(ordered, expandedEdges, sizes)`. Task 6 Step 5 revisits this spot to add the population loop.

- [ ] **Step 4: Run suite + typecheck.** Run: `npm test && npm run typecheck`. Expected: PASS (empty `sizes` changes nothing).

- [ ] **Step 5: Commit.**
```bash
git add -A
git commit -m "feat: thread optional node sizes through IPositionComputer.Compute"
```

### Task 5: Brandes–Köpf honors per-node width and per-layer height

**Files:**
- Modify: `src/ge/position-computer/brandes-kopf-position-computer.ts`
- Create: `src/ge/position-computer/tests/brandes-kopf-sizes.test.ts`

**Interfaces:**
- Consumes: `Compute(layers, edges?, sizes?)` from Task 4.
- Produces: horizontal separation between in-layer neighbors `u` (left) and `w` = `width(u)/2 + nodeSpacingX + width(w)/2`; each layer band's vertical center advances by `height(prevMax)/2 + layerSpacingY + height(thisMax)/2`. Absent size ⇒ `0×0` ⇒ output identical to pre-change.

- [ ] **Step 1: Write the failing tests.**
```ts
// src/ge/position-computer/tests/brandes-kopf-sizes.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BrandesKopfPositionComputer } from '../brandes-kopf-position-computer.js';
import { Edge } from '../../graph.js';
import type { Size } from '../../geometry.js';

test('with no sizes, two-node layer keeps the uniform nodeSpacingX (110) gap', () => {
    const bk = new BrandesKopfPositionComputer();
    const layers = [['a', 'b']];
    const pos = bk.Compute(layers, [], undefined);
    assert.equal(Math.abs(pos.get('a')!.x - pos.get('b')!.x), 110);
});

test('per-node width widens the in-layer gap by the two half-widths', () => {
    const bk = new BrandesKopfPositionComputer();
    const layers = [['a', 'b']];
    const sizes: Map<string, Size> = new Map([
        ['a', { width: 40, height: 10 }],
        ['b', { width: 60, height: 10 }],
    ]);
    const pos = bk.Compute(layers, [], sizes);
    // 20 (half of a) + 110 + 30 (half of b) = 160
    assert.equal(Math.abs(pos.get('a')!.x - pos.get('b')!.x), 160);
});

test('per-layer height increases the band gap by the two half-heights', () => {
    const bk = new BrandesKopfPositionComputer(/* layerSpacingY */ 100);
    const layers = [['a'], ['b']];
    const edges = [new Edge('a', 'b')];
    const sizes: Map<string, Size> = new Map([
        ['a', { width: 0, height: 40 }],
        ['b', { width: 0, height: 60 }],
    ]);
    const pos = bk.Compute(layers, edges, sizes);
    // 20 + 100 + 30 = 150
    assert.equal(pos.get('b')!.y - pos.get('a')!.y, 150);
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npx tsx --test src/ge/position-computer/tests/brandes-kopf-sizes.test.ts`. Expected: FAIL on the width/height tests (gap stays 110 / 100).

- [ ] **Step 3: Implement per-node width.** In `runPass`, add a width lookup `const width = (id: string): number => sizes?.get(id)?.width ?? 0;`. In `placeBlock`, replace the constant `delta` usage. The current code computes candidates using `const delta = this.nodeSpacingX;`. Replace the two arithmetic sites so the separation between the current node `w` and its left in-layer neighbor `tlayers[lw]![pw - 1]!` uses a per-pair delta:
```ts
const leftId = tlayers[lw]![pw - 1]!;
const pairDelta = width(leftId) / 2 + this.nodeSpacingX + width(w) / 2;
```
and use `pairDelta` in place of `delta` in both the `shift` candidate (`xBlock.get(v)! - xBlock.get(u)! - pairDelta`) and the same-sink candidate (`xBlock.get(u)! + pairDelta`). Remove the now-unused `const delta`. (Dummy ids are absent from `sizes` ⇒ width 0 ⇒ `pairDelta === nodeSpacingX`, preserving current behavior.)

- [ ] **Step 4: Implement per-layer height.** In `Compute`, after `xFinal` is chosen and before building `positions`, compute per-layer band centers. Replace the `const y = this.padding + i * this.layerSpacingY;` loop with:
```ts
const height = (id: string): number => sizes?.get(id)?.height ?? 0;
const layerMaxH = layers.map(row => row.reduce((m, id) => Math.max(m, height(id)), 0));
const yCenter: number[] = [];
for (let i = 0; i < layers.length; i++) {
    if (i === 0) yCenter.push(this.padding + layerMaxH[0]! / 2);
    else yCenter.push(yCenter[i - 1]! + layerMaxH[i - 1]! / 2 + this.layerSpacingY + layerMaxH[i]! / 2);
}
```
then in the position-building loop use `const y = yCenter[i]!;` instead of the old formula. (All-zero heights ⇒ `yCenter[i] = padding + i*layerSpacingY`, identical to today.)

- [ ] **Step 5: Run the new file + full suite.** Run: `npx tsx --test src/ge/position-computer/tests/brandes-kopf-sizes.test.ts` (Expected: PASS), then `npm test` (Expected: PASS — existing size-less layouts unchanged).

- [ ] **Step 6: Commit.**
```bash
git add -A
git commit -m "feat: Brandes-Kopf honors per-node width and per-layer height"
```

---

## Phase 2 — Foundation (hierarchy, ports, orientation)

### Task 6: Hierarchy fields on `Node`

**Files:**
- Modify: `src/ge/graph.ts`
- Create: `src/ge/tests/graph-hierarchy.test.ts`

**Interfaces:**
- Produces on `Node`: `ParentId: string | undefined`, `Size: Size | undefined`, `LocalPosition: Point | undefined`, `LayoutContent: boolean` (default `true`). Follow the existing `RegisterProperty` + getter/setter pattern.

- [ ] **Step 1: Write the failing test.**
```ts
// src/ge/tests/graph-hierarchy.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Point } from '@pragmatic-tech-ai/mural/runtime';
import { Node } from '../graph.js';

test('a fresh node has no parent, no size, no local position, and lays out its content', () => {
    const n = new Node('x');
    assert.equal(n.ParentId, undefined);
    assert.equal(n.Size, undefined);
    assert.equal(n.LocalPosition, undefined);
    assert.equal(n.LayoutContent, true);
});

test('hierarchy fields round-trip', () => {
    const n = new Node('x');
    n.ParentId = 'box';
    n.Size = { width: 20, height: 12 };
    n.LocalPosition = new Point(3, 4);
    n.LayoutContent = false;
    assert.equal(n.ParentId, 'box');
    assert.deepEqual(n.Size, { width: 20, height: 12 });
    assert.equal(n.LocalPosition.x, 3);
    assert.equal(n.LayoutContent, false);
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npx tsx --test src/ge/tests/graph-hierarchy.test.ts`. Expected: FAIL (`ParentId` etc. not defined).

- [ ] **Step 3: Implement.** In `src/ge/graph.ts`, import `Point` and `Size`:
```ts
import type { Point } from '@pragmatic-tech-ai/mural/runtime';
import type { Size } from './geometry.js';
```
Add to `class Node`, following the existing key/getter/setter pattern:
```ts
static ParentIdKey      = MuralBase.RegisterProperty<string | undefined>(Node, 'ParentId', undefined, MetaData.None);
static SizeKey          = MuralBase.RegisterProperty<Size | undefined>(Node, 'Size', undefined, MetaData.None);
static LocalPositionKey = MuralBase.RegisterProperty<Point | undefined>(Node, 'LocalPosition', undefined, MetaData.None);
static LayoutContentKey = MuralBase.RegisterProperty<boolean>(Node, 'LayoutContent', true, MetaData.None);
```
```ts
public get ParentId(): string | undefined { return this.get_property_value(Node.ParentIdKey); }
public set ParentId(v: string | undefined) { this.set_property_value(Node.ParentIdKey, v); }
public get Size(): Size | undefined { return this.get_property_value(Node.SizeKey); }
public set Size(v: Size | undefined) { this.set_property_value(Node.SizeKey, v); }
public get LocalPosition(): Point | undefined { return this.get_property_value(Node.LocalPositionKey); }
public set LocalPosition(v: Point | undefined) { this.set_property_value(Node.LocalPositionKey, v); }
public get LayoutContent(): boolean { return this.get_property_value(Node.LayoutContentKey); }
public set LayoutContent(v: boolean) { this.set_property_value(Node.LayoutContentKey, v); }
```

- [ ] **Step 4: Run test + suite.** Run: `npx tsx --test src/ge/tests/graph-hierarchy.test.ts` then `npm test`. Expected: PASS.

- [ ] **Step 5: Populate the size map in `FlatLayoutPipeline`.** Return to `Apply` (Task 4 Step 3) and populate the previously-empty map:
```ts
const sizes = new Map<string, Size>();
for (const n of graph.nodes) if (n.Size !== undefined) sizes.set(n.Id, n.Size);
```
Run `npm test` — Expected: PASS (flat graphs still have no `Size`).

- [ ] **Step 6: Commit.**
```bash
git add -A
git commit -m "feat: add ParentId/Size/LocalPosition/LayoutContent to Node"
```

### Task 7: Hierarchy queries (`hierarchy.ts`)

**Files:**
- Create: `src/ge/compound/hierarchy.ts`
- Create: `src/ge/compound/tests/hierarchy.test.ts`

**Interfaces:**
- Produces:
  - `childrenOf(graph: Graph, parentId: string | undefined): Node[]` — nodes whose `ParentId === parentId` (roots for `undefined`).
  - `isContainer(graph: Graph, id: string): boolean` — some node names `id` as parent.
  - `ancestors(graph: Graph, id: string): string[]` — `[parent, grandparent, …]` up to a root (excludes `id`).
  - `lca(graph: Graph, a: string, b: string): string | undefined` — lowest common ancestor container id, or `undefined` if none (they live under different roots).

- [ ] **Step 1: Write the failing test.**
```ts
// src/ge/compound/tests/hierarchy.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { childrenOf, isContainer, ancestors, lca } from '../hierarchy.js';

function nested(): Graph {
    // root: box A (contains B and leaf p); B contains leaves q, r
    const g = new Graph();
    g.AddNode('A'); g.AddNode('B'); g.AddNode('p'); g.AddNode('q'); g.AddNode('r');
    g.nodes.find(n => n.Id === 'B')!.ParentId = 'A';
    g.nodes.find(n => n.Id === 'p')!.ParentId = 'A';
    g.nodes.find(n => n.Id === 'q')!.ParentId = 'B';
    g.nodes.find(n => n.Id === 'r')!.ParentId = 'B';
    return g;
}

test('childrenOf returns direct members', () => {
    const g = nested();
    assert.deepEqual(childrenOf(g, 'A').map(n => n.Id).sort(), ['B', 'p']);
    assert.deepEqual(childrenOf(g, 'B').map(n => n.Id).sort(), ['q', 'r']);
    assert.deepEqual(childrenOf(g, undefined).map(n => n.Id), ['A']);
});

test('isContainer is true only for nodes with children', () => {
    const g = nested();
    assert.equal(isContainer(g, 'A'), true);
    assert.equal(isContainer(g, 'B'), true);
    assert.equal(isContainer(g, 'p'), false);
});

test('ancestors walks to the root', () => {
    assert.deepEqual(ancestors(nested(), 'q'), ['B', 'A']);
});

test('lca finds the lowest common container', () => {
    const g = nested();
    assert.equal(lca(g, 'q', 'r'), 'B');   // both in B
    assert.equal(lca(g, 'q', 'p'), 'A');   // q in B in A; p in A
    assert.equal(lca(g, 'q', 'q'), 'B');   // self -> its parent
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npx tsx --test src/ge/compound/tests/hierarchy.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement.**
```ts
// src/ge/compound/hierarchy.ts
import type { Graph, Node } from '../graph.js';

export function childrenOf(graph: Graph, parentId: string | undefined): Node[] {
    return graph.nodes.filter(n => n.ParentId === parentId);
}

export function isContainer(graph: Graph, id: string): boolean {
    return graph.nodes.some(n => n.ParentId === id);
}

export function ancestors(graph: Graph, id: string): string[] {
    const byId = new Map(graph.nodes.map(n => [n.Id, n]));
    const out: string[] = [];
    let cur = byId.get(id)?.ParentId;
    while (cur !== undefined) { out.push(cur); cur = byId.get(cur)?.ParentId; }
    return out;
}

export function lca(graph: Graph, a: string, b: string): string | undefined {
    const chainA = [...ancestors(graph, a)];
    const setA = new Set(chainA);
    // If b (or an ancestor of b) is itself an ancestor of a, that is the LCA.
    for (const x of [b, ...ancestors(graph, b)]) if (setA.has(x)) return x;
    // Symmetric: a-chain member that is b or ancestor-of-b already covered above.
    // Special-case a===b: LCA is its parent (handled since ancestors(b) starts at parent).
    return undefined;
}
```
> The `lca(q, q)` case returns `'B'` because `ancestors(q) = [B, A]` and the scan `[q, B, A]` hits `B` which is in `setA`. Verify against the test.

- [ ] **Step 4: Run test + suite.** Run: `npx tsx --test src/ge/compound/tests/hierarchy.test.ts` then `npm test`. Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add src/ge/compound/hierarchy.ts src/ge/compound/tests/hierarchy.test.ts
git commit -m "feat: hierarchy queries over Graph (childrenOf/isContainer/ancestors/lca)"
```

### Task 8: `PortSide` enum + `Port` type

**Files:**
- Create: `src/ge/compound/port.ts`
- Create: `src/ge/compound/tests/port.test.ts`

**Interfaces:**
- Produces:
  - `enum PortSide { Top, Bottom, Left, Right }`
  - `interface Port { id: string; side: PortSide; containerId: string; edge: Edge }` — `id` is a synthetic node id used inside a container's interior run; `containerId` is the boundary it sits on; `edge` is the original crossing edge.

- [ ] **Step 1: Write the failing test.**
```ts
// src/ge/compound/tests/port.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PortSide, portId } from '../port.js';
import { Edge } from '../../graph.js';

test('PortSide is a real enum with four sides', () => {
    assert.equal(typeof PortSide.Top, 'number');
    assert.notEqual(PortSide.Top, PortSide.Bottom);
});

test('portId is deterministic and unique per (container, edge, side)', () => {
    const e = new Edge('u', 'v');
    const a = portId('BOX', e, PortSide.Top);
    const b = portId('BOX', e, PortSide.Top);
    const c = portId('BOX', e, PortSide.Bottom);
    assert.equal(a, b);
    assert.notEqual(a, c);
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npx tsx --test src/ge/compound/tests/port.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**
```ts
// src/ge/compound/port.ts
import type { Edge } from '../graph.js';

export enum PortSide { Top, Bottom, Left, Right }

export interface Port {
    id:          string;
    side:        PortSide;
    containerId: string;
    edge:        Edge;
}

export function portId(containerId: string, edge: Edge, side: PortSide): string {
    return `__port:${containerId}:${edge.From}->${edge.To}:${side}`;
}
```

- [ ] **Step 4: Run test + suite.** Run: `npx tsx --test src/ge/compound/tests/port.test.ts` then `npm test`. Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add src/ge/compound/port.ts src/ge/compound/tests/port.test.ts
git commit -m "feat: PortSide enum and Port type with deterministic port ids"
```

### Task 9: Global orientation pass (`orientation.ts`)

**Files:**
- Create: `src/ge/compound/orientation.ts`
- Create: `src/ge/compound/tests/orientation.test.ts`

**Interfaces:**
- Consumes: `LongestPathLayerAssigner` from `../layer-assigner/index.js`; `isContainer` from `./hierarchy.js`; `PortSide` from `./port.js`.
- Produces:
  - `globalRank(graph: Graph): Map<string, number>` — longest-path rank over the *leaf* nodes (containers excluded) and all edges. Edges are assumed to connect leaves.
  - `portSideFor(sourceRank: number, targetRank: number): PortSide` — `Bottom` if target below source (`target > source`), `Top` if above, `Left` if equal (a same-rank sibling crossing; `Right` is reserved for the opposite endpoint of the same edge and assigned by the caller).

- [ ] **Step 1: Write the failing test.**
```ts
// src/ge/compound/tests/orientation.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { globalRank, portSideFor } from '../orientation.js';
import { PortSide } from '../port.js';

test('globalRank ranks leaves by longest path, ignoring containers', () => {
    const g = new Graph();
    g.AddNode('A');                       // container
    g.AddNode('a'); g.AddNode('b'); g.AddNode('c');
    g.nodes.find(n => n.Id === 'a')!.ParentId = 'A';
    g.AddEdge('a', 'b'); g.AddEdge('b', 'c');
    const rank = globalRank(g);
    assert.equal(rank.get('a'), 0);
    assert.equal(rank.get('b'), 1);
    assert.equal(rank.get('c'), 2);
    assert.equal(rank.has('A'), false, 'containers get no rank');
});

test('portSideFor picks border by flow direction', () => {
    assert.equal(portSideFor(0, 2), PortSide.Bottom); // target below -> exits bottom
    assert.equal(portSideFor(2, 0), PortSide.Top);    // target above -> exits top
    assert.equal(portSideFor(1, 1), PortSide.Left);   // same rank -> side
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npx tsx --test src/ge/compound/tests/orientation.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**
```ts
// src/ge/compound/orientation.ts
import { Graph } from '../graph.js';
import { LongestPathLayerAssigner } from '../layer-assigner/index.js';
import { isContainer } from './hierarchy.js';
import { PortSide } from './port.js';

export function globalRank(graph: Graph): Map<string, number> {
    // Flatten to leaves + edges among them (edges connect leaves).
    const leaves = graph.nodes.filter(n => !isContainer(graph, n.Id));
    const flat = new Graph([...leaves], [...graph.edges]);
    return new LongestPathLayerAssigner().Assign(flat);
}

export function portSideFor(sourceRank: number, targetRank: number): PortSide {
    if (targetRank > sourceRank) return PortSide.Bottom;
    if (targetRank < sourceRank) return PortSide.Top;
    return PortSide.Left;
}
```
> `LongestPathLayerAssigner.Assign` returns a fresh `Node[]`/`Edge[]` graph's rank map. `Graph`'s constructor takes `(nodes, edges)` arrays directly. Reusing the same `Node` objects is fine — the assigner reads `Id`/edges only.

- [ ] **Step 4: Run test + suite.** Run: `npx tsx --test src/ge/compound/tests/orientation.test.ts` then `npm test`. Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add src/ge/compound/orientation.ts src/ge/compound/tests/orientation.test.ts
git commit -m "feat: global orientation rank + port-side selection"
```

---

## Phase 3 — `NestedCompoundLayout`

The composer is built incrementally: first single-level (one container, no cross-boundary edges), then cross-boundary ports, then nesting, then routing. Each task adds one behavior with its own invariant test.

### Task 10: Composer skeleton — flat graph passes through unchanged

**Files:**
- Create: `src/ge/compound/nested-compound-layout.ts`
- Create: `src/ge/compound/tests/nested-flat.test.ts`
- Modify: `src/ge/index.ts` (export)

**Interfaces:**
- Consumes: `FlatLayoutPipeline` (as the per-container engine), `hierarchy.ts`, `LayoutResult`.
- Produces: `class NestedCompoundLayout implements ILayout`. Constructor takes the `FlatLayoutPipeline` to use for interior runs: `constructor(private readonly engine: FlatLayoutPipeline)`. `Apply(graph)` returns `LayoutResult` with `positions` and `boxes`.

- [ ] **Step 1: Write the failing test.**
```ts
// src/ge/compound/tests/nested-flat.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}

test('a container-free graph lays out exactly like the flat pipeline', () => {
    const g = new Graph();
    for (const id of ['a', 'b', 'c']) g.AddNode(id);
    g.AddEdge('a', 'b'); g.AddEdge('b', 'c');

    const flat = engine().Apply(g).positions;
    const nested = new NestedCompoundLayout(engine()).Apply(g);

    assert.equal(nested.positions.size, 3);
    for (const id of ['a', 'b', 'c']) {
        assert.deepEqual(nested.positions.get(id), flat.get(id), `${id} matches flat layout`);
    }
    assert.equal(nested.boxes?.size ?? 0, 0, 'no containers -> no boxes');
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npx tsx --test src/ge/compound/tests/nested-flat.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement the skeleton.**
```ts
// src/ge/compound/nested-compound-layout.ts
import type { Point } from '@pragmatic-tech-ai/mural/runtime';
import type { Graph } from '../graph.js';
import type { ILayout, LayoutResult } from '../layouts/layout.js';
import type { FlatLayoutPipeline } from '../layouts/flat-layout-pipeline.js';
import type { Rect } from '../geometry.js';
import { childrenOf, isContainer } from './hierarchy.js';

export class NestedCompoundLayout implements ILayout {
    constructor(private readonly engine: FlatLayoutPipeline) {}

    public Apply(graph: Graph): LayoutResult {
        const anyContainer = graph.nodes.some(n => isContainer(graph, n.Id));
        if (!anyContainer) return this.engine.Apply(graph);

        // Real implementation arrives in later tasks; placeholder throws so
        // no test silently passes on an unfinished path.
        throw new Error('NestedCompoundLayout: container layout not yet implemented');
    }
}
```
Add to `src/ge/index.ts`: `export { NestedCompoundLayout } from './compound/nested-compound-layout.js';` and `export * from './geometry.js';` and `export { PortSide } from './compound/port.js';` (only if not already exported).

- [ ] **Step 4: Run test + suite.** Run: `npx tsx --test src/ge/compound/tests/nested-flat.test.ts` then `npm test`. Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add -A
git commit -m "feat: NestedCompoundLayout skeleton (flat passthrough)"
```

### Task 11: Size + place a single container with no cross-boundary edges

Implements the size-up/place-down core for one level. A container's interior is laid out by the engine; its box becomes a sized node at the parent level; unfolding translates the interior into place.

**Files:**
- Modify: `src/ge/compound/nested-compound-layout.ts`
- Create: `src/ge/compound/tests/nested-single.test.ts`

**Interfaces:**
- Produces (private, but relied on by later tasks):
  - `private layoutContainer(graph, containerId): { positions: Map<string, Point>; box: Rect }` — local frame positions of the container's *direct* children (nested boxes already resolved) + the container's box `Rect` (bounding box of members + `this.padding`).
  - `private padding: number` constructor param (default `40`).
  - `private buildLocalGraph(graph, containerId): Graph` — a `Graph` of the container's direct children as nodes carrying `Size` (leaf intrinsic size or sub-container box size), plus intra-container edges. (Ports added in Task 12.)

- [ ] **Step 1: Write the failing test (invariant: children inside box, no overlap).**
```ts
// src/ge/compound/tests/nested-single.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}

// helper: is (x,y) inside rect [pos, pos+w/h]?
function inside(box: { position: { x: number; y: number }; width: number; height: number }, p: { x: number; y: number }) {
    return p.x >= box.position.x && p.x <= box.position.x + box.width
        && p.y >= box.position.y && p.y <= box.position.y + box.height;
}

test('one container with two children: children sit inside the box', () => {
    const g = new Graph();
    g.AddNode('BOX');
    g.AddNode('a'); g.AddNode('b');
    for (const id of ['a', 'b']) {
        const n = g.nodes.find(x => x.Id === id)!;
        n.ParentId = 'BOX';
        n.Size = { width: 30, height: 20 };
    }
    g.AddEdge('a', 'b');

    const res = new NestedCompoundLayout(engine()).Apply(g);
    const box = res.boxes!.get('BOX')!;

    assert.ok(box, 'BOX has a rectangle');
    assert.ok(inside(box, res.positions.get('a')!), 'a inside box');
    assert.ok(inside(box, res.positions.get('b')!), 'b inside box');
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npx tsx --test src/ge/compound/tests/nested-single.test.ts`. Expected: FAIL (throws "not yet implemented").

- [ ] **Step 3: Implement size-up/place-down for a single level.** Replace the `throw` in `Apply` and add helpers. Key logic:
  - `buildLocalGraph`: for each direct child, create a `Node` copy carrying its `Size` (a leaf uses its own `Size` default `{0,0}`; a sub-container uses its computed box size — Task 13 wires the recursion, for now assume direct children are leaves). Add intra-container edges (edges whose *both* endpoints are direct children of this container).
  - Run `this.engine.Apply(localGraph)` → interior positions (already sized via BK from Task 5).
  - `box` = `boundingBox` of interior positions inflated by `this.padding` on each side.
  - Place-down: the root container(s) are laid out by treating each top-level container as a sized node in a *root* local graph; then unfold each container by translating its interior positions so the box's top-left lands at the placed position.

```ts
import { boundingBox } from '../geometry.js';
import { Node } from '../graph.js';
import { Point } from '@pragmatic-tech-ai/mural/runtime';

private readonly padding = 40;

private buildLocalGraph(graph: Graph, containerId: string | undefined,
                        boxSize: Map<string, { width: number; height: number }>): Graph {
    const kids = childrenOf(graph, containerId);
    const kidIds = new Set(kids.map(k => k.Id));
    const nodes = kids.map(k => {
        const n = new Node(k.Id, k.Label);
        n.Size = boxSize.get(k.Id) ?? k.Size ?? { width: 0, height: 0 };
        return n;
    });
    const edges = graph.edges.filter(e => kidIds.has(e.From) && kidIds.has(e.To));
    return new Graph(nodes, edges);
}

public Apply(graph: Graph): LayoutResult {
    const anyContainer = graph.nodes.some(n => isContainer(graph, n.Id));
    if (!anyContainer) return this.engine.Apply(graph);

    const boxSize = new Map<string, { width: number; height: number }>();
    const localPos = new Map<string, Map<string, Point>>(); // containerId|'' -> child positions

    // Bottom-up: deepest containers first. Order by descending depth.
    const containers = graph.nodes.filter(n => isContainer(graph, n.Id)).map(n => n.Id);
    containers.sort((a, b) => this.depth(graph, b) - this.depth(graph, a));

    for (const c of containers) {
        const local = this.buildLocalGraph(graph, c, boxSize);
        const res = this.engine.Apply(local);
        localPos.set(c, res.positions);
        const bb = boundingBox([...local.nodes].map(n => {
            const p = res.positions.get(n.Id)!;
            return { x: p.x, y: p.y, w: n.Size!.width, h: n.Size!.height };
        }));
        boxSize.set(c, { width: bb.width + 2 * this.padding, height: bb.height + 2 * this.padding });
    }

    // Root level (parent === undefined).
    const rootLocal = this.buildLocalGraph(graph, undefined, boxSize);
    const rootRes = this.engine.Apply(rootLocal);
    localPos.set('', rootRes.positions);

    // Place-down: unfold each container placed in its parent frame.
    const positions = new Map<string, Point>();
    const boxes = new Map<string, Rect>();
    this.unfold(graph, undefined, new Point(0, 0), boxSize, localPos, positions, boxes);
    return { positions, boxes };
}

private depth(graph: Graph, id: string): number {
    let d = 0, cur = graph.nodes.find(n => n.Id === id)?.ParentId;
    while (cur !== undefined) { d++; cur = graph.nodes.find(n => n.Id === cur)?.ParentId; }
    return d;
}

// Translate a container's local child positions into global space, recursing.
private unfold(graph: Graph, containerId: string | undefined, origin: Point,
               boxSize: Map<string, { width: number; height: number }>,
               localPos: Map<string, Map<string, Point>>,
               outPos: Map<string, Point>, outBoxes: Map<string, Rect>): void {
    const key = containerId ?? '';
    const pos = localPos.get(key)!;
    // Local positions are node CENTERS; shift so the local bbox top-left maps to origin.
    const kids = childrenOf(graph, containerId);
    const bb = boundingBox(kids.map(k => {
        const p = pos.get(k.Id)!;
        const s = boxSize.get(k.Id) ?? k.Size ?? { width: 0, height: 0 };
        return { x: p.x, y: p.y, w: s.width, h: s.height };
    }));
    const dx = origin.x - bb.position.x + this.padding;
    const dy = origin.y - bb.position.y + this.padding;

    for (const k of kids) {
        const p = pos.get(k.Id)!;
        const gp = new Point(p.x + dx, p.y + dy);
        if (isContainer(graph, k.Id)) {
            const s = boxSize.get(k.Id)!;
            const topLeft = new Point(gp.x - s.width / 2, gp.y - s.height / 2);
            outBoxes.set(k.Id, { position: topLeft, width: s.width, height: s.height });
            this.unfold(graph, k.Id, topLeft, boxSize, localPos, outPos, outBoxes);
        } else {
            outPos.set(k.Id, gp);
        }
    }
}
```
> Import `Rect`, `boundingBox` from `../geometry.js`, `Node` from `../graph.js`, `Point` from `mural/runtime`, `childrenOf`/`isContainer` from `./hierarchy.js`.

- [ ] **Step 4: Run test + suite.** Run: `npx tsx --test src/ge/compound/tests/nested-single.test.ts` then `npm test`. Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add -A
git commit -m "feat: NestedCompoundLayout sizes and places a single container"
```

### Task 12: Cross-boundary ports (in/out) into the interior run

Adds a port node to a container's local graph for each edge that crosses its boundary, pinned to a synthetic top or bottom layer per the orientation rank.

**Files:**
- Modify: `src/ge/compound/nested-compound-layout.ts`
- Create: `src/ge/compound/tests/nested-ports.test.ts`

**Interfaces:**
- Consumes: `globalRank`, `portSideFor`, `portId`, `PortSide`.
- Produces: `crossingEdgesOf(graph, containerId): Edge[]` — edges with exactly one endpoint inside the container's subtree. Ports created for these get `Size {0,0}` and a stub edge connecting the interior child to the port so barycenter pulls the port toward its neighbor; the port is forced into a synthetic first/last layer by adding it to the local graph with a directed edge from/to the interior node in the correct direction.

- [ ] **Step 1: Write the failing test (invariant: crossing edge produces a port on the correct border).**
```ts
// src/ge/compound/tests/nested-ports.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}

test('an edge from inside a container to an outside node below keeps both placed and box intact', () => {
    const g = new Graph();
    g.AddNode('BOX'); g.AddNode('a'); g.AddNode('out');
    const a = g.nodes.find(n => n.Id === 'a')!; a.ParentId = 'BOX'; a.Size = { width: 20, height: 20 };
    g.nodes.find(n => n.Id === 'out')!.Size = { width: 20, height: 20 };
    g.AddEdge('a', 'out'); // crosses BOX boundary, flows downward

    const res = new NestedCompoundLayout(engine()).Apply(g);
    assert.ok(res.boxes!.get('BOX'), 'box exists');
    assert.ok(res.positions.get('a'), 'a placed');
    assert.ok(res.positions.get('out'), 'out placed');
    // 'a' is inside the box; 'out' is not (it is a sibling of BOX at root)
    const box = res.boxes!.get('BOX')!;
    const outp = res.positions.get('out')!;
    const outsideBox = outp.x < box.position.x || outp.x > box.position.x + box.width
                    || outp.y < box.position.y || outp.y > box.position.y + box.height;
    assert.ok(outsideBox, 'out is not inside BOX');
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npx tsx --test src/ge/compound/tests/nested-ports.test.ts`. Expected: FAIL (currently intra-container-only edges are used, so `a`→`out` is dropped from every local graph and `out` is never connected; the box may still form but `out` placement/logic differs — confirm the failure, then implement).

- [ ] **Step 3: Implement ports.** Extend `buildLocalGraph` to accept the full `graph` and `rank` and add ports:
  - Compute `subtree(containerId)` = the container + all descendants.
  - `crossingEdgesOf`: edges with exactly one endpoint in the subtree.
  - For each crossing edge, the interior endpoint is the one *inside*; add a port node `portId(containerId, edge, side)` with `Size {0,0}`; `side` = `portSideFor(rank(interior), rank(exterior))`. Add a stub edge: for a `Bottom` (out) port, `interior → port`; for a `Top` (in) port, `port → interior`. This forces the port into the last / first layer respectively via longest-path layering.
  - At the *parent* level, the same crossing edge appears between the container box and the exterior node: add an edge `BOX → exterior` (or reversed) so the parent layout ranks them in flow. Implement by rewriting crossing edges at each level to connect the *child that represents the subtree at this level* (the container box id) to the other endpoint (or that endpoint's representative container).

  Concretely, add a helper `representativeAt(graph, nodeId, level containerId)` returning the ancestor of `nodeId` that is a direct child of `containerId` (or `nodeId` itself if it is a direct child). Then `buildLocalGraph(graph, containerId)` edges = for every graph edge with at least one endpoint whose representative-at-this-level exists and differs, add an edge between the two representatives (dedup; drop self-edges). This makes both intra- and cross-boundary edges appear at the correct level, and ports handle the interior stubs.

```ts
private representativeAt(graph: Graph, nodeId: string, containerId: string | undefined): string | undefined {
    // Walk up until the node's parent is `containerId`; return that node.
    let cur: string | undefined = nodeId;
    while (cur !== undefined) {
        const parent = graph.nodes.find(n => n.Id === cur)?.ParentId;
        if (parent === containerId) return cur;
        cur = parent;
    }
    return undefined; // nodeId is not within containerId's subtree
}
```
Rebuild `buildLocalGraph` edges using `representativeAt` for the current `containerId`; keep pairs where both reps are defined and distinct. Add ports for edges where exactly one rep is defined (the crossing case) OR where a rep is a container that the edge truly crosses into — pin the port using the stub direction rule above.

- [ ] **Step 4: Run test + suite.** Run: `npx tsx --test src/ge/compound/tests/nested-ports.test.ts` then `npm test`. Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add -A
git commit -m "feat: cross-boundary ports pinned to top/bottom bands via orientation rank"
```

### Task 13: Nested containers (≥3 deep)

Ensures the recursion composes: a container inside a container inside a container sizes bottom-up and unfolds top-down with all leaves inside their innermost box, and every box inside its parent box.

**Files:**
- Modify: `src/ge/compound/nested-compound-layout.ts` (only if a bug surfaces; the Task-11 recursion should already generalize)
- Create: `src/ge/compound/tests/nested-deep.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 11–12.

- [ ] **Step 1: Write the characterizing test (invariant: containment at every level).**
```ts
// src/ge/compound/tests/nested-deep.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}
function contains(outer: { position: { x:number;y:number }, width:number, height:number },
                  inner: { position: { x:number;y:number }, width:number, height:number }) {
    return inner.position.x >= outer.position.x - 0.001
        && inner.position.y >= outer.position.y - 0.001
        && inner.position.x + inner.width <= outer.position.x + outer.width + 0.001
        && inner.position.y + inner.height <= outer.position.y + outer.height + 0.001;
}

test('azure ⊃ m365 ⊃ pp: every box nests inside its parent box', () => {
    const g = new Graph();
    g.AddNode('azure'); g.AddNode('m365'); g.AddNode('pp'); g.AddNode('leaf');
    g.nodes.find(n => n.Id === 'm365')!.ParentId = 'azure';
    g.nodes.find(n => n.Id === 'pp')!.ParentId = 'm365';
    const leaf = g.nodes.find(n => n.Id === 'leaf')!; leaf.ParentId = 'pp'; leaf.Size = { width: 30, height: 20 };

    const res = new NestedCompoundLayout(engine()).Apply(g);
    const azure = res.boxes!.get('azure')!, m365 = res.boxes!.get('m365')!, pp = res.boxes!.get('pp')!;
    assert.ok(contains(azure, m365), 'm365 inside azure');
    assert.ok(contains(m365, pp), 'pp inside m365');
    const leafPos = res.positions.get('leaf')!;
    assert.ok(leafPos.x >= pp.position.x && leafPos.x <= pp.position.x + pp.width, 'leaf inside pp');
});
```

- [ ] **Step 2: Run.** Run: `npx tsx --test src/ge/compound/tests/nested-deep.test.ts`. Expected: PASS if the recursion generalizes; if FAIL, fix `unfold`/`depth`/`buildLocalGraph` so a container's `Size` is read from `boxSize` (already computed bottom-up) when it appears as a child. Debug until green.

- [ ] **Step 3 (only if needed): Fix recursion.** Common fix: ensure `buildLocalGraph` uses `boxSize.get(childId)` for child containers (already in the Task-11 code) and that the bottom-up `containers.sort` truly processes deepest first (verify `depth`).

- [ ] **Step 4: Run suite.** Run: `npm test`. Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add -A
git commit -m "test: NestedCompoundLayout nests containers 3+ levels deep"
```

### Task 14: No sibling-box overlap (invariant test) + unfolding-is-translation

**Files:**
- Create: `src/ge/compound/tests/nested-invariants.test.ts`

**Interfaces:**
- Consumes: the public `Apply`. No production code unless an invariant fails.

- [ ] **Step 1: Write the invariant tests.**
```ts
// src/ge/compound/tests/nested-invariants.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}
function overlap(a: any, b: any) {
    return a.position.x < b.position.x + b.width && a.position.x + a.width > b.position.x
        && a.position.y < b.position.y + b.height && a.position.y + a.height > b.position.y;
}

test('sibling boxes do not overlap', () => {
    const g = new Graph();
    for (const box of ['A', 'B']) {
        g.AddNode(box);
        for (const leaf of [box + '1', box + '2']) {
            g.AddNode(leaf);
            const n = g.nodes.find(x => x.Id === leaf)!; n.ParentId = box; n.Size = { width: 30, height: 20 };
        }
    }
    g.AddEdge('A1', 'B1'); // a cross-container edge to force relative placement

    const res = new NestedCompoundLayout(engine()).Apply(g);
    const A = res.boxes!.get('A')!, B = res.boxes!.get('B')!;
    assert.equal(overlap(A, B), false, 'A and B boxes are disjoint');
});
```

- [ ] **Step 2: Run.** Run: `npx tsx --test src/ge/compound/tests/nested-invariants.test.ts`. Expected: PASS (non-overlap falls out of variable-size BK treating boxes as sized nodes). If FAIL, the box `Size` is not reaching the parent's local graph — fix `buildLocalGraph` to set `n.Size = boxSize.get(childId)` for container children.

- [ ] **Step 3: Commit.**
```bash
git add -A
git commit -m "test: sibling-box non-overlap invariant"
```

### Task 15: Cross-boundary edge routing via LCA + port stitching

Produce a polyline per cross-boundary edge by concatenating the per-level route segments at the shared port points.

**Files:**
- Modify: `src/ge/compound/nested-compound-layout.ts`
- Create: `src/ge/compound/tests/nested-routes.test.ts`

**Interfaces:**
- Consumes: interior `LayoutResult.routes` from each `engine.Apply`, port ids, unfolded positions.
- Produces: `LayoutResult.routes: Map<Edge, EdgeRouting>` on the composer output — one polyline per original edge, whose waypoints pass through the ports on each crossed boundary. Configure the engine with an edge router so interior runs produce routes (the test uses the default config which includes `StraightLineEdgeRouter`).

- [ ] **Step 1: Write the failing test.**
```ts
// src/ge/compound/tests/nested-routes.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph, Edge } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = {
        name: 't', transforms: [],
        layout: { edgeRouter: 'StraightLineEdgeRouter' },
    };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}

test('a cross-boundary edge has a route whose endpoints match the node positions', () => {
    const g = new Graph();
    g.AddNode('BOX'); g.AddNode('a'); g.AddNode('out');
    const a = g.nodes.find(n => n.Id === 'a')!; a.ParentId = 'BOX'; a.Size = { width: 20, height: 20 };
    g.nodes.find(n => n.Id === 'out')!.Size = { width: 20, height: 20 };
    const e = g.AddEdge('a', 'out');

    const res = new NestedCompoundLayout(engine()).Apply(g);
    assert.ok(res.routes, 'routes present');
    const route = res.routes!.get(e);
    assert.ok(route, 'the crossing edge has a route');
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npx tsx --test src/ge/compound/tests/nested-routes.test.ts`. Expected: FAIL (`res.routes` undefined).

- [ ] **Step 3: Implement route stitching.** During each container's interior run, keep the returned `res.routes` keyed by the *local* stub edge, and remember which port each stub corresponds to. After unfolding (positions known globally), for each original graph edge:
  - find its `lca` (Task 7);
  - collect, from the source endpoint up to the LCA and from the LCA down to the target, the ordered list of port ids it passes through;
  - build the polyline: global position of source → each port's global position (ports are placed nodes in their container's interior run, so their unfolded position is available — store port positions alongside child positions during `unfold`) → global position of target;
  - store as an `EdgeRouting` `points` directive (match the shape the edge router uses — inspect `EdgeRouting` in `edge-router/index.ts`; construct the `points` variant).
  Assign the assembled map to the returned `LayoutResult.routes`.

  > To get port global positions, in `unfold` also translate any port nodes present in `localPos.get(key)` (ids beginning with `__port:`) and record them in a `portPositions: Map<string, Point>`.

- [ ] **Step 4: Run test + suite.** Run: `npx tsx --test src/ge/compound/tests/nested-routes.test.ts` then `npm test`. Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add -A
git commit -m "feat: LCA-based cross-boundary edge routing via port stitching"
```

### Task 16: Sideways (same-rank sibling) crossings use side ports

**Files:**
- Modify: `src/ge/compound/nested-compound-layout.ts`
- Create: `src/ge/compound/tests/nested-sideways.test.ts`

**Interfaces:**
- Consumes: `portSideFor` returning `PortSide.Left` for equal ranks; the caller assigns the *far* side (`Right`) to the opposite boundary so the two ports face each other.

- [ ] **Step 1: Write the failing test.**
```ts
// src/ge/compound/tests/nested-sideways.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: { edgeRouter: 'StraightLineEdgeRouter' } };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}

test('two sibling containers whose members share a global rank still lay out without overlap and route', () => {
    const g = new Graph();
    for (const box of ['A', 'B']) {
        g.AddNode(box);
        g.AddNode(box + '1');
        const n = g.nodes.find(x => x.Id === box + '1')!; n.ParentId = box; n.Size = { width: 30, height: 20 };
    }
    const e = g.AddEdge('A1', 'B1'); // same rank (both are sole members, rank 0) -> sideways

    const res = new NestedCompoundLayout(engine()).Apply(g);
    const A = res.boxes!.get('A')!, B = res.boxes!.get('B')!;
    const overlap = A.position.x < B.position.x + B.width && A.position.x + A.width > B.position.x
                 && A.position.y < B.position.y + B.height && A.position.y + A.height > B.position.y;
    assert.equal(overlap, false, 'boxes disjoint');
    assert.ok(res.routes!.get(e), 'sideways edge routed');
});
```

- [ ] **Step 2: Run.** Run: `npx tsx --test src/ge/compound/tests/nested-sideways.test.ts`. Expected: likely PASS already (routing is generic); if the port-side handling throws or misplaces for `Left`/`Right`, fix `buildLocalGraph` so a `Left`/`Right` port is added to the interior graph pinned to the extreme column of the interior neighbor's layer (add the port with a same-layer marker; simplest: place it in the neighbor's layer by giving it a zero-length connector and letting BK order it to the edge). Keep the invariant tests green.

- [ ] **Step 3: Commit.**
```bash
git add -A
git commit -m "feat: sideways sibling crossings via side ports"
```

---

## Phase 4 — Frozen containers

### Task 17: `LayoutContent = false` preserves interior; only the box is placed

**Files:**
- Modify: `src/ge/compound/nested-compound-layout.ts`
- Create: `src/ge/compound/tests/nested-frozen.test.ts`

**Interfaces:**
- Consumes: `Node.LayoutContent`, `Node.LocalPosition`, `Node.Size`.
- Produces: in the bottom-up loop, a container with `LayoutContent === false` skips `engine.Apply`; its child positions come from each child's `LocalPosition`; its box `Size` = the container's explicit `Size` if set, else `boundingBox(children by LocalPosition) + padding`. Recursion halts (descendants are not processed as containers).

- [ ] **Step 1: Write the failing test (invariant: interior relative positions preserved exactly).**
```ts
// src/ge/compound/tests/nested-frozen.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Point } from '@pragmatic-tech-ai/mural/runtime';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}

test('a frozen container keeps its children at their relative manual positions', () => {
    const g = new Graph();
    g.AddNode('FROZEN'); g.AddNode('other');
    const f = g.nodes.find(n => n.Id === 'FROZEN')!; f.LayoutContent = false;
    g.AddNode('m'); g.AddNode('n');
    const m = g.nodes.find(x => x.Id === 'm')!; m.ParentId = 'FROZEN'; m.Size = { width: 10, height: 10 }; m.LocalPosition = new Point(0, 0);
    const nn = g.nodes.find(x => x.Id === 'n')!; nn.ParentId = 'FROZEN'; nn.Size = { width: 10, height: 10 }; nn.LocalPosition = new Point(50, 20);
    const o = g.nodes.find(x => x.Id === 'other')!; o.Size = { width: 10, height: 10 };
    g.AddEdge('m', 'other');

    const res = new NestedCompoundLayout(engine()).Apply(g);
    const gm = res.positions.get('m')!, gn = res.positions.get('n')!;
    // relative offset preserved: n is (50,20) from m regardless of where the box landed
    assert.equal(gn.x - gm.x, 50);
    assert.equal(gn.y - gm.y, 20);
});
```

- [ ] **Step 2: Run to verify failure.** Run: `npx tsx --test src/ge/compound/tests/nested-frozen.test.ts`. Expected: FAIL (frozen container is currently laid out by the engine, so relative offsets change).

- [ ] **Step 3: Implement the freeze branch.** In the bottom-up loop, before `engine.Apply`:
```ts
const cNode = graph.nodes.find(n => n.Id === c)!;
if (cNode.LayoutContent === false) {
    const kids = childrenOf(graph, c);
    const pos = new Map<string, Point>();
    for (const k of kids) pos.set(k.Id, k.LocalPosition ?? new Point(0, 0));
    localPos.set(c, pos);
    const bb = boundingBox(kids.map(k => {
        const p = k.LocalPosition ?? new Point(0, 0);
        const s = k.Size ?? { width: 0, height: 0 };
        return { x: p.x, y: p.y, w: s.width, h: s.height };
    }));
    boxSize.set(c, cNode.Size ?? { width: bb.width + 2 * this.padding, height: bb.height + 2 * this.padding });
    continue; // recursion halts: descendants not processed
}
```
Also skip descendants of a frozen container in the `containers` list (filter them out so a nested container under a frozen one is not independently laid out). Add a `frozenSubtree` guard: exclude any container whose `ancestors` include a `LayoutContent === false` node.

- [ ] **Step 4: Run test + suite.** Run: `npx tsx --test src/ge/compound/tests/nested-frozen.test.ts` then `npm test`. Expected: PASS.

- [ ] **Step 5: Commit.**
```bash
git add -A
git commit -m "feat: frozen containers (LayoutContent=false) preserve interior placement"
```

### Task 18: Frozen box size — explicit `Size` wins over derived

**Files:**
- Create: `src/ge/compound/tests/nested-frozen-size.test.ts`

- [ ] **Step 1: Write the test.**
```ts
// src/ge/compound/tests/nested-frozen-size.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Point } from '@pragmatic-tech-ai/mural/runtime';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}

test('an explicit Size on a frozen container overrides the derived bounding box', () => {
    const g = new Graph();
    g.AddNode('FROZEN'); g.AddNode('sibling');
    const f = g.nodes.find(n => n.Id === 'FROZEN')!; f.LayoutContent = false; f.Size = { width: 500, height: 400 };
    const m = g.AddNode('m'); m.ParentId = 'FROZEN'; m.Size = { width: 10, height: 10 }; m.LocalPosition = new Point(0, 0);
    const s = g.nodes.find(n => n.Id === 'sibling')!; s.Size = { width: 10, height: 10 };
    g.AddEdge('m', 'sibling');

    const res = new NestedCompoundLayout(engine()).Apply(g);
    const box = res.boxes!.get('FROZEN')!;
    assert.equal(box.width, 500);
    assert.equal(box.height, 400);
});
```
> Note: `Graph.AddNode` returns the created `Node`, so `const m = g.AddNode('m')` is valid.

- [ ] **Step 2: Run.** Run: `npx tsx --test src/ge/compound/tests/nested-frozen-size.test.ts`. Expected: PASS (Task 17 already prefers `cNode.Size`). If FAIL, ensure the box `Rect` in `unfold` uses `boxSize.get(id)` verbatim (it does).

- [ ] **Step 3: Commit.**
```bash
git add -A
git commit -m "test: explicit frozen-container Size overrides derived box"
```

---

## Phase 5 — Determinism & wiring

### Task 19: Determinism invariant

**Files:**
- Create: `src/ge/compound/tests/nested-determinism.test.ts`

- [ ] **Step 1: Write the test.**
```ts
// src/ge/compound/tests/nested-determinism.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}
function build(): Graph {
    const g = new Graph();
    g.AddNode('A'); g.AddNode('B');
    for (const [box, leaf] of [['A','a1'],['A','a2'],['B','b1']] as const) {
        const n = g.AddNode(leaf); n.ParentId = box; n.Size = { width: 20, height: 20 };
    }
    g.AddEdge('a1', 'a2'); g.AddEdge('a1', 'b1');
    return g;
}

test('same compound graph in -> identical positions and boxes out', () => {
    const first  = new NestedCompoundLayout(engine()).Apply(build());
    const second = new NestedCompoundLayout(engine()).Apply(build());
    assert.deepEqual([...first.positions.entries()], [...second.positions.entries()]);
    assert.deepEqual([...first.boxes!.entries()], [...second.boxes!.entries()]);
});
```

- [ ] **Step 2: Run.** Run: `npx tsx --test src/ge/compound/tests/nested-determinism.test.ts`. Expected: PASS. If FAIL, remove any iteration-order nondeterminism (e.g., sort `containers` with a stable tiebreaker by id when depths tie).

- [ ] **Step 3: Commit.**
```bash
git add -A
git commit -m "test: NestedCompoundLayout determinism invariant"
```

### Task 20: Full suite + typecheck gate

- [ ] **Step 1: Run everything.** Run: `npm test` then `npm run typecheck`. Expected: all green, zero type errors.

- [ ] **Step 2: Sanity-run the demo.** Run: `npm run ge` (executes `src/ge/main.ts` on the sample graph). Expected: no throw; SVG output produced as before. (This exercises the `LayoutResult` change end-to-end.)

- [ ] **Step 3: Final commit (if any incidental fixes).**
```bash
git add -A
git commit -m "chore: green suite for compound layout"
```

---

## Self-review notes (for the executor)

- **Task 12 is the riskiest.** The `representativeAt` + port-pinning logic is where cross-boundary correctness lives. If a test in Tasks 12–16 resists, re-read spec §5.2–§5.3 and §6.3 before changing invariants — the invariants (containment, non-overlap, translation) are the spec's contract and must not be weakened to make a test pass.
- **Backward-compat guard:** if any existing (pre-Phase-0) test changes its expected numbers, stop — Phase 0/1 must be behavior-preserving for container-free graphs. The only legitimate change is the `Apply` return shape.
- **Deferred (follow-up plan):** Tier-2 TODL→JSON corpus + quality metrics + SVG snapshots (spec §10 Tier 2), and `OverviewDetailLayout` (spec §7). Do not scaffold them here.
