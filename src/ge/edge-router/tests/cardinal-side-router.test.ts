import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Point } from '@pragmatic-lab/mural/runtime';

import { Graph } from '../../graph.js';
import { Side } from '../edge-router.js';
import { CardinalSideRouter, cardinalSides } from '../cardinal-side-router.js';

// Run the router over a single edge u→v and return the one directive.
function routeOne(u: Point, v: Point): { source: Side; target: Side } {
    const g = new Graph();
    g.AddNode('a');
    g.AddNode('b');
    const e = g.AddEdge('a', 'b');
    const positions = new Map<string, Point>([['a', u], ['b', v]]);
    const chains = new Map([[e, ['a', 'b']]]);
    const out = new CardinalSideRouter().Route(positions, chains);
    const routing = out.get(e)!;
    assert.equal(routing.kind, 'sides');
    if (routing.kind !== 'sides') throw new Error('unreachable');
    return { source: routing.source, target: routing.target };
}

test('target below → source S, target N', () => {
    assert.deepEqual(routeOne(new Point(0, 0), new Point(0, 100)), { source: Side.S, target: Side.N });
});

test('target above → source N, target S', () => {
    assert.deepEqual(routeOne(new Point(0, 100), new Point(0, 0)), { source: Side.N, target: Side.S });
});

test('target right → source E, target W', () => {
    assert.deepEqual(routeOne(new Point(0, 0), new Point(100, 0)), { source: Side.E, target: Side.W });
});

test('target left → source W, target E', () => {
    assert.deepEqual(routeOne(new Point(100, 0), new Point(0, 0)), { source: Side.W, target: Side.E });
});

test('vertical wins the |dx| == |dy| tie', () => {
    assert.deepEqual(routeOne(new Point(0, 0), new Point(50, 50)), { source: Side.S, target: Side.N });
});

test('horizontal wins when |dx| strictly exceeds |dy|', () => {
    assert.deepEqual(routeOne(new Point(0, 0), new Point(100, 40)), { source: Side.E, target: Side.W });
});

test('routes a multi-layer edge from its real chain endpoints', () => {
    // chain = [a, dummy, b]; endpoints a (top) and b (bottom) drive the sides.
    const g = new Graph();
    g.AddNode('a'); g.AddNode('b');
    const e = g.AddEdge('a', 'b');
    const positions = new Map<string, Point>([
        ['a', new Point(0, 0)], ['d1', new Point(5, 50)], ['b', new Point(0, 100)],
    ]);
    const chains = new Map([[e, ['a', 'd1', 'b']]]);
    const routing = new CardinalSideRouter().Route(positions, chains).get(e)!;
    assert.equal(routing.kind, 'sides');
    if (routing.kind === 'sides') assert.deepEqual(routing, { kind: 'sides', source: Side.S, target: Side.N });
});

test('coincident endpoints fall back to S/N', () => {
    assert.deepEqual(cardinalSides(10, 10, 10, 10), { source: Side.S, target: Side.N });
});

test('Side enum values match the host PortSide wire form', () => {
    assert.deepEqual([Side.N, Side.S, Side.E, Side.W], ['N', 'S', 'E', 'W']);
});
