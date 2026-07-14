import type { Point } from '@pragmatic-lab/mural/runtime';
import type { Edge } from '../graph.js';
import type { IPipelineElement } from '../pipeline-element.js';

// Cardinal side of a node's bounding box. Values are chosen to be
// byte-identical to the host diagram's PortSide enum (mural's
// PortSide.N/S/E/W = 'N'/'S'/'E'/'W'), so a side produced here can be
// handed straight to a connector endpoint's PortSide without a lookup
// table — the diagram then owns the actual attachment point and the
// distribution of parallel connectors along that side.
export enum Side
{
    N = 'N',   // top
    S = 'S',   // bottom
    E = 'E',   // right
    W = 'W',   // left
}

// The side each end of an edge leaves / enters.
export interface EdgeSides
{
    source: Side;
    target: Side;
}

// Strategy interface for SIDE assignment — the boundary-agnostic
// sibling of IPortAssigner. Where a port assigner projects each edge
// endpoint onto a concrete (x, y) boundary point (for Fresco's own
// edge router), a side assigner only decides WHICH SIDE of each node
// the edge attaches to and defers the exact point (and the fan-out of
// parallel connectors on a side) to the consuming diagram's automatic
// port assignment.
//
// Contract:
//   * Input position map contains node positions (real nodes only is
//     sufficient — edge endpoints are always real nodes).
//   * Returned map keys are the original edges.
//   * source is the side of e.From facing e.To; target is the side of
//     e.To facing e.From.
export interface ISideAssigner extends IPipelineElement
{
    AssignSides(positions: Map<string, Point>, edges: Edge[]): Map<Edge, EdgeSides>;
}
