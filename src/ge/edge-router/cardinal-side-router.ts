import type { Point } from '@pragmatic-tech-ai/mural/runtime';
import type { Edge } from '../graph.js';
import type { AcademicReference } from '../pipeline-element.js';
import type { EdgePorts } from '../port-assigner/index.js';
import { Side, type EdgeRouting, type IEdgeRouter } from './edge-router.js';

// Edge router that emits a cardinal SIDE per endpoint instead of a
// polyline — for host diagrams that do their own connector routing and
// port placement (e.g. mural's PortSide slot distribution). It reads the
// chain's real endpoints (first = source, last = target) and picks each
// side from the dominant axis of the source→target vector:
//
//   |dy| ≥ |dx|  (vertical dominant)
//        dy > 0  (target below)  → source S, target N   ← common in a
//                                                          layered DAG
//        dy < 0  (target above)  → source N, target S
//   |dx| > |dy|  (horizontal dominant)
//        dx > 0  (target right)  → source E, target W
//        dx < 0  (target left)   → source W, target E
//
// Needs no node radius or size — the host places the concrete point on
// the chosen side and fans parallel connectors into slots. `ports` is
// ignored (the host owns attachment points).
export class CardinalSideRouter implements IEdgeRouter
{
    public readonly Name               = 'Diagram (native)';
    public readonly AlgorithmName      = 'Dominant-axis cardinal sides for host-diagram routing';
    public readonly AcademicReferences: readonly AcademicReference[] = [];

    public Route(
        positions: Map<string, Point>,
        chains:    Map<Edge, string[]>,
        _ports?:   Map<Edge, EdgePorts>,
    ): Map<Edge, EdgeRouting>
    {
        const routes = new Map<Edge, EdgeRouting>();
        for (const [edge, chain] of chains)
        {
            if (chain.length < 2) continue;
            const u = positions.get(chain[0]!);
            const v = positions.get(chain[chain.length - 1]!);
            if (u === undefined || v === undefined) continue;

            const { source, target } = cardinalSides(u.X, u.Y, v.X, v.Y);
            routes.set(edge, { kind: 'sides', source, target });
        }
        return routes;
    }
}

// The source/target sides for an edge running from (ux, uy) to (vx, vy).
// Exported so hosts and tests can reuse the exact side decision.
export function cardinalSides(
    ux: number, uy: number, vx: number, vy: number,
): { source: Side; target: Side }
{
    const dx = vx - ux;
    const dy = vy - uy;

    if (dx === 0 && dy === 0)
    {
        // Coincident endpoints — degenerate. Default to a vertical link.
        return { source: Side.S, target: Side.N };
    }
    if (Math.abs(dy) >= Math.abs(dx))
    {
        return dy > 0
            ? { source: Side.S, target: Side.N }
            : { source: Side.N, target: Side.S };
    }
    return dx > 0
        ? { source: Side.E, target: Side.W }
        : { source: Side.W, target: Side.E };
}
