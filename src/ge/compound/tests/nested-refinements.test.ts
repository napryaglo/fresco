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

const EPS = 1e-6;
function onBorder(box: { position: { X: number; Y: number }, width: number, height: number }, p: { X: number; Y: number }): boolean {
    const left = box.position.X, right = left + box.width, top = box.position.Y, bottom = top + box.height;
    const onV = (Math.abs(p.X - left) < EPS || Math.abs(p.X - right) < EPS) && p.Y >= top - EPS && p.Y <= bottom + EPS;
    const onH = (Math.abs(p.Y - top) < EPS || Math.abs(p.Y - bottom) < EPS) && p.X >= left - EPS && p.X <= right + EPS;
    return onV || onH;
}

// Item 2 — ports are not layout nodes, so a container with a crossing edge
// reserves NO synthetic layer: its box is exactly content + 2*padding (40).
test('a container box is exactly content + 2*padding even with a crossing edge', () => {
    const g = new Graph();
    g.AddNode('BOX'); g.AddNode('out');
    const a = g.AddNode('a'); a.ParentId = 'BOX'; a.Size = { width: 20, height: 20 };
    g.nodes.find(n => n.Id === 'out')!.Size = { width: 20, height: 20 };
    g.AddEdge('a', 'out'); // crosses BOX boundary

    const res = new NestedCompoundLayout(engine()).Apply(g);
    const box = res.boxes!.get('BOX')!;
    assert.equal(box.width, 20 + 2 * 40, 'width = content + 2*padding');
    assert.equal(box.height, 20 + 2 * 40, 'height = content + 2*padding (no port layer)');
});

// Item 1 — a crossing edge pierces the box border (a real pierce point),
// on the side facing the far endpoint (here `out` is below → bottom border).
test('a crossing edge routes through a pierce point on the box border', () => {
    const g = new Graph();
    g.AddNode('BOX'); g.AddNode('out');
    const a = g.AddNode('a'); a.ParentId = 'BOX'; a.Size = { width: 20, height: 20 };
    g.nodes.find(n => n.Id === 'out')!.Size = { width: 20, height: 20 };
    const e = g.AddEdge('a', 'out');

    const res = new NestedCompoundLayout(engine()).Apply(g);
    const box = res.boxes!.get('BOX')!;
    const route = res.routes!.get(e)!;
    assert.equal(route.kind, 'points');
    if (route.kind === 'points') {
        assert.equal(route.waypoints.length, 3, 'source, pierce, target');
        const port = route.waypoints[1]!;
        assert.ok(onBorder(box, port), 'pierce point lies on the box border');
        assert.equal(port.Y, box.position.Y + box.height, 'exits the bottom border (out is below)');
    }
});

// Item 3 — a frozen container mints ports too: its crossing edge is routed
// through a pierce point on the (frozen) box border, derived from geometry.
test('a frozen container mints a pierce point on its border for a crossing edge', () => {
    const g = new Graph();
    g.AddNode('FROZEN'); g.AddNode('other');
    const f = g.nodes.find(n => n.Id === 'FROZEN')!; f.LayoutContent = false;
    const m = g.AddNode('m'); m.ParentId = 'FROZEN'; m.Size = { width: 10, height: 10 }; m.LocalPosition = new Point(0, 0);
    g.nodes.find(n => n.Id === 'other')!.Size = { width: 10, height: 10 };
    const e = g.AddEdge('m', 'other');

    const res = new NestedCompoundLayout(engine()).Apply(g);
    const box = res.boxes!.get('FROZEN')!;
    const route = res.routes!.get(e)!;
    assert.equal(route.kind, 'points');
    if (route.kind === 'points') {
        assert.equal(route.waypoints.length, 3, 'source, pierce, target');
        assert.ok(onBorder(box, route.waypoints[1]!), 'frozen box mints a border pierce point');
    }
});
