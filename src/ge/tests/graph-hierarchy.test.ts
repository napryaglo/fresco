import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Point } from '@pragmatic-tech-ai/mural/runtime';
import { Node } from '../graph.js';

test('a fresh node has no parent, no size, no local position, and lays out its content', () => {
    const n = new Node('x');
    assert.equal(n.ParentId, undefined);
    assert.equal(n.Size, undefined);
    assert.equal(n.LocalPosition, undefined);
    assert.equal(n.LayoutContent, true);
});

test('hierarchy fields round-trip', () => {
    const n = new Node('x');
    n.ParentId = 'box';
    n.Size = { width: 20, height: 12 };
    n.LocalPosition = new Point(3, 4);
    n.LayoutContent = false;
    assert.equal(n.ParentId, 'box');
    assert.deepEqual(n.Size, { width: 20, height: 12 });
    assert.equal(n.LocalPosition.X, 3);
    assert.equal(n.LayoutContent, false);
});
