import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = {
        name: 't', transforms: [],
        layout: { edgeRouter: 'StraightLineEdgeRouter' },
    };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}

test('a cross-boundary edge has a route with endpoints at the node positions', () => {
    const g = new Graph();
    g.AddNode('BOX'); g.AddNode('a'); g.AddNode('out');
    const a = g.nodes.find(n => n.Id === 'a')!; a.ParentId = 'BOX'; a.Size = { width: 20, height: 20 };
    g.nodes.find(n => n.Id === 'out')!.Size = { width: 20, height: 20 };
    const e = g.AddEdge('a', 'out');

    const res = new NestedCompoundLayout(engine()).Apply(g);
    assert.ok(res.routes, 'routes present');
    const route = res.routes!.get(e);
    assert.ok(route, 'the crossing edge has a route');
    assert.equal(route!.kind, 'points');
    if (route!.kind === 'points') {
        const wp = route!.waypoints;
        assert.ok(wp.length >= 2, 'at least source and target');
        assert.deepEqual(wp[0], res.positions.get('a'), 'starts at source');
        assert.deepEqual(wp[wp.length - 1], res.positions.get('out'), 'ends at target');
    }
});
