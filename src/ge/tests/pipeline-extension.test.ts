import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../configuration-loader.js';
import { GetPipelineCatalog } from '../pipeline-catalog.js';
import type { PipelineElementExtension } from '../pipeline-extension.js';
import type { EdgeRouting, IEdgeRouter } from '../edge-router/index.js';

// A consumer-supplied edge router, tagged so the test can read back which
// instance BuildPipeline constructed and with what params.
class TaggedRouter implements IEdgeRouter {
    public readonly Name = 'Tagged';
    public readonly AlgorithmName = 'test';
    public readonly AcademicReferences = [];
    constructor(public readonly weight: number) {}
    public Route(): Map<never, EdgeRouting> { return new Map<never, EdgeRouting>(); }
}

const taggedExt: PipelineElementExtension = {
    stage:         'edge-router',
    className:     'TaggedRouter',
    name:          'Tagged Router',
    algorithmName: 'test',
    parameters:    [{ key: 'weight', type: 'number', default: 0 }],
    build: (params) => new TaggedRouter(typeof params?.weight === 'number' ? params.weight : -1),
};

test('BuildPipeline resolves a consumer extension by className (no-arg)', () => {
    const config: PipelineConfiguration = {
        name: 't', transforms: [], layout: { edgeRouter: 'TaggedRouter' },
    };
    const { layoutPipeline } = BuildPipeline(config, LoadElementRepository(), [taggedExt]);
    assert.ok(layoutPipeline.edgeRouter instanceof TaggedRouter);
    assert.equal((layoutPipeline.edgeRouter as TaggedRouter).weight, -1);
});

test('an extension build receives declarative params', () => {
    const config: PipelineConfiguration = {
        name: 't', transforms: [],
        layout: { edgeRouter: { className: 'TaggedRouter', params: { weight: 5 } } },
    };
    const { layoutPipeline } = BuildPipeline(config, LoadElementRepository(), [taggedExt]);
    assert.equal((layoutPipeline.edgeRouter as TaggedRouter).weight, 5);
});

test('an unknown className still throws when no extension declares it', () => {
    const config: PipelineConfiguration = {
        name: 't', transforms: [], layout: { edgeRouter: 'TaggedRouter' },
    };
    assert.throws(() => BuildPipeline(config, LoadElementRepository()), /not declared in the repo/);
});

test('an extension only applies to its declared stage', () => {
    // TaggedRouter is declared for edge-router; naming it as a reorderer
    // must not resolve (the reorderer stage has no such extension).
    const config: PipelineConfiguration = {
        name: 't', transforms: [], layout: { reorderer: 'TaggedRouter' },
    };
    assert.throws(() => BuildPipeline(config, LoadElementRepository(), [taggedExt]), /not declared in the repo/);
});

test('GetPipelineCatalog appends extensions to their stage', () => {
    const slot = GetPipelineCatalog([taggedExt]).find((s) => s.slotId === 'edge-router')!;
    const entry = slot.strategies.find((s) => s.className === 'TaggedRouter');
    assert.ok(entry, 'extension appears in the edge-router slot');
    assert.equal(entry!.name, 'Tagged Router');
    assert.ok(entry!.parameters?.some((p) => p.key === 'weight'));
    // Built-ins are still present alongside the extension.
    assert.ok(slot.strategies.some((s) => s.className === 'StraightLineEdgeRouter'));
});

test('GetPipelineCatalog without extensions is unchanged', () => {
    const slot = GetPipelineCatalog().find((s) => s.slotId === 'edge-router')!;
    assert.equal(slot.strategies.some((s) => s.className === 'TaggedRouter'), false);
});
