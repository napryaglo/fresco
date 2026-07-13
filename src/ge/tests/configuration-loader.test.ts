import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BuildPipeline, ListStrategyNames, LoadElementRepository, ValidateRepositoryAgainstClasses, type PipelineConfiguration } from '../configuration-loader.js';
import { Graph } from '../graph.js';

test('LoadElementRepository returns metadata for a known strategy without fs', () => {
    const repo = LoadElementRepository();
    assert.equal(repo['layer-assigner']!['LongestPathLayerAssigner']!.name, 'Longest Path');
    assert.ok(Array.isArray(repo['graph-transforms']!['DedupEdgesTransform']!.references));
});

test('the static element repository matches the code-side metadata exactly', () => {
    // Cross-checks every name / algorithm / reference in pipeline-elements-data.ts
    // against the class instances — guards against transcription drift.
    ValidateRepositoryAgainstClasses(LoadElementRepository());
});

test('ListStrategyNames returns every registered className per stage', () => {
    const names = ListStrategyNames();
    assert.ok(names['reorderer']!.includes('BarycenterReorderer'));
    assert.ok(names['reorderer']!.includes('MedianReorderer'));
    assert.ok(names['graph-transforms']!.includes('DropIsolatedNodesTransform'));
    assert.ok(names['graph-transforms']!.includes('FilterNodesTransform'));
    assert.equal(names['layer-assigner']!.length, 1);
});

test('BuildPipeline applies a parameterized FilterNodes transform', () => {
    const config: PipelineConfiguration = {
        name: 't',
        transforms: [{ className: 'FilterNodesTransform', params: { field: 'label', op: 'contains', value: 'keep' } }],
        layout: {},
    };
    const { graphPipeline } = BuildPipeline(config, LoadElementRepository());
    const g = new Graph();
    g.AddNode('a', 'keep-me');
    g.AddNode('b', 'drop-me');
    const out = graphPipeline.Apply(g);
    assert.deepEqual(out.nodes.map((n) => n.Id), ['a']);
});

test('BuildPipeline still accepts plain no-arg transform strings', () => {
    const config: PipelineConfiguration = { name: 't', transforms: ['DropIsolatedNodesTransform'], layout: {} };
    const { graphPipeline } = BuildPipeline(config, LoadElementRepository());
    const g = new Graph();
    g.AddNode('a'); g.AddNode('b'); g.AddNode('isolated');
    g.AddEdge('a', 'b');
    const out = graphPipeline.Apply(g);
    assert.deepEqual(out.nodes.map((n) => n.Id).sort(), ['a', 'b']);
});
