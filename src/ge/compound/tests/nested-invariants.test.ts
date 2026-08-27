import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}
function overlap(a: { position: { X: number; Y: number }, width: number, height: number },
                 b: { position: { X: number; Y: number }, width: number, height: number }) {
    return a.position.X < b.position.X + b.width && a.position.X + a.width > b.position.X
        && a.position.Y < b.position.Y + b.height && a.position.Y + a.height > b.position.Y;
}

test('sibling boxes do not overlap', () => {
    const g = new Graph();
    for (const box of ['A', 'B']) {
        g.AddNode(box);
        for (const leaf of [box + '1', box + '2']) {
            g.AddNode(leaf);
            const n = g.nodes.find(x => x.Id === leaf)!; n.ParentId = box; n.Size = { width: 30, height: 20 };
        }
    }
    g.AddEdge('A1', 'B1'); // a cross-container edge to force relative placement

    const res = new NestedCompoundLayout(engine()).Apply(g);
    const A = res.boxes!.get('A')!, B = res.boxes!.get('B')!;
    assert.equal(overlap(A, B), false, 'A and B boxes are disjoint');
});
