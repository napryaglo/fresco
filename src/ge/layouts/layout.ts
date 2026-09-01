import type { Point } from '@pragmatic-tech-ai/mural/runtime';
import type { Graph, Edge } from '../graph.js';
import type { Rect } from '../geometry.js';
import type { EdgeRouting } from '../edge-router/index.js';

// The structured result of a layout run. `positions` is required (one
// entry per real node); the rest are optional and populated only by the
// layouts that produce them:
//   * routes  — one routing directive per real edge (was the flat
//               pipeline's `LastRoutes` side-channel).
//   * boxes   — one rectangle per container (compound layouts only).
//   * crossings — before/after crossing diagnostics (was `LastCrossings`).
export interface LayoutResult
{
    positions:  Map<string, Point>;
    routes?:    Map<Edge, EdgeRouting>;
    boxes?:     Map<string, Rect>;
    crossings?: {
        adjacentBefore:  number;
        adjacentAfter:   number;
        geometricBefore: number;
        geometricAfter:  number;
    };
}

// A Layout converts graph topology into a LayoutResult. The scene builder
// reads `positions` (keyed by Node.Id) when constructing NodeVisuals and
// EdgeVisuals; `routes`/`boxes` drive edge polylines and container boxes.
//
// Layouts are pure: same Graph in, same LayoutResult out. Stateful
// algorithms (force-directed simulation, layered DAG flow) can still
// implement this by running the simulation in Apply and returning the
// final result.
export interface ILayout
{
    Apply(graph: Graph): LayoutResult;
}
