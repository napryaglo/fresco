import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GetPipelineCatalog } from './pipeline-catalog.js';
import { ListStrategyNames } from './configuration-loader.js';

// crossing-counter is an internal diagnostic stage, intentionally not a
// builder slot, so it is excluded from the catalog drift checks.
const NON_SLOT_STAGES = new Set(['crossing-counter']);

test('graph-transforms is a transform-list; layout stages are strategy-slots', () => {
    const byId = new Map(GetPipelineCatalog().map((s) => [s.slotId, s]));
    assert.equal(byId.get('graph-transforms')!.kind, 'transform-list');
    assert.equal(byId.get('reorderer')!.kind, 'strategy-slot');
    assert.equal(byId.get('reorderer')!.required, true);
    assert.equal(byId.get('edge-router')!.required, false);
});

test('every registry strategy (except internal stages) appears in the catalog', () => {
    const names = ListStrategyNames();
    const bySlot = new Map(GetPipelineCatalog().map((s) => [s.slotId, new Set(s.strategies.map((x) => x.className))]));
    for (const [stage, classNames] of Object.entries(names)) {
        if (NON_SLOT_STAGES.has(stage)) continue;
        for (const cn of classNames) {
            assert.ok(bySlot.get(stage)?.has(cn), `catalog missing ${stage}/${cn}`);
        }
    }
});

test('every catalog strategy exists in the registry', () => {
    const names = ListStrategyNames();
    for (const slot of GetPipelineCatalog()) {
        for (const s of slot.strategies) {
            assert.ok(names[slot.slotId]?.includes(s.className), `extra catalog entry ${slot.slotId}/${s.className}`);
        }
    }
});

test('the catalog does not surface the internal crossing-counter stage', () => {
    assert.ok(!GetPipelineCatalog().some((s) => s.slotId === 'crossing-counter'));
});

test('catalog carries display metadata joined from the element repository', () => {
    const reorderer = GetPipelineCatalog().find((s) => s.slotId === 'reorderer')!;
    const bary = reorderer.strategies.find((s) => s.className === 'BarycenterReorderer')!;
    assert.equal(bary.name, 'Barycenter');
    assert.ok(bary.references.length > 0);
});

test('parameterized transforms declare parameters', () => {
    const slot = GetPipelineCatalog().find((s) => s.slotId === 'graph-transforms')!;
    const filter = slot.strategies.find((s) => s.className === 'FilterNodesTransform')!;
    assert.ok(filter.parameters && filter.parameters.length > 0);
    const dedup = slot.strategies.find((s) => s.className === 'DedupEdgesTransform')!;
    assert.equal(dedup.parameters, undefined);
});
