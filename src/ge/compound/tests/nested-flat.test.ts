import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}

test('a container-free graph lays out exactly like the flat pipeline', () => {
    const g = new Graph();
    for (const id of ['a', 'b', 'c']) g.AddNode(id);
    g.AddEdge('a', 'b'); g.AddEdge('b', 'c');

    const flat = engine().Apply(g).positions;
    const nested = new NestedCompoundLayout(engine()).Apply(g);

    assert.equal(nested.positions.size, 3);
    for (const id of ['a', 'b', 'c']) {
        assert.deepEqual(nested.positions.get(id), flat.get(id), `${id} matches flat layout`);
    }
    assert.equal(nested.boxes?.size ?? 0, 0, 'no containers -> no boxes');
});
