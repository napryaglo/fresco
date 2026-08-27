import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { globalRank, portSideFor } from '../orientation.js';
import { PortSide } from '../port.js';

test('globalRank ranks leaves by longest path, ignoring containers', () => {
    const g = new Graph();
    g.AddNode('A');                       // container
    g.AddNode('a'); g.AddNode('b'); g.AddNode('c');
    g.nodes.find(n => n.Id === 'a')!.ParentId = 'A';
    g.AddEdge('a', 'b'); g.AddEdge('b', 'c');
    const rank = globalRank(g);
    assert.equal(rank.get('a'), 0);
    assert.equal(rank.get('b'), 1);
    assert.equal(rank.get('c'), 2);
    assert.equal(rank.has('A'), false, 'containers get no rank');
});

test('portSideFor picks border by flow direction', () => {
    assert.equal(portSideFor(0, 2), PortSide.Bottom); // target below -> exits bottom
    assert.equal(portSideFor(2, 0), PortSide.Top);    // target above -> exits top
    assert.equal(portSideFor(1, 1), PortSide.Left);   // same rank -> side
});
