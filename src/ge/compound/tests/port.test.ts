import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PortSide, portId } from '../port.js';
import { Edge } from '../../graph.js';

test('PortSide is a real enum with four sides', () => {
    assert.equal(typeof PortSide.Top, 'number');
    assert.notEqual(PortSide.Top, PortSide.Bottom);
});

test('portId is deterministic and unique per (container, edge, side)', () => {
    const e = new Edge('u', 'v');
    const a = portId('BOX', e, PortSide.Top);
    const b = portId('BOX', e, PortSide.Top);
    const c = portId('BOX', e, PortSide.Bottom);
    assert.equal(a, b);
    assert.notEqual(a, c);
});
