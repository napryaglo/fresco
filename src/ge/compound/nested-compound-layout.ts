import { Point } from '@pragmatic-lab/mural/runtime';
import { Graph, Node, Edge } from '../graph.js';
import type { ILayout, LayoutResult } from '../layouts/layout.js';
import type { FlatLayoutPipeline } from '../layouts/flat-layout-pipeline.js';
import { boundingBox, type Rect, type Size } from '../geometry.js';
import { childrenOf, isContainer } from './hierarchy.js';
import { globalRank, portSideFor } from './orientation.js';
import { PortSide, portId } from './port.js';

// A port minted for a boundary-crossing edge during a container's interior
// run: its synthetic node id, the original edge, the border it sits on, and
// the interior child it stubs to. Recorded so later routing can stitch the
// edge through it.
interface PortRec { id: string; edge: Edge; side: PortSide; interior: string }

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
        // Ports minted per container, for later cross-boundary routing.
        const portMeta = new Map<string, PortRec[]>();

        // One flat rank orients every port (which border it exits).
        const rank = globalRank(graph);

        // --- Pass 1: size bottom-up (deepest containers first) ---
        const containers = graph.nodes
            .filter(n => isContainer(graph, n.Id))
            .map(n => n.Id)
            .sort((a, b) => this.depth(graph, b) - this.depth(graph, a) || a.localeCompare(b));

        for (const c of containers)
        {
            const local = this.buildLocalGraph(graph, c, boxSize, rank, portMeta);
            const res = this.engine.Apply(local);
            localPos.set(c, res.positions);
            boxSize.set(c, this.sizeFromInterior(local, res.positions));
        }

        // Root level (nodes/boxes with no parent).
        const rootLocal = this.buildLocalGraph(graph, undefined, boxSize, rank, portMeta);
        const rootRes = this.engine.Apply(rootLocal);
        localPos.set('', rootRes.positions);

        // --- Pass 2: place top-down by pure translation ---
        const positions = new Map<string, Point>();
        const boxes = new Map<string, Rect>();
        this.unfold(graph, undefined, new Point(0, 0), boxSize, localPos, positions, boxes);
        return { positions, boxes };
    }

    // A container's interior as a standalone Graph. Each graph edge is
    // rewritten to this level's representatives (the ancestor of each
    // endpoint that is a direct child of the container):
    //   * both inside, distinct → an intra-level edge between the two
    //     representatives (leaf↔leaf, leaf↔box, or box↔box);
    //   * both inside the same child → skip (routed one level deeper);
    //   * exactly one inside → the edge crosses the border: mint a PORT on
    //     the appropriate side and stub the interior representative to it;
    //   * neither inside → the edge does not touch this container → skip.
    private buildLocalGraph(
        graph:       Graph,
        containerId: string | undefined,
        boxSize:     Map<string, Size>,
        rank:        Map<string, number>,
        portMeta:    Map<string, PortRec[]>,
    ): Graph
    {
        const kids = childrenOf(graph, containerId);
        const nodes = kids.map(k =>
        {
            const n = new Node(k.Id, k.Label);
            n.Size = boxSize.get(k.Id) ?? k.Size ?? { width: 0, height: 0 };
            return n;
        });

        const edges: Edge[] = [];
        const seen = new Set<string>();
        const ports: PortRec[] = [];

        for (const e of graph.edges)
        {
            const repFrom = this.representativeAt(graph, e.From, containerId);
            const repTo   = this.representativeAt(graph, e.To,   containerId);

            if (repFrom !== undefined && repTo !== undefined)
            {
                if (repFrom === repTo) continue; // internal to one child subtree
                const key = `${repFrom}->${repTo}`;
                if (!seen.has(key)) { seen.add(key); edges.push(new Edge(repFrom, repTo)); }
            }
            else if (repFrom !== undefined)
            {
                // Edge leaves this container (source side inside).
                this.addPort(nodes, edges, ports, containerId, e, repFrom,
                    portSideFor(rank.get(e.From) ?? 0, rank.get(e.To) ?? 0));
            }
            else if (repTo !== undefined)
            {
                // Edge enters this container (target side inside).
                this.addPort(nodes, edges, ports, containerId, e, repTo,
                    portSideFor(rank.get(e.To) ?? 0, rank.get(e.From) ?? 0));
            }
            // else: neither endpoint is inside — edge irrelevant to this level.
        }

        portMeta.set(containerId ?? '', ports);
        return new Graph(nodes, edges);
    }

    // Mint a zero-size port node on `side` and stub the interior node to it so
    // longest-path layering pins it into the right band: Top ⇒ port above the
    // interior node, otherwise ⇒ port below. (Side ports are refined later.)
    private addPort(
        nodes: Node[], edges: Edge[], ports: PortRec[],
        containerId: string | undefined, edge: Edge, interior: string, side: PortSide,
    ): void
    {
        const id = portId(containerId ?? '', edge, side);
        const port = new Node(id);
        port.Size = { width: 0, height: 0 };
        nodes.push(port);
        if (side === PortSide.Top) edges.push(new Edge(id, interior));
        else edges.push(new Edge(interior, id));
        ports.push({ id, edge, side, interior });
    }

    // The ancestor of `nodeId` that is a direct child of `containerId` (or
    // `nodeId` itself when it is already a direct child). Undefined when
    // `nodeId` is not inside `containerId`'s subtree.
    private representativeAt(graph: Graph, nodeId: string, containerId: string | undefined): string | undefined
    {
        const byId = new Map(graph.nodes.map(n => [n.Id, n]));
        let cur: string | undefined = nodeId;
        while (cur !== undefined)
        {
            const parent: string | undefined = byId.get(cur)?.ParentId;
            if (parent === containerId) return cur;
            cur = parent;
        }
        return undefined;
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
