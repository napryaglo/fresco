import type { Graph, Node } from '../graph.js';

// Read-only hierarchy queries over a Graph. Containment is expressed by
// Node.ParentId; sibling containers are disjoint, so the relation forms a
// tree. These helpers are the shared vocabulary the compound composers use
// to walk that tree.

// Direct members of a container (its immediate children). Pass `undefined`
// for the top-level nodes (those with no parent).
export function childrenOf(graph: Graph, parentId: string | undefined): Node[]
{
    return graph.nodes.filter(n => n.ParentId === parentId);
}

// True when some node names `id` as its parent — i.e. `id` is a container.
export function isContainer(graph: Graph, id: string): boolean
{
    return graph.nodes.some(n => n.ParentId === id);
}

// The chain of containers above `id`, closest first: [parent, grandparent,
// …] up to a top-level node. Excludes `id` itself.
export function ancestors(graph: Graph, id: string): string[]
{
    const byId = new Map(graph.nodes.map(n => [n.Id, n]));
    const out: string[] = [];
    let cur = byId.get(id)?.ParentId;
    while (cur !== undefined) { out.push(cur); cur = byId.get(cur)?.ParentId; }
    return out;
}

// Lowest common ancestor container of `a` and `b`, or undefined when they
// live under different roots. For a === b the result is its parent (the
// container that owns it), because ancestors() starts one level up.
export function lca(graph: Graph, a: string, b: string): string | undefined
{
    const setA = new Set(ancestors(graph, a));
    for (const x of [b, ...ancestors(graph, b)]) if (setA.has(x)) return x;
    return undefined;
}
