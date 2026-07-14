import type { Point } from '@pragmatic-lab/mural/runtime';
import type { Edge } from '../graph.js';
import type { EdgePorts } from '../port-assigner/index.js';
import type { IPipelineElement } from '../pipeline-element.js';

// Cardinal side of a node's bounding box. Used by routers that defer the
// concrete attachment point to a host diagram (see CardinalSideRouter)
// instead of producing Fresco polyline points. Values are chosen to be
// byte-identical to a typical host PortSide enum ('N'/'S'/'E'/'W'), so a
// side passes straight through to a connector endpoint without a lookup.
export enum Side
{
    N = 'N',   // top
    S = 'S',   // bottom
    E = 'E',   // right
    W = 'W',   // left
}

// One edge's routing directive — the output of the edge-router stage.
// A router produces EITHER concrete polyline waypoints (Fresco renders
// them) OR a pair of cardinal sides (the host diagram owns the actual
// attachment points and the fan-out of parallel connectors).
export type EdgeRouting =
    | { kind: 'points'; waypoints: Point[] }
    | { kind: 'sides';  source: Side; target: Side };

// Strategy interface for the EDGE ROUTING stage — the final step that
// decides how each original edge is drawn. Runs after position
// computation + vertical alignment; receives positions for ALL nodes
// (real + dummies) so a point router can route multi-layer edges through
// their dummy chain.
//
// Contract:
//   * Input position map contains real-node AND dummy positions.
//   * `chains` is the edge → node-Id-chain map produced by the dummy
//     inserter. For a span-1 edge the chain is `[u, v]`; for a span-k
//     edge it is `[u, d1, …, dk-1, v]`. The first and last entries are
//     always the real source / target node ids.
//   * `ports`, when provided, supplies source / target boundary points a
//     POINT router substitutes for the chain's first / last waypoint.
//     Side routers ignore `ports` — the host diagram places the points.
//   * Returned map keys are the original (real-graph) edges. Each value
//     is an EdgeRouting: a `points` polyline (2+ waypoints, in the input
//     coord space) or a `sides` directive.
export interface IEdgeRouter extends IPipelineElement
{
    Route(
        positions: Map<string, Point>,
        chains:    Map<Edge, string[]>,
        ports?:    Map<Edge, EdgePorts>,
    ): Map<Edge, EdgeRouting>;
}
