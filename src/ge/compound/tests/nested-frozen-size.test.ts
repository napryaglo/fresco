import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Point } from '@pragmatic-tech-ai/mural/runtime';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}

test('an explicit Size on a frozen container overrides the derived bounding box', () => {
    const g = new Graph();
    g.AddNode('FROZEN'); g.AddNode('sibling');
    const f = g.nodes.find(n => n.Id === 'FROZEN')!; f.LayoutContent = false; f.Size = { width: 500, height: 400 };
    const m = g.AddNode('m'); m.ParentId = 'FROZEN'; m.Size = { width: 10, height: 10 }; m.LocalPosition = new Point(0, 0);
    const s = g.nodes.find(n => n.Id === 'sibling')!; s.Size = { width: 10, height: 10 };
    g.AddEdge('m', 'sibling');

    const res = new NestedCompoundLayout(engine()).Apply(g);
    const box = res.boxes!.get('FROZEN')!;
    assert.equal(box.width, 500);
    assert.equal(box.height, 400);
});
