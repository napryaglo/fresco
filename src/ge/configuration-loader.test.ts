import { test } from 'node:test';
import assert from 'node:assert/strict';

import { LoadElementRepository, ValidateRepositoryAgainstClasses } from './configuration-loader.js';

test('LoadElementRepository returns metadata for a known strategy without fs', () => {
    const repo = LoadElementRepository();
    assert.equal(repo['layer-assigner']!['LongestPathLayerAssigner']!.name, 'Longest Path');
    assert.ok(Array.isArray(repo['graph-transforms']!['DedupEdgesTransform']!.references));
});

test('the static element repository matches the code-side metadata exactly', () => {
    // Cross-checks every name / algorithm / reference in pipeline-elements-data.ts
    // against the class instances — guards against transcription drift.
    ValidateRepositoryAgainstClasses(LoadElementRepository());
});
