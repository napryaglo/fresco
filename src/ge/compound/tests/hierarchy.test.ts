import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { childrenOf, isContainer, ancestors, lca } from '../hierarchy.js';

function nested(): Graph {
    // root: box A (contains B and leaf p); B contains leaves q, r
    const g = new Graph();
    g.AddNode('A'); g.AddNode('B'); g.AddNode('p'); g.AddNode('q'); g.AddNode('r');
    g.nodes.find(n => n.Id === 'B')!.ParentId = 'A';
    g.nodes.find(n => n.Id === 'p')!.ParentId = 'A';
    g.nodes.find(n => n.Id === 'q')!.ParentId = 'B';
    g.nodes.find(n => n.Id === 'r')!.ParentId = 'B';
    return g;
}

test('childrenOf returns direct members', () => {
    const g = nested();
    assert.deepEqual(childrenOf(g, 'A').map(n => n.Id).sort(), ['B', 'p']);
    assert.deepEqual(childrenOf(g, 'B').map(n => n.Id).sort(), ['q', 'r']);
    assert.deepEqual(childrenOf(g, undefined).map(n => n.Id), ['A']);
});

test('isContainer is true only for nodes with children', () => {
    const g = nested();
    assert.equal(isContainer(g, 'A'), true);
    assert.equal(isContainer(g, 'B'), true);
    assert.equal(isContainer(g, 'p'), false);
});

test('ancestors walks to the root', () => {
    assert.deepEqual(ancestors(nested(), 'q'), ['B', 'A']);
});

test('lca finds the lowest common container', () => {
    const g = nested();
    assert.equal(lca(g, 'q', 'r'), 'B');   // both in B
    assert.equal(lca(g, 'q', 'p'), 'A');   // q in B in A; p in A
    assert.equal(lca(g, 'q', 'q'), 'B');   // self -> its parent
});
