import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Node, Edge } from './graph.js';
import { buildNodePredicate, buildEdgePredicate } from './transform-params.js';

test('node predicate: label contains', () => {
    const p = buildNodePredicate({ field: 'label', op: 'contains', value: 'db' });
    assert.equal(p(new Node('n1', 'user-db')), true);
    assert.equal(p(new Node('n2', 'web')), false);
});

test('node predicate: id equals', () => {
    const p = buildNodePredicate({ field: 'id', op: 'equals', value: 'n1' });
    assert.equal(p(new Node('n1', 'x')), true);
    assert.equal(p(new Node('n2', 'x')), false);
});

test('node predicate: missing label treated as empty string', () => {
    const p = buildNodePredicate({ field: 'label', op: 'contains', value: 'x' });
    assert.equal(p(new Node('n1')), false);
});

test('edge predicate: from matches regex', () => {
    const p = buildEdgePredicate({ field: 'from', op: 'matches', value: '^svc-' });
    assert.equal(p(new Edge('svc-a', 'b')), true);
    assert.equal(p(new Edge('a', 'b')), false);
});

test('edge predicate: to equals', () => {
    const p = buildEdgePredicate({ field: 'to', op: 'equals', value: 'db' });
    assert.equal(p(new Edge('a', 'db')), true);
    assert.equal(p(new Edge('a', 'web')), false);
});
