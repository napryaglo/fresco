import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}
function contains(outer: { position: { X: number; Y: number }, width: number, height: number },
                  inner: { position: { X: number; Y: number }, width: number, height: number }) {
    return inner.position.X >= outer.position.X - 0.001
        && inner.position.Y >= outer.position.Y - 0.001
        && inner.position.X + inner.width <= outer.position.X + outer.width + 0.001
        && inner.position.Y + inner.height <= outer.position.Y + outer.height + 0.001;
}

test('azure ⊃ m365 ⊃ pp: every box nests inside its parent box', () => {
    const g = new Graph();
    g.AddNode('azure'); g.AddNode('m365'); g.AddNode('pp'); g.AddNode('leaf');
    g.nodes.find(n => n.Id === 'm365')!.ParentId = 'azure';
    g.nodes.find(n => n.Id === 'pp')!.ParentId = 'm365';
    const leaf = g.nodes.find(n => n.Id === 'leaf')!; leaf.ParentId = 'pp'; leaf.Size = { width: 30, height: 20 };

    const res = new NestedCompoundLayout(engine()).Apply(g);
    const azure = res.boxes!.get('azure')!, m365 = res.boxes!.get('m365')!, pp = res.boxes!.get('pp')!;
    assert.ok(contains(azure, m365), 'm365 inside azure');
    assert.ok(contains(m365, pp), 'pp inside m365');
    const leafPos = res.positions.get('leaf')!;
    assert.ok(leafPos.X >= pp.position.X && leafPos.X <= pp.position.X + pp.width, 'leaf inside pp');
});
