import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

test('FlatLayoutPipeline.Apply returns a LayoutResult with positions', () => {
    const g = new Graph();
    for (const id of ['a', 'b']) g.AddNode(id);
    g.AddEdge('a', 'b');
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    const { layoutPipeline } = BuildPipeline(config, LoadElementRepository());

    const result = layoutPipeline.Apply(g);

    assert.ok(result.positions instanceof Map, 'positions is a Map');
    assert.equal(result.positions.size, 2, 'one position per real node');
    assert.ok(result.crossings, 'crossings diagnostics present');
});
