import { Edge, Graph } from '../graph.js';
import type { AcademicReference } from '../pipeline-element.js';
import type { IGraphTransform } from './graph-transform.js';

// Makes a directed graph acyclic so DAG-only layout stages (longest-path
// layer assignment, topological ordering) can run on cyclic input — such as
// an architecture diagram with feedback / bidirectional relationships, where
// the longest-path layer assigner otherwise throws "require a DAG".
//
// Two structure-only steps (node positions are untouched):
//   1. Self-loops (an edge from a node to itself) are DROPPED — a self-loop
//      is a 1-cycle that no reversal can break.
//   2. A feedback arc set is chosen by the Eades–Lin–Smyth greedy-sequence
//      heuristic: order the vertices so that most edges point "forward",
//      then REVERSE the few edges that still point backward. Reversing (not
//      deleting) preserves connectivity and node degree; the drawing simply
//      shows those edges pointing the other way, which is inherent to any
//      layered drawing of a cyclic graph.
//
// The heuristic runs in O(V + E) and is deterministic (ties broken by the
// node's original index), so repeated runs reverse the same edges. The
// output satisfies Graph.IsDirectedAcyclic().
export class MakeAcyclicTransform implements IGraphTransform
{
    public readonly Name          = 'Make Acyclic';
    public readonly AlgorithmName = 'Greedy feedback-arc-set (Eades–Lin–Smyth) with self-loop removal';
    public readonly AcademicReferences: readonly AcademicReference[] = [
        {
            authors: 'Eades, P., Lin, X., Smyth, W. F.',
            year: 1989,
            title: 'A fast and effective heuristic for the feedback arc set problem',
            venue: 'Information Processing Letters',
        },
    ];

    public Apply(graph: Graph): Graph
    {
        const order = this.greedySequence(graph);
        const rank = new Map<string, number>();
        order.forEach((id, i) => rank.set(id, i));

        const kept: Edge[] = [];
        for (const e of graph.edges)
        {
            if (e.From === e.To) continue;                  // drop self-loops (unbreakable 1-cycles)
            const a = rank.get(e.From);
            const b = rank.get(e.To);
            // Both endpoints are always ranked (every node is sequenced);
            // the guard is defensive against an edge naming an absent node.
            if (a === undefined || b === undefined) { kept.push(e); continue; }
            if (a < b) kept.push(e);                          // forward — keep as-is
            else kept.push(new Edge(e.To, e.From));           // backward — reverse to point forward
        }
        return new Graph(graph.nodes, kept);
    }

    // Eades–Lin–Smyth greedy vertex sequence. Repeatedly peel every current
    // sink (no outgoing edges) to the right side and every current source
    // (no incoming edges) to the left side; when neither exists, remove the
    // vertex with the largest (out-degree − in-degree) to the left. The
    // returned left-to-right order makes edges consistent with it "forward";
    // the remainder is the feedback set. Self-loops are ignored for degrees.
    private greedySequence(graph: Graph): string[]
    {
        const outAdj = new Map<string, string[]>();
        const inAdj  = new Map<string, string[]>();
        const outDeg = new Map<string, number>();
        const inDeg  = new Map<string, number>();
        for (const n of graph.nodes)
        {
            outAdj.set(n.Id, []); inAdj.set(n.Id, []);
            outDeg.set(n.Id, 0);  inDeg.set(n.Id, 0);
        }
        for (const e of graph.edges)
        {
            if (e.From === e.To) continue;                  // self-loops don't count toward degree
            if (!outAdj.has(e.From) || !inAdj.has(e.To)) continue;
            outAdj.get(e.From)!.push(e.To);
            inAdj.get(e.To)!.push(e.From);
            outDeg.set(e.From, outDeg.get(e.From)! + 1);
            inDeg.set(e.To,   inDeg.get(e.To)!   + 1);
        }

        const removed = new Set<string>();
        const left:  string[] = [];
        const right: string[] = [];

        const removeNode = (u: string): void => {
            removed.add(u);
            for (const v of outAdj.get(u) ?? []) { if (!removed.has(v)) inDeg.set(v,  inDeg.get(v)!  - 1); }
            for (const w of inAdj.get(u)  ?? []) { if (!removed.has(w)) outDeg.set(w, outDeg.get(w)! - 1); }
        };

        let remaining = graph.nodes.length;
        while (remaining > 0)
        {
            let progressed = false;
            // Peel current sinks to the right.
            for (const n of graph.nodes)
            {
                const u = n.Id;
                if (removed.has(u) || outDeg.get(u) !== 0) continue;
                right.push(u); removeNode(u); remaining--; progressed = true;
            }
            // Peel current sources to the left.
            for (const n of graph.nodes)
            {
                const u = n.Id;
                if (removed.has(u) || inDeg.get(u) !== 0) continue;
                left.push(u); removeNode(u); remaining--; progressed = true;
            }
            if (remaining === 0 || progressed) continue;

            // No source/sink left: cut the vertex with the largest out−in
            // delta, ties broken by original index (strict >, first wins).
            let best: string | undefined;
            let bestScore = -Infinity;
            for (const n of graph.nodes)
            {
                const u = n.Id;
                if (removed.has(u)) continue;
                const score = outDeg.get(u)! - inDeg.get(u)!;
                if (score > bestScore) { bestScore = score; best = u; }
            }
            if (best === undefined) break;                  // safety — unreachable while remaining > 0
            left.push(best); removeNode(best); remaining--;
        }

        // s = s1 ++ reverse(s2): sinks were appended in removal order but the
        // heuristic prepends them, so reversing recovers that order.
        right.reverse();
        return [...left, ...right];
    }
}
