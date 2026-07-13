// Node-only configuration loading. Kept separate from configuration-loader.ts
// (and OUT of the package barrel) so the browser-facing surface never imports
// node:fs — importing node:fs in a Vite/renderer bundle throws at module eval.
// Dev/CLI code (main.ts) imports these directly.

import { readFileSync } from 'node:fs';

import { parse as parseYaml } from 'yaml';

import type { PipelineConfiguration, PipelineElementRepository } from './configuration-loader.js';

interface ConfigurationFile
{
    configurations: PipelineConfiguration[];
}

// Reads the element metadata repo from a yaml file. The runtime path uses the
// static LoadElementRepository() instead; this is for tooling that wants to
// read the yaml directly (e.g. validating a hand-edited file).
export function LoadElementRepositoryFromFile(filePath: string): PipelineElementRepository
{
    return parseYaml(readFileSync(filePath, 'utf8')) as PipelineElementRepository;
}

export function LoadConfigurationFile(filePath: string): PipelineConfiguration[]
{
    const text = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(text) as ConfigurationFile;
    return parsed.configurations;
}

export function GetConfiguration(filePath: string, name: string): PipelineConfiguration
{
    const all = LoadConfigurationFile(filePath);
    const match = all.find(c => c.name === name);
    if (match === undefined)
    {
        throw new Error(
            `Configuration "${name}" not found in ${filePath}. Available: ${all.map(c => c.name).join(', ')}`,
        );
    }
    return match;
}
