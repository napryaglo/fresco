import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STRATEGY_PARAMS } from '../strategy-params.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../configuration-loader.js';
import { GetPipelineCatalog } from '../pipeline-catalog.js';

test('every parameterized strategy builds with its default param values', () => {
    for (const [className, def] of Object.entries(STRATEGY_PARAMS)) {
        const values: Record<string, number | boolean> = {};
        for (const p of def.params) values[p.key] = p.default as number | boolean;
        const inst = def.build(values);
        assert.ok(inst.Name.length > 0, `${className} built to a pipeline element`);
    }
});

test('the catalog surfaces layout-strategy parameters', () => {
    const reorderer = GetPipelineCatalog().find((s) => s.slotId === 'reorderer')!;
    const bary = reorderer.strategies.find((s) => s.className === 'BarycenterReorderer')!;
    assert.ok(bary.parameters?.some((p) => p.key === 'iterations' && p.type === 'number'));
});

test('BuildPipeline constructs a layout stage from a spec with params', () => {
    const config: PipelineConfiguration = {
        name: 't',
        transforms: [],
        layout: { reorderer: { className: 'BarycenterReorderer', params: { iterations: 3 } } },
    };
    const { layoutPipeline } = BuildPipeline(config, LoadElementRepository());
    // The reorderer is the first constructor arg; assert the param took effect.
    assert.equal((layoutPipeline.reorderer as unknown as { iterations: number }).iterations, 3);
});

test('a plain class-name string still constructs with defaults', () => {
    const config: PipelineConfiguration = {
        name: 't', transforms: [], layout: { reorderer: 'MedianReorderer' },
    };
    const { layoutPipeline } = BuildPipeline(config, LoadElementRepository());
    assert.equal((layoutPipeline.reorderer as unknown as { iterations: number }).iterations, 12);
});
