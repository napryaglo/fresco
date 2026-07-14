import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Point } from '@pragmatic-lab/mural/runtime';

import { Graph } from '../../graph.js';
import { Side } from '../side-assigner.js';
import { CardinalSideAssigner } from '../cardinal-side-assigner.js';

// Small helper: build a positions map and a single edge, run the
// assigner, and return the one EdgeSides entry.
function sidesFor(u: Point, v: Point): { source: Side; target: Side } {
    const g = new Graph();
    g.AddNode('a');
    g.AddNode('b');
    const e = g.AddEdge('a', 'b');
    const positions = new Map<string, Point>([['a', u], ['b', v]]);
    const out = new CardinalSideAssigner().AssignSides(positions, g.edges);
    return out.get(e)!;
}

test('target directly below → source S, target N', () => {
    const s = sidesFor(new Point(0, 0), new Point(0, 100));
    assert.equal(s.source, Side.S);
    assert.equal(s.target, Side.N);
});

test('target directly above → source N, target S', () => {
    const s = sidesFor(new Point(0, 100), new Point(0, 0));
    assert.equal(s.source, Side.N);
    assert.equal(s.target, Side.S);
});

test('target to the right → source E, target W', () => {
    const s = sidesFor(new Point(0, 0), new Point(100, 0));
    assert.equal(s.source, Side.E);
    assert.equal(s.target, Side.W);
});

test('target to the left → source W, target E', () => {
    const s = sidesFor(new Point(100, 0), new Point(0, 0));
    assert.equal(s.source, Side.W);
    assert.equal(s.target, Side.E);
});

test('vertical dominates on a tie between |dx| and |dy|', () => {
    // |dx| == |dy| resolves to the vertical axis (>= favours vertical).
    const s = sidesFor(new Point(0, 0), new Point(50, 50));
    assert.equal(s.source, Side.S);
    assert.equal(s.target, Side.N);
});

test('horizontal wins when |dx| strictly exceeds |dy|', () => {
    const s = sidesFor(new Point(0, 0), new Point(100, 40));
    assert.equal(s.source, Side.E);
    assert.equal(s.target, Side.W);
});

test('coincident endpoints fall back to S/N', () => {
    const s = sidesFor(new Point(10, 10), new Point(10, 10));
    assert.equal(s.source, Side.S);
    assert.equal(s.target, Side.N);
});

test('edges with a missing endpoint position are skipped', () => {
    const g = new Graph();
    g.AddNode('a');
    g.AddNode('b');
    const e = g.AddEdge('a', 'b');
    const positions = new Map<string, Point>([['a', new Point(0, 0)]]); // no 'b'
    const out = new CardinalSideAssigner().AssignSides(positions, g.edges);
    assert.equal(out.has(e), false);
});

test('Side enum values match the host diagram PortSide wire form', () => {
    assert.equal(Side.N, 'N');
    assert.equal(Side.S, 'S');
    assert.equal(Side.E, 'E');
    assert.equal(Side.W, 'W');
});
