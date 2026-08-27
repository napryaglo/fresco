import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundingBox } from '../geometry.js';

test('boundingBox of point-like items is their extent', () => {
    const r = boundingBox([{ x: 0, y: 0 }, { x: 10, y: 4 }]);
    assert.equal(r.position.X, 0);
    assert.equal(r.position.Y, 0);
    assert.equal(r.width, 10);
    assert.equal(r.height, 4);
});

test('boundingBox accounts for item width/height (centered extents)', () => {
    // one item at x=0 width 20 spans [-10, 10]; another at x=30 width 0 -> [-10,30]
    const r = boundingBox([{ x: 0, y: 0, w: 20, h: 10 }, { x: 30, y: 0, w: 0, h: 0 }]);
    assert.equal(r.position.X, -10);
    assert.equal(r.width, 40);   // -10 .. 30
    assert.equal(r.position.Y, -5);
    assert.equal(r.height, 10);
});
