# Compound (Container) Layout — Design

- **Date:** 2026-08-27
- **Status:** Approved design; implementation plan to follow
- **Scope:** Full scope (no reduced v1)

## 1. Motivation

Fresco today lays out **flat** directed graphs with a Sugiyama-style
pipeline. We want to draw **compound graphs**: nodes may be grouped into
*containers*, containers may contain other containers to arbitrary depth,
and edges may connect any two nodes regardless of containment. Containers
are drawn as boxes around their members ("in-place" nesting), and — as a
later, foundation-sharing effort — optionally as an overview+detail layout
(collapsed nodes with expanded detail frames placed nearby).

Sibling containers are disjoint, so the containment structure is a **tree**.

## 2. Requirements & decisions

Settled during design:

- **Containment shape:** nested, arbitrary depth. Sibling containers
  disjoint (tree-shaped hierarchy).
- **Cross-boundary edges:** allowed freely — any node may connect to any
  node irrespective of containment.
- **Composition model:** **port-based isolation** is the shared substrate.
  Each container's interior is laid out independently; cross-boundary edges
  are reduced to *ports* on the container border. This is Approach A from the
  design discussion (opposed to the fully-integrated global crossing-min of
  Approach C).
  - Chosen because it yields a clean shared foundation that supports *both*
    the in-place metaphor and the overview+detail metaphor from Han et al.,
    "An Overview+Detail Layout for Visualizing Compound Graphs" (2024).
  - **Accepted cost:** positioning stays per-level, so a cross-level edge's
    horizontal placement is not globally optimized and may be longer / bend
    more than a fully-integrated layout would produce. This is the price of
    isolation. The reference paper accepts the same cost (its future-work
    note on long edges when a parent group is large).
- **Two composers, built in order:** `NestedCompoundLayout` (in-place) first;
  `OverviewDetailLayout` later, reusing the entire foundation.
- **Frozen containers:** a container may declare that its content is already
  placed (manually) and must not be re-laid-out; only the container's own
  position among its siblings is computed.

Out of scope (named so it is not discovered later as a surprise):

- **Per-child pinning** inside an otherwise-laid-out container. The freeze
  flag is container-level (freezes the whole content subtree). Mixed
  "pin these nodes, lay out the rest" is a separate, finer-grained effort.
- **Global cross-boundary crossing minimization** (Approach C). Deliberately
  given up in exchange for isolation.

## 3. Architecture

Three top-level `ILayout` implementations, all returning the same result
type. The existing flat pipeline is one of them; the two new ones are thin
recursive **composers** over a shared foundation. Neither composer
re-implements any layered-graph stage — the entire Sugiyama chain is reused
wholesale, invoked once per container.

```
                        (pick one — all three are ILayout)
   ┌────────────────────┬─────────────────────────┬──────────────────────────┐
   │ FlatLayoutPipeline  │ NestedCompoundLayout     │ OverviewDetailLayout     │
   │ (exists, flat)      │ (new, in-place boxes)    │ (later, satellite frames)│
   │                     │  recursion + in-place    │  recursion + Flexible-RT │
   │                     │  box placement           │  tree arrangement        │
   └─────────────────────┴───────────┬──────────────┴────────────┬────────────┘
                                      │  both call, per container: │
                        ┌─────────────▼────────────────────────────▼───────────┐
                        │  "lay out ONE container in isolation" (shared wrapper) │
                        │      runs the existing FlatLayoutPipeline unchanged     │
                        │      on the container interior, ports as boundary nodes │
                        └──────────────────────────┬─────────────────────────────┘
                                                   │
                        ┌──────────────────────────▼─────────────────────────────┐
                        │  SHARED FOUNDATION                                       │
                        │   • hierarchy on Graph (parent link)                     │
                        │   • ports on container boundaries                        │
                        │   • global orientation pass (flow direction only)        │
                        │   • variable-size position computer                       │
                        │   • the existing Sugiyama stages, unchanged              │
                        └──────────────────────────────────────────────────────────┘
```

## 4. Phase 0 — Seam cleanup

Two purely-mechanical changes that the rest of the design builds on. No
container behavior yet; flat graphs render identically afterward.

### 4.1 Rename `LayoutPipeline` → `FlatLayoutPipeline`

The name earns "Pipeline" because it is a linear stage chain; the two new
composers are recursive, so they are named `NestedCompoundLayout` /
`OverviewDetailLayout` (no "Pipeline") — the asymmetry is intentional.

Blast radius (verified):

- `src/ge/layouts/layout-pipeline.ts` → `flat-layout-pipeline.ts`, class
  `LayoutPipeline` → `FlatLayoutPipeline`.
- export in `src/ge/layouts/index.ts`.
- construction site + comments in `src/ge/configuration-loader.ts`
  (built in `BuildPipeline`; **not** a user-selectable stage, so no registry
  entry changes and no JSON strategy-name changes).
- one comment each in `src/ge/pipeline-catalog.ts` and the `comment` field
  of `src/ge/pipeline-configurations.json`.
- No test references, no JSON strategy-data references.

### 4.2 Single structured output — change the `ILayout` contract

Today `ILayout.Apply` returns `Map<string, Point>`, and `FlatLayoutPipeline`
exposes `LastRoutes` / `LastCrossings` as mutable side-channel fields.
Replace both with a single returned result (pure `Apply`, no mutable state):

```ts
interface LayoutResult {
    positions:  Map<string, Point>;              // every real node (required)
    routes?:    Map<Edge, EdgeRouting>;          // was LastRoutes
    boxes?:     Map<string, Rect>;               // container id → rectangle (compound layouts only)
    crossings?: {                                // was LastCrossings (diagnostics)
        adjacentBefore:  number; adjacentAfter:  number;
        geometricBefore: number; geometricAfter: number;
    };
}
```

`Apply(graph): LayoutResult`. Blast radius (verified): four implementers
(`FlatLayoutPipeline`, `CircularLayout`, `GridLayout`, `ManualLayout`) and
two consumers (`src/ge/main.ts`, one config-loader test). Flat/circular/grid/
manual leave `boxes` undefined. `IGraphTransform.Apply` is a different
interface and is untouched.

## 5. Shared foundation

### 5.1 Hierarchy on the graph

`Node` gains an optional parent link so containment is expressible without
disturbing flat graphs:

- `Node.ParentId?: string` — the container this node belongs to; absent for
  top-level nodes. A container is simply a `Node` that other nodes name as
  parent (no separate class).
- `Node.Size?: Size` — intrinsic width/height. Required by the variable-size
  position computer (§5.4). Plain nodes default to the current uniform size.
- `Node.LocalPosition?: Point` — pre-placed position within the parent frame;
  read only for frozen containers' children (§8).
- `Node.LayoutContent?: boolean` (default `true`) — the freeze flag (§8).

With no parent links present, a `Graph` is exactly what it is today, so
`FlatLayoutPipeline` and every existing transform keep working unchanged.
The hierarchy is a tree (sibling containers disjoint).

### 5.2 Ports

A cross-boundary edge is **not** connected interior-node → exterior-node
during layout. At each container boundary it crosses, it is split at a
**port** on that boundary. The interior layout of a container knows only
that a port exists on a given border — never where the far endpoint sits.
That is the isolation guarantee: a container's interior layout depends on
nothing outside it except the *direction* its crossing edges leave.

Ports are ephemeral boundary nodes that exist only during a container's
interior layout run (conceptually like dummy nodes — real to the interior
Sugiyama pass, invisible in the final model).

**Port side is an enum, not a string union:**

```ts
enum PortSide { Top, Bottom, Left, Right }
```

- **Top (in-ports)** / **Bottom (out-ports):** edges flowing with/against the
  layer direction. Live in synthetic layers above layer 0 / below the last
  layer, so the interior crossing-minimization orders them and assigns each an
  x — that x is the pierce point. In-set and out-set cannot interleave
  (structural; no explicit separators needed).
- **Left / Right (side-ports):** same-rank sibling crossings. Pin to the
  extreme column of their interior neighbor's layer, so their vertical
  position tracks the flow.

Multiple ports per border are supported and assigned/ordered by the interior
run. **Bundling is in scope:** edges sharing an endpoint or a destination box
collapse onto a shared port.

### 5.3 Global orientation pass

To decide which border a port sits on — and to keep a container's interior
flowing the same top-to-bottom direction as its parent — there must be one
consistent notion of "up/down" across all levels.

- **What it does:** before the recursion, run **one** layering on the
  *flattened* graph (all real nodes, containers ignored — reuse
  `LongestPathLayerAssigner` on the flat edge set) to produce a global rank
  per node. Port-side decisions read from it: crossing edge to a lower global
  rank → Bottom port; higher → Top port; same rank band → Left/Right.
- **What it is NOT:** it does not position anything. Every container is still
  laid out in isolation in its own frame; boxes still unfold by pure
  translation; both composers still work. Global layering is borrowed for
  **orientation only**, never for coordinates. Cheap: one longest-path pass
  over an already-available graph.

### 5.4 Variable-size position computer (the load-bearing stage change)

A sub-container box is far wider and taller than a plain node, but
`BrandesKopfPositionComputer` today uses a **uniform** `nodeSpacingX` and a
**uniform** `layerSpacingY`. The container interior runs cannot work until BK
honors size:

- **Per-node width:** horizontal separation becomes
  `halfWidth(u) + gap + halfWidth(v)` instead of the constant `delta`. Touches
  the two `delta` sites in `placeBlock`.
- **Per-layer height:** each layer's Y-band is sized to its tallest node,
  replacing the constant `layerSpacingY`.

This is the single biggest new algorithmic change to an existing stage. It is
**shared** — both composers need it. With widths/heights defaulting to today's
constants, flat graphs render identically (regression-safe).

**A simplification falls out of isolation:** no special group-separation
constraints are needed in BK. A container is just a wide/tall node in its
parent, so non-overlap and padding are handled by ordinary variable-size
separation. One mechanism, not two. (This is the part that would have been
painful in the integrated Approach C.)

## 6. `NestedCompoundLayout` (in-place composer)

Two recursive passes: **size going up, place going down.**

### 6.1 Pass 1 — bottom-up sizing

Walk the hierarchy from the deepest containers outward. For each container,
build a **local graph** and lay it out in isolation:

- nodes = the container's *direct* children — plain nodes at their intrinsic
  `Size`, and any sub-container as a single node whose size is the box already
  computed for it one level down;
- plus one **port** per crossing edge, on the border chosen by the global
  orientation rank (§5.3), placed in the appropriate synthetic layer / extreme
  column (§5.2);
- edges = intra-container edges among the direct children, plus a stub from
  each child to the port its crossing edge exits through.

Run `FlatLayoutPipeline` on that local graph. The bounding box of the result +
padding is the container's box size. The ports' final positions become the
attach points on the border. Recurse up to the root.

### 6.2 Pass 2 — top-down unfolding

The root run places every top-level node and box in the global frame. Because
interiors were laid out in isolation, unfolding a box is a **pure
translation**: shift the container's local positions by where its box landed.
No re-layout, no overlap checks — a box was a single node in its parent, so it
cannot overlap siblings, and its contents fit inside it by construction.
Recurse down until every real node has global coordinates.

### 6.3 Cross-boundary routing — LCA ownership

Every edge is **owned at the lowest-common-ancestor (LCA) level** of its two
endpoints. At that level both endpoints are visible as siblings — directly if
direct children, or via a port on whichever child-box contains them — and that
level's interior run routes that segment in its configured style. Deeper runs
route the endpoint → border-port stubs. Unfolding concatenates the
sub-polylines at the shared port points into one polyline per edge. No
cross-level routing, no re-routing — pure bookkeeping.

The LCA walk is also what *generates* the ports: for each edge, walk from each
endpoint up to the LCA; every container boundary crossed gets one port (subject
to bundling).

### 6.4 Output

`NestedCompoundLayout.Apply` returns a `LayoutResult` with `positions` (all
real nodes, global coordinates), `routes` (concatenated cross-boundary
polylines + intra-container routes), and `boxes` (one `Rect` per container).

## 7. `OverviewDetailLayout` (later effort)

Reuses the entire foundation (hierarchy, ports, isolation wrapper, global
orientation, variable-size BK). The only difference from `NestedCompoundLayout`
is **box placement**: instead of nesting a container's box in place inside its
parent's coordinate frame, it keeps the collapsed representation in the overview
and places the expanded detail frame *adjacent* to it, arranging all frames with
a **Flexible Reingold–Tilford** non-layered tidy-tree layout (van der Ploeg
2014), per Han et al. (2024).

This is the one genuinely-new *algorithm* in the whole effort (a non-layered
tidy-tree layout does not exist in Fresco today). It is out of scope for the
first implementation but the design keeps its foundation shared so it is an
additive composer, not a rewrite.

## 8. Frozen containers (`LayoutContent = false`)

A container may declare `LayoutContent = false` to mean "my content is already
placed; do not re-lay-it-out." Only the container's position among its siblings
is computed.

- **Pass 1 (size-up): recursion halts at a frozen container — it is a leaf.**
  Skip the interior `FlatLayoutPipeline` run entirely. Instead:
  - **positions** come from the subtree's existing `LocalPosition`s (of any
    depth), used as-is;
  - **box size** = the container's explicit `Size` if set, otherwise the
    bounding box of the frozen children + padding (same rule as a normal
    container, measured over given positions);
  - **ports** are still generated for crossing edges, but each port's pierce
    point is derived deterministically from the frozen geometry (projected from
    the fixed interior endpoint onto the crossed border) instead of from a
    crossing-minimization run.
- **Pass 2 (place-down): identical.** A frozen container is a sized box like
  any other, placed by its parent's run and unfolded by pure translation. The
  parent neither knows nor cares that the interior was frozen.

The feature lives entirely in Pass 1's "size a container" step as a branch:
*frozen → derive from given; not frozen → run the pipeline.* It composes for
free with `OverviewDetailLayout`, and because recursion halts at a frozen node,
a manually-arranged subtree of any depth is preserved wholesale at zero layout
cost.

## 9. Data-model change summary

`Node` gains (all optional, all backward-compatible with flat graphs):

| Field | Type | Purpose |
|---|---|---|
| `ParentId` | `string?` | containment link (§5.1) |
| `Size` | `Size?` | intrinsic node size for variable-size BK (§5.4) |
| `LocalPosition` | `Point?` | pre-placed position, read for frozen content (§8) |
| `LayoutContent` | `boolean?` (default `true`) | freeze flag (§8) |

No change to `Edge`. `Graph` stays a flat list of nodes/edges; containment is
expressed by `ParentId`, so existing construction and transforms are unaffected.

Two small value types are introduced (Fresco imports only `Point` from
`mural/runtime` today): `Size` = `{ width: number; height: number }` and
`Rect` = `{ position: Point; width: number; height: number }`. `Rect` is used
by `LayoutResult.boxes` (§4.2); `Size` by `Node.Size`. Whether these live in
Fresco or are re-exported from `mural/runtime` is an implementation-plan
detail.

## 10. Testing strategy

Per project convention, every test file lives in a `tests/` subfolder next to
the source it exercises.

- **Phase 0 regression:** existing flat-graph layouts produce byte-identical
  positions after the rename and the `LayoutResult` change (defaults reproduce
  current spacing).
- **Variable-size BK:** unit tests for per-pair width separation and per-layer
  height; a uniform-size graph must match the pre-change output.
- **Foundation:** hierarchy parsing; port generation from LCA walks; global
  orientation rank on mixed graphs.
- **`NestedCompoundLayout`:** single container; nested containers (≥3 deep);
  cross-boundary edges (up, down, sideways siblings); bundling; box sizing +
  padding; unfolding correctness (interior fits inside box; no sibling overlap).
- **Frozen containers:** interior preserved exactly; box derived vs explicit
  `Size`; ports still generated; nested-frozen halts recursion.
- **Determinism:** same graph in → same `LayoutResult` out (`ILayout` purity).

## 11. Risks & residual costs

- **Cross-level edge quality (accepted):** per-level positioning means some
  cross-boundary edges are longer / bend more than a globally-integrated layout
  would produce. Inherent to isolation; named here so it is not treated as a
  bug later.
- **Variable-size BK is the correctness lynchpin.** If per-node width / per-layer
  height is wrong, every container box is wrong. Land and test it first, in
  isolation, before any composer work.
- **Port-side classification for sideways edges** depends on the global
  orientation rank; degenerate graphs (cycles, disconnected components) must
  still yield a usable rank (longest-path already handles acyclic; rely on the
  existing `MakeAcyclicTransform` upstream).

## 12. Suggested build order

1. **Phase 0** — rename + `LayoutResult` (mechanical, regression-guarded).
2. **Variable-size position computer** — BK width/height, uniform-size
   regression test.
3. **Foundation** — hierarchy model, ports (+ `PortSide` enum), global
   orientation pass, isolation wrapper.
4. **`NestedCompoundLayout`** — size-up / place-down, LCA routing, full-scope
   four-border ports + bundling, `boxes` output.
5. **Frozen containers** — the Pass-1 branch.
6. **`OverviewDetailLayout`** — Flexible-RT arranger (separate later effort).
