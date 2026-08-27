import { Point } from '@pragmatic-lab/mural/runtime';
import { Graph, Node } from '../graph.js';
import type { ILayout, LayoutResult } from '../layouts/layout.js';
import type { FlatLayoutPipeline } from '../layouts/flat-layout-pipeline.js';
import { boundingBox, type Rect, type Size } from '../geometry.js';
import { childrenOf, isContainer } from './hierarchy.js';

// In-place nested-container layout. Lays out each container's interior in
// isolation with the flat pipeline, sizes it into a box, and places boxes as
// sized nodes in their parent frame — recursively. Cross-boundary edges
// reduce to ports on container borders (added in later tasks).
//
// A graph with no containers is delegated straight to the flat engine, so
// this composer is a safe drop-in replacement.
export class NestedCompoundLayout implements ILayout
{
    constructor(
        private readonly engine: FlatLayoutPipeline,
        // Uniform margin reserved between a container's interior content and
        // its box border, on every side.
        private readonly padding: number = 40,
    ) {}

    public Apply(graph: Graph): LayoutResult
    {
        const anyContainer = graph.nodes.some(n => isContainer(graph, n.Id));
        if (!anyContainer) return this.engine.Apply(graph);

        // Box size per container, and each container's interior positions
        // (keyed by container id; '' for the root/top level).
        const boxSize  = new Map<string, Size>();
        const localPos = new Map<string, Map<string, Point>>();

        // --- Pass 1: size bottom-up (deepest containers first) ---
        const containers = graph.nodes
            .filter(n => isContainer(graph, n.Id))
            .map(n => n.Id)
            .sort((a, b) => this.depth(graph, b) - this.depth(graph, a) || a.localeCompare(b));

        for (const c of containers)
        {
            const local = this.buildLocalGraph(graph, c, boxSize);
            const res = this.engine.Apply(local);
            localPos.set(c, res.positions);
            boxSize.set(c, this.sizeFromInterior(local, res.positions));
        }

        // Root level (nodes/boxes with no parent).
        const rootLocal = this.buildLocalGraph(graph, undefined, boxSize);
        const rootRes = this.engine.Apply(rootLocal);
        localPos.set('', rootRes.positions);

        // --- Pass 2: place top-down by pure translation ---
        const positions = new Map<string, Point>();
        const boxes = new Map<string, Rect>();
        this.unfold(graph, undefined, new Point(0, 0), boxSize, localPos, positions, boxes);
        return { positions, boxes };
    }

    // A container's interior as a standalone Graph: its direct children as
    // sized nodes (a sub-container uses its already-computed box size), plus
    // the edges that stay within the container.
    private buildLocalGraph(
        graph:   Graph,
        containerId: string | undefined,
        boxSize: Map<string, Size>,
    ): Graph
    {
        const kids = childrenOf(graph, containerId);
        const kidIds = new Set(kids.map(k => k.Id));
        const nodes = kids.map(k =>
        {
            const n = new Node(k.Id, k.Label);
            n.Size = boxSize.get(k.Id) ?? k.Size ?? { width: 0, height: 0 };
            return n;
        });
        const edges = graph.edges.filter(e => kidIds.has(e.From) && kidIds.has(e.To));
        return new Graph(nodes, edges);
    }

    // Box size for a container = the extent of its laid-out interior plus the
    // uniform padding on every side.
    private sizeFromInterior(local: Graph, positions: Map<string, Point>): Size
    {
        const bb = boundingBox(local.nodes.map(n =>
        {
            const p = positions.get(n.Id)!;
            return { x: p.X, y: p.Y, w: n.Size!.width, h: n.Size!.height };
        }));
        return { width: bb.width + 2 * this.padding, height: bb.height + 2 * this.padding };
    }

    // Nesting depth of a node (0 for top level).
    private depth(graph: Graph, id: string): number
    {
        const byId = new Map(graph.nodes.map(n => [n.Id, n]));
        let d = 0, cur = byId.get(id)?.ParentId;
        while (cur !== undefined) { d++; cur = byId.get(cur)?.ParentId; }
        return d;
    }

    // Translate a container's local (interior-frame) child positions into
    // global space so the interior's bounding box top-left lands at
    // `interiorTopLeft`, then recurse into each child container.
    private unfold(
        graph:       Graph,
        containerId: string | undefined,
        interiorTopLeft: Point,
        boxSize:     Map<string, Size>,
        localPos:    Map<string, Map<string, Point>>,
        outPos:      Map<string, Point>,
        outBoxes:    Map<string, Rect>,
    ): void
    {
        const pos = localPos.get(containerId ?? '')!;
        const kids = childrenOf(graph, containerId);

        const bb = boundingBox(kids.map(k =>
        {
            const p = pos.get(k.Id)!;
            const s = boxSize.get(k.Id) ?? k.Size ?? { width: 0, height: 0 };
            return { x: p.X, y: p.Y, w: s.width, h: s.height };
        }));
        const dx = interiorTopLeft.X - bb.position.X;
        const dy = interiorTopLeft.Y - bb.position.Y;

        for (const k of kids)
        {
            const p = pos.get(k.Id)!;
            const gc = new Point(p.X + dx, p.Y + dy); // global center

            if (isContainer(graph, k.Id))
            {
                const s = boxSize.get(k.Id)!;
                const topLeft = new Point(gc.X - s.width / 2, gc.Y - s.height / 2);
                outBoxes.set(k.Id, { position: topLeft, width: s.width, height: s.height });
                this.unfold(
                    graph, k.Id,
                    new Point(topLeft.X + this.padding, topLeft.Y + this.padding),
                    boxSize, localPos, outPos, outBoxes,
                );
            }
            else
            {
                outPos.set(k.Id, gc);
            }
        }
    }
}
