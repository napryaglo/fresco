import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Point } from '@pragmatic-lab/mural/runtime';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}

test('a frozen container keeps its children at their relative manual positions', () => {
    const g = new Graph();
    g.AddNode('FROZEN'); g.AddNode('other');
    const f = g.nodes.find(n => n.Id === 'FROZEN')!; f.LayoutContent = false;
    g.AddNode('m'); g.AddNode('n');
    const m = g.nodes.find(x => x.Id === 'm')!; m.ParentId = 'FROZEN'; m.Size = { width: 10, height: 10 }; m.LocalPosition = new Point(0, 0);
    const nn = g.nodes.find(x => x.Id === 'n')!; nn.ParentId = 'FROZEN'; nn.Size = { width: 10, height: 10 }; nn.LocalPosition = new Point(50, 20);
    const o = g.nodes.find(x => x.Id === 'other')!; o.Size = { width: 10, height: 10 };
    g.AddEdge('m', 'other');

    const res = new NestedCompoundLayout(engine()).Apply(g);
    const gm = res.positions.get('m')!, gn = res.positions.get('n')!;
    // relative offset preserved: n is (50,20) from m regardless of where the box landed
    assert.equal(gn.X - gm.X, 50);
    assert.equal(gn.Y - gm.Y, 20);
});
