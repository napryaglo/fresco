import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BrandesKopfPositionComputer } from '../brandes-kopf-position-computer.js';
import { Edge } from '../../graph.js';
import type { Size } from '../../geometry.js';

test('with no sizes, two-node layer keeps the uniform nodeSpacingX (110) gap', () => {
    const bk = new BrandesKopfPositionComputer();
    const layers = [['a', 'b']];
    const pos = bk.Compute(layers, [], undefined);
    assert.equal(Math.abs(pos.get('a')!.X - pos.get('b')!.X), 110);
});

test('per-node width widens the in-layer gap by the two half-widths', () => {
    const bk = new BrandesKopfPositionComputer();
    const layers = [['a', 'b']];
    const sizes: Map<string, Size> = new Map([
        ['a', { width: 40, height: 10 }],
        ['b', { width: 60, height: 10 }],
    ]);
    const pos = bk.Compute(layers, [], sizes);
    // 20 (half of a) + 110 + 30 (half of b) = 160
    assert.equal(Math.abs(pos.get('a')!.X - pos.get('b')!.X), 160);
});

test('per-layer height increases the band gap by the two half-heights', () => {
    const bk = new BrandesKopfPositionComputer(/* layerSpacingY */ 100);
    const layers = [['a'], ['b']];
    const edges = [new Edge('a', 'b')];
    const sizes: Map<string, Size> = new Map([
        ['a', { width: 0, height: 40 }],
        ['b', { width: 0, height: 60 }],
    ]);
    const pos = bk.Compute(layers, edges, sizes);
    // 20 + 100 + 30 = 150
    assert.equal(pos.get('b')!.Y - pos.get('a')!.Y, 150);
});
