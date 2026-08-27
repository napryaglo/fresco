import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}

// is (X,Y) inside rect [position, position + w/h]?
function inside(box: { position: { X: number; Y: number }; width: number; height: number }, p: { X: number; Y: number }) {
    return p.X >= box.position.X && p.X <= box.position.X + box.width
        && p.Y >= box.position.Y && p.Y <= box.position.Y + box.height;
}

test('one container with two children: children sit inside the box', () => {
    const g = new Graph();
    g.AddNode('BOX');
    g.AddNode('a'); g.AddNode('b');
    for (const id of ['a', 'b']) {
        const n = g.nodes.find(x => x.Id === id)!;
        n.ParentId = 'BOX';
        n.Size = { width: 30, height: 20 };
    }
    g.AddEdge('a', 'b');

    const res = new NestedCompoundLayout(engine()).Apply(g);
    const box = res.boxes!.get('BOX')!;

    assert.ok(box, 'BOX has a rectangle');
    assert.ok(inside(box, res.positions.get('a')!), 'a inside box');
    assert.ok(inside(box, res.positions.get('b')!), 'b inside box');
});
