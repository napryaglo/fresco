import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Graph } from '../../graph.js';
import { MakeAcyclicTransform } from '../make-acyclic.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function edgeSet(g: Graph): Set<string>
{
    return new Set(g.edges.map(e => `${e.From}->${e.To}`));
}

test('a 2-cycle is made acyclic while preserving nodes and edge count', () => {
    const g = new Graph();
    g.AddNode('a'); g.AddNode('b');
    g.AddEdge('a', 'b'); g.AddEdge('b', 'a');

    const out = new MakeAcyclicTransform().Apply(g);

    assert.equal(out.IsDirectedAcyclic(), true, 'result must be a DAG');
    assert.equal(out.nodes.length, 2, 'nodes are preserved');
    assert.equal(out.edges.length, 2, 'both edges survive (one reversed, not dropped)');
});

test('a 3-cycle is made acyclic', () => {
    const g = new Graph();
    g.AddNode('a'); g.AddNode('b'); g.AddNode('c');
    g.AddEdge('a', 'b'); g.AddEdge('b', 'c'); g.AddEdge('c', 'a');

    const out = new MakeAcyclicTransform().Apply(g);

    assert.equal(out.IsDirectedAcyclic(), true);
    assert.equal(out.edges.length, 3, 'connectivity preserved (feedback edge reversed)');
});

test('self-loops are dropped (they are unbreakable 1-cycles)', () => {
    const g = new Graph();
    g.AddNode('a'); g.AddNode('b');
    g.AddEdge('a', 'a');   // self-loop
    g.AddEdge('a', 'b');

    const out = new MakeAcyclicTransform().Apply(g);

    assert.equal(out.IsDirectedAcyclic(), true);
    assert.deepEqual([...edgeSet(out)], ['a->b'], 'self-loop removed, real edge kept');
});

test('an already-acyclic graph is left directionally unchanged', () => {
    const g = new Graph();
    g.AddNode('a'); g.AddNode('b'); g.AddNode('c');
    g.AddEdge('a', 'b'); g.AddEdge('b', 'c'); g.AddEdge('a', 'c');

    const out = new MakeAcyclicTransform().Apply(g);

    assert.equal(out.IsDirectedAcyclic(), true);
    assert.deepEqual(edgeSet(out), edgeSet(g), 'no edge reversed when input is already a DAG');
});

test('the transform is deterministic across runs', () => {
    const build = (): Graph => {
        const g = new Graph();
        for (const id of ['a', 'b', 'c', 'd']) g.AddNode(id);
        g.AddEdge('a', 'b'); g.AddEdge('b', 'c'); g.AddEdge('c', 'd');
        g.AddEdge('d', 'a'); g.AddEdge('c', 'a');   // two feedback candidates
        return g;
    };
    const first  = new MakeAcyclicTransform().Apply(build());
    const second = new MakeAcyclicTransform().Apply(build());

    assert.deepEqual(edgeSet(first), edgeSet(second), 'same input reverses the same edges');
    assert.equal(first.IsDirectedAcyclic(), true);
});

test('as the first transform, the default pipeline lays out a cyclic graph without throwing', () => {
    const g = new Graph();
    for (const id of ['a', 'b', 'c']) g.AddNode(id);
    g.AddEdge('a', 'b'); g.AddEdge('b', 'c'); g.AddEdge('c', 'a');   // cycle

    const config: PipelineConfiguration = {
        name: 'default-with-acyclic',
        transforms: ['MakeAcyclicTransform'],
        layout: {},
    };
    const { graphPipeline, layoutPipeline } = BuildPipeline(config, LoadElementRepository());

    const transformed = graphPipeline.Apply(g);
    assert.equal(transformed.IsDirectedAcyclic(), true, 'graph transform breaks the cycle');

    // The longest-path layer assigner (DAG-only) must now run cleanly.
    assert.doesNotThrow(() => layoutPipeline.Apply(transformed));
});
