import type { Graph } from '../graph.js';
import type { ILayout, LayoutResult } from '../layouts/layout.js';
import type { FlatLayoutPipeline } from '../layouts/flat-layout-pipeline.js';
import { isContainer } from './hierarchy.js';

// In-place nested-container layout. Lays out each container's interior in
// isolation with the flat pipeline, sizes it into a box, and places boxes as
// sized nodes in their parent frame — recursively. Cross-boundary edges
// reduce to ports on container borders (added in later tasks).
//
// A graph with no containers is delegated straight to the flat engine, so
// this composer is a safe drop-in replacement.
export class NestedCompoundLayout implements ILayout
{
    constructor(private readonly engine: FlatLayoutPipeline) {}

    public Apply(graph: Graph): LayoutResult
    {
        const anyContainer = graph.nodes.some(n => isContainer(graph, n.Id));
        if (!anyContainer) return this.engine.Apply(graph);

        // Container layout arrives in the next tasks; throw rather than
        // silently return a wrong result on an unfinished path.
        throw new Error('NestedCompoundLayout: container layout not yet implemented');
    }
}
