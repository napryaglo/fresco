import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}
function build(): Graph {
    const g = new Graph();
    g.AddNode('A'); g.AddNode('B');
    for (const [box, leaf] of [['A', 'a1'], ['A', 'a2'], ['B', 'b1']] as const) {
        const n = g.AddNode(leaf); n.ParentId = box; n.Size = { width: 20, height: 20 };
    }
    g.AddEdge('a1', 'a2'); g.AddEdge('a1', 'b1');
    return g;
}

test('same compound graph in -> identical positions and boxes out', () => {
    const first  = new NestedCompoundLayout(engine()).Apply(build());
    const second = new NestedCompoundLayout(engine()).Apply(build());
    assert.deepEqual([...first.positions.entries()], [...second.positions.entries()]);
    assert.deepEqual([...first.boxes!.entries()], [...second.boxes!.entries()]);
});
