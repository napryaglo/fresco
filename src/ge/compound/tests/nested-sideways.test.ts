import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: { edgeRouter: 'StraightLineEdgeRouter' } };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}

test('two sibling containers whose members share a global rank still lay out without overlap and route', () => {
    const g = new Graph();
    for (const box of ['A', 'B']) {
        g.AddNode(box);
        g.AddNode(box + '1');
        const n = g.nodes.find(x => x.Id === box + '1')!; n.ParentId = box; n.Size = { width: 30, height: 20 };
    }
    const e = g.AddEdge('A1', 'B1'); // same rank (both sole members, rank 0) -> sideways

    const res = new NestedCompoundLayout(engine()).Apply(g);
    const A = res.boxes!.get('A')!, B = res.boxes!.get('B')!;
    const overlap = A.position.X < B.position.X + B.width && A.position.X + A.width > B.position.X
                 && A.position.Y < B.position.Y + B.height && A.position.Y + A.height > B.position.Y;
    assert.equal(overlap, false, 'boxes disjoint');
    assert.ok(res.routes!.get(e), 'sideways edge routed');
});
