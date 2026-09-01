import { Point } from '@pragmatic-tech-ai/mural/runtime';
import { Graph, Node, Edge } from '../graph.js';
import type { ILayout, LayoutResult } from '../layouts/layout.js';
import type { FlatLayoutPipeline } from '../layouts/flat-layout-pipeline.js';
import { boundingBox, type Rect, type Size } from '../geometry.js';
import type { EdgeRouting } from '../edge-router/index.js';
import { childrenOf, isContainer, ancestors, lca } from './hierarchy.js';

// In-place nested-container layout. Lays out each container's interior in
// isolation with the flat pipeline, sizes it into a box, and places boxes as
// sized nodes in their parent frame — recursively.
//
// Ports are NOT layout nodes: they never enter a container's interior
// Sugiyama run, so a box reserves no synthetic layer for them and its
// interior stays centred. Instead, once every real node and box has a global
// position, each boundary-crossing edge is routed through PIERCE POINTS
// computed geometrically on the borders it crosses — on whichever side faces
// the continuation (top/bottom for vertical flow, left/right for sideways).
// This makes frozen containers mint ports for free (they need only positions
// and boxes) and is the same for every border.
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

        const boxSize  = new Map<string, Size>();
        const localPos = new Map<string, Map<string, Point>>();

        // --- Pass 1: size bottom-up (deepest containers first) ---
        // A frozen container (LayoutContent === false) halts recursion: its
        // whole subtree is sized from the manual LocalPositions, and its
        // descendant containers are NOT laid out independently.
        const frozen = (id: string): boolean =>
            graph.nodes.find(n => n.Id === id)?.LayoutContent === false;
        const insideFrozen = (id: string): boolean => ancestors(graph, id).some(frozen);

        const containers = graph.nodes
            .filter(n => isContainer(graph, n.Id) && !insideFrozen(n.Id))
            .map(n => n.Id)
            .sort((a, b) => this.depth(graph, b) - this.depth(graph, a) || a.localeCompare(b));

        for (const c of containers)
        {
            if (frozen(c))
            {
                this.freezeSubtree(graph, c, boxSize, localPos);
                continue;
            }
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

        // --- Cross-boundary routing: geometric pierce points ---
        const routes = this.routeEdges(graph, positions, boxes);
        return { positions, boxes, routes };
    }

    // A container's interior as a standalone Graph: its direct children as
    // sized nodes (a sub-container uses its already-computed box size), and
    // one edge per pair of DISTINCT children the graph connects (via each
    // endpoint's representative at this level). Edges that leave the container
    // — or stay within a single child — are not represented here; the crossing
    // is handled later by geometric routing.
    private buildLocalGraph(
        graph:       Graph,
        containerId: string | undefined,
        boxSize:     Map<string, Size>,
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
        for (const e of graph.edges)
        {
            const repFrom = this.representativeAt(graph, e.From, containerId);
            const repTo   = this.representativeAt(graph, e.To,   containerId);
            if (repFrom === undefined || repTo === undefined || repFrom === repTo) continue;
            const key = `${repFrom}->${repTo}`;
            if (!seen.has(key)) { seen.add(key); edges.push(new Edge(repFrom, repTo)); }
        }
        return new Graph(nodes, edges);
    }

    // Size a frozen container and every container nested within it from the
    // manual LocalPositions, bottom-up. Populates boxSize and localPos for
    // the whole subtree so the normal top-down unfold (a rigid translation)
    // then preserves the manual relative layout exactly. A container's box is
    // its explicit Size when set, else the padded extent of its children.
    private freezeSubtree(
        graph:    Graph,
        root:     string,
        boxSize:  Map<string, Size>,
        localPos: Map<string, Map<string, Point>>,
    ): void
    {
        const inSubtree = (id: string): boolean =>
            id === root || ancestors(graph, id).includes(root);
        const subContainers = graph.nodes
            .filter(n => inSubtree(n.Id) && isContainer(graph, n.Id))
            .map(n => n.Id)
            .sort((a, b) => this.depth(graph, b) - this.depth(graph, a) || a.localeCompare(b));

        for (const d of subContainers)
        {
            const kids = childrenOf(graph, d);
            const pos = new Map<string, Point>();
            for (const k of kids) pos.set(k.Id, k.LocalPosition ?? new Point(0, 0));
            localPos.set(d, pos);

            const dNode = graph.nodes.find(n => n.Id === d)!;
            const bb = boundingBox(kids.map(k =>
            {
                const p = k.LocalPosition ?? new Point(0, 0);
                const s = boxSize.get(k.Id) ?? k.Size ?? { width: 0, height: 0 };
                return { x: p.X, y: p.Y, w: s.width, h: s.height };
            }));
            boxSize.set(d, dNode.Size ??
                { width: bb.width + 2 * this.padding, height: bb.height + 2 * this.padding });
        }
    }

    // Box size for a container = the extent of its laid-out interior plus the
    // uniform padding on every side. Interior holds real children only (no
    // ports), so this is exact — no synthetic-layer inflation.
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

    // One polyline per edge: source → a pierce point on every box border it
    // crosses on the way up to the LCA and back down → target. Boxes are
    // pierced innermost-first on the source side and innermost-last on the
    // target side, which is the geometric order along the edge.
    private routeEdges(
        graph:     Graph,
        positions: Map<string, Point>,
        boxes:     Map<string, Rect>,
    ): Map<Edge, EdgeRouting>
    {
        const routes = new Map<Edge, EdgeRouting>();
        for (const e of graph.edges)
        {
            const from = positions.get(e.From);
            const to   = positions.get(e.To);
            if (from === undefined || to === undefined) continue;

            const boundary = lca(graph, e.From, e.To);
            const piercedBoxes = (node: string): string[] =>
            {
                const out: string[] = [];
                for (const a of ancestors(graph, node)) { if (a === boundary) break; out.push(a); }
                return out;
            };

            const waypoints: Point[] = [from];
            for (const c of piercedBoxes(e.From))
            {
                const box = boxes.get(c);
                if (box === undefined) continue;
                const inner = this.globalPos(this.representativeAt(graph, e.From, c)!, positions, boxes);
                if (inner !== undefined) waypoints.push(this.pierce(box, inner, to));
            }
            for (const c of piercedBoxes(e.To).reverse())
            {
                const box = boxes.get(c);
                if (box === undefined) continue;
                const inner = this.globalPos(this.representativeAt(graph, e.To, c)!, positions, boxes);
                if (inner !== undefined) waypoints.push(this.pierce(box, inner, from));
            }
            waypoints.push(to);
            routes.set(e, { kind: 'points', waypoints });
        }
        return routes;
    }

    // Global position of a node id: a leaf's placed point, or a box's centre.
    private globalPos(id: string, positions: Map<string, Point>, boxes: Map<string, Rect>): Point | undefined
    {
        const p = positions.get(id);
        if (p !== undefined) return p;
        const b = boxes.get(id);
        if (b !== undefined) return new Point(b.position.X + b.width / 2, b.position.Y + b.height / 2);
        return undefined;
    }

    // The pierce point where an edge leaves `box` toward `far`. The border is
    // whichever the direction (box centre → far) exits: top/bottom when the
    // vertical offset dominates, left/right otherwise. The coordinate along
    // that border tracks the interior attachment (`inner`), clamped to the
    // border segment, so the port sits directly over its interior endpoint.
    private pierce(box: Rect, inner: Point, far: Point): Point
    {
        const left = box.position.X, right = left + box.width;
        const top  = box.position.Y, bottom = top + box.height;
        const cx = left + box.width / 2, cy = top + box.height / 2;
        const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

        if (Math.abs(far.Y - cy) >= Math.abs(far.X - cx))
        {
            const y = far.Y >= cy ? bottom : top;
            return new Point(clamp(inner.X, left, right), y);
        }
        const x = far.X >= cx ? right : left;
        return new Point(x, clamp(inner.Y, top, bottom));
    }
}
