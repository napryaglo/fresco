// PipelineCatalog — a pure-data description of every user-configurable
// pipeline slot and the strategies available for it, joined from the
// strategy registries (the authoritative className list) and the element
// metadata module (display name / algorithm / references).
//
// This is what a builder UI (e.g. Plexus's layout inspector) enumerates
// to render the composer generically, so it never hardcodes Fresco's
// strategy list. It is pure data and browser-safe (no fs).

import type { AcademicReference } from './pipeline-element.js';
import type { PipelineElementExtension } from './pipeline-extension.js';
import { ListStrategyNames, LoadElementRepository } from './configuration-loader.js';
import { STRATEGY_PARAMS } from './strategy-params.js';

export interface CatalogParam
{
    key:      string;
    type:     'string' | 'number' | 'boolean' | 'enum';
    values?:  string[];
    default?: string | number | boolean;
}

export interface CatalogStrategy
{
    className:     string;
    name:          string;
    algorithmName: string;
    references:    AcademicReference[];
    parameters?:   CatalogParam[];
}

export interface CatalogSlot
{
    slotId:     string;
    kind:       'transform-list' | 'strategy-slot';
    required:   boolean;
    strategies: CatalogStrategy[];
}

// Slot presentation order for the builder. 'crossing-counter' is
// deliberately omitted — it is an internal diagnostic stage, not
// selectable through PipelineConfiguration, so it is not a builder slot.
const SLOT_ORDER: readonly string[] = [
    'graph-transforms',
    'layer-assigner',
    'layer-improver',
    'first-layer-orderer',
    'dummy-inserter',
    'reorderer',
    'improver',
    'position-computer',
    'vertical-aligner',
    'edge-router',
    'port-assigner',
];

// Slots LayoutPipeline has no meaningful "off" for — the builder must
// keep a strategy selected. Everything else is optional (may be null).
const REQUIRED_SLOTS = new Set<string>([
    'layer-assigner',
    'dummy-inserter',
    'reorderer',
    'position-computer',
]);

// Declarative parameters for the parameterized graph transforms. Kept in
// sync with transform-params.ts; anything not listed here has no UI
// parameters. MapLabelsTransform needs a mapping function and is not
// declaratively parameterizable, so it carries no params (v1).
const PARAMS: Record<string, CatalogParam[]> = {
    FilterNodesTransform: [
        { key: 'field', type: 'enum', values: ['label', 'id'], default: 'label' },
        { key: 'op',    type: 'enum', values: ['contains', 'equals', 'matches'], default: 'contains' },
        { key: 'value', type: 'string', default: '' },
    ],
    FilterEdgesTransform: [
        { key: 'field', type: 'enum', values: ['from', 'to'], default: 'from' },
        { key: 'op',    type: 'enum', values: ['contains', 'equals', 'matches'], default: 'contains' },
        { key: 'value', type: 'string', default: '' },
    ],
};

// Fallback display name for a class with no metadata entry: strip a
// common role suffix and space out the CamelCase.
function pretty(className: string): string
{
    return className
        .replace(/(Transform|Reorderer|Assigner|Computer|Inserter|Router|Aligner|Orderer|Improver)$/, '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .trim();
}

// Builds the catalog. When `extensions` are supplied, each consumer element
// is appended to its stage's strategy list (after the built-ins), so a
// builder UI surfaces custom options alongside Fresco's own — the same list
// BuildPipeline resolves against.
export function GetPipelineCatalog(extensions?: readonly PipelineElementExtension[]): CatalogSlot[]
{
    const names = ListStrategyNames();
    const repo = LoadElementRepository();
    const slots: CatalogSlot[] = [];

    for (const slotId of SLOT_ORDER)
    {
        const classNames = names[slotId] ?? [];
        const strategies: CatalogStrategy[] = classNames.map((cn) => {
            const meta = repo[slotId]?.[cn];
            const strategy: CatalogStrategy = {
                className:     cn,
                name:          meta?.name ?? pretty(cn),
                algorithmName: meta?.algorithm ?? '',
                references:    (meta?.references ?? []) as AcademicReference[],
            };
            // Transforms declare params here; layout strategies declare them
            // in strategy-params.ts (the same source BuildPipeline constructs from).
            const params = PARAMS[cn] ?? STRATEGY_PARAMS[cn]?.params;
            if (params) strategy.parameters = params;
            return strategy;
        });

        for (const e of extensions ?? [])
        {
            if (e.stage !== slotId) continue;
            const strategy: CatalogStrategy = {
                className:     e.className,
                name:          e.name,
                algorithmName: e.algorithmName,
                references:    e.references ?? [],
            };
            if (e.parameters) strategy.parameters = e.parameters;
            strategies.push(strategy);
        }

        slots.push({
            slotId,
            kind:       slotId === 'graph-transforms' ? 'transform-list' : 'strategy-slot',
            required:   REQUIRED_SLOTS.has(slotId),
            strategies,
        });
    }

    return slots;
}
