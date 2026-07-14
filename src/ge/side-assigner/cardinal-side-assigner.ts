import type { Point } from '@pragmatic-lab/mural/runtime';
import type { Edge } from '../graph.js';
import type { AcademicReference } from '../pipeline-element.js';
import { Side, type EdgeSides, type ISideAssigner } from './side-assigner.js';

// Picks a cardinal side for each edge endpoint from the dominant axis
// of the source→target vector, and returns the opposite side for the
// target. Unlike the point-based assigners this needs no node radius
// or size — the diagram places the concrete point on the chosen side.
//
//   |dy| ≥ |dx|  (vertical dominant)
//        dy > 0  (target below)  → source S, target N   ← the common
//                                                          layered-DAG case
//        dy < 0  (target above)  → source N, target S
//   |dx| > |dy|  (horizontal dominant)
//        dx > 0  (target right)  → source E, target W
//        dx < 0  (target left)   → source W, target E
//
// Multiple edges that resolve to the same (node, side) are left to the
// diagram to fan out into slots along that side — this assigner emits
// only the side decision, never a per-edge offset.
export class CardinalSideAssigner implements ISideAssigner
{
    public readonly Name               = 'Cardinal Sides';
    public readonly AlgorithmName      = 'Dominant-axis cardinal side selection';
    public readonly AcademicReferences: readonly AcademicReference[] = [];

    public AssignSides(positions: Map<string, Point>, edges: Edge[]): Map<Edge, EdgeSides>
    {
        const sides = new Map<Edge, EdgeSides>();
        for (const e of edges)
        {
            const u = positions.get(e.From);
            const v = positions.get(e.To);
            if (u === undefined || v === undefined) continue;

            const dx = v.X - u.X;
            const dy = v.Y - u.Y;

            let source: Side;
            let target: Side;

            if (dx === 0 && dy === 0)
            {
                // Coincident endpoints — degenerate. Default to a
                // vertical attachment so the pair still reads as a
                // top→bottom link.
                source = Side.S;
                target = Side.N;
            }
            else if (Math.abs(dy) >= Math.abs(dx))
            {
                if (dy > 0) { source = Side.S; target = Side.N; }
                else        { source = Side.N; target = Side.S; }
            }
            else
            {
                if (dx > 0) { source = Side.E; target = Side.W; }
                else        { source = Side.W; target = Side.E; }
            }

            sides.set(e, { source, target });
        }
        return sides;
    }
}
