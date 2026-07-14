import { elementRepository } from './pipeline-elements-data.js';
import { buildNodePredicate, buildEdgePredicate, type TransformParams } from './transform-params.js';
import { STRATEGY_PARAMS } from './strategy-params.js';

import {
    AdjacentCrossingCounter,
    AdjacentLayerMoveImprover,
    BarycenterReorderer,
    BarycenterVerticalAligner,
    BrandesKopfPositionComputer,
    CardinalPortAssigner,
    CenteredGridPositionComputer,
    ChainDummyInserter,
    CollapseAntiparallelEdgesTransform,
    DedupEdgesTransform,
    DistributedPortAssigner,
    DropIsolatedNodesTransform,
    FilterEdgesTransform,
    FilterNodesTransform,
    GeometricCrossingCounter,
    GraphPipeline,
    GreedySwitchImprover,
    IdentityFirstLayerOrderer,
    IlpExactImprover,
    LayoutPipeline,
    LongestPathLayerAssigner,
    MapLabelsTransform,
    CardinalSideRouter,
    MedianReorderer,
    OrthogonalEdgeRouter,
    OutDegreeFirstLayerOrderer,
    PolylineEdgeRouter,
    SiftingImprover,
    SparseDummyInserter,
    StraightLineEdgeRouter,
    TransposeImprover,
    type IDummyInserter,
    type IEdgeRouter,
    type IFirstLayerOrderer,
    type IGraphTransform,
    type ILayerAssigner,
    type ILayerImprover,
    type ILocalImprover,
    type IPipelineElement,
    type IPortAssigner,
    type IPositionComputer,
    type IReorderer,
    type IVerticalAligner,
} from './index.js';

// One entry in the pipeline-configurations file.
//
// Field semantics for the `layout` block:
//   * missing field / null → use the stage's default (BuildPipeline
//                          supplies it; for the optional stages that
//                          default to OFF this means the stage is
//                          skipped)
//   * "ClassName" string → instantiate that strategy class
//                          (no-arg constructor; the class must be
//                          registered in the lookup tables below)
//   * { className, params } → instantiate with declarative params
//   * { off: true }      → explicitly OFF (only valid for optional
//                          stages: improver, layerImprover,
//                          verticalAligner, edgeRouter, portAssigner)
//
// A parameterized transform entry: a class name plus declarative params
// (see transform-params.ts). Currently FilterNodesTransform and
// FilterEdgesTransform are parameterizable this way. Plain no-arg
// transforms are referenced by their class-name string.
export interface TransformSpec
{
    className: string;
    params?:   TransformParams;
}

// A layout stage entry: a plain class-name string (no-arg construction) OR a
// spec carrying declarative numeric/boolean params (see strategy-params.ts).
export interface LayoutStageSpec
{
    className: string;
    params?:   Record<string, number | boolean>;
}

export type StageValue = string | LayoutStageSpec;

// Explicit "this optional stage is off" — distinct from an absent field
// (which uses the stage's default) and from a strategy value.
export type OffSpec = { off: true };

// An optional stage's configured value: a strategy, or an explicit off.
export type StageEntry = StageValue | OffSpec;

export interface PipelineConfiguration
{
    name:         string;
    description?: string;
    transforms:   (string | TransformSpec)[];
    layout: {
        layerAssigner?:     StageValue;
        firstLayerNodes?:   string[];
        firstLayerOrderer?: StageValue;
        layerImprover?:     StageEntry | null;
        dummyInserter?:     StageValue;
        reorderer?:         StageValue;
        improver?:          StageEntry | null;
        positionComputer?:  StageValue;
        verticalAligner?:   StageEntry | null;
        portAssigner?:      StageEntry | null;
        edgeRouter?:        StageEntry | null;
    };
}

// ------------------------------------------------------------------
// Strategy registries — one per stage. To make a new implementation
// available in JSON, add it to the appropriate map. All factories
// take no arguments; switch to a (PipelineConfiguration, opts) shape
// the day strategies start carrying parameters.
// ------------------------------------------------------------------
// Transforms with no-arg constructors — these are configurable from
// JSON. The three parameterized transforms (filter / map-labels) are
// kept in PARAMETERIZED_TRANSFORMS below so the YAML repo can still
// catalogue them, but a configuration referencing them will throw.
const TRANSFORMS: Record<string, () => IGraphTransform> = {
    DedupEdgesTransform:                () => new DedupEdgesTransform(),
    CollapseAntiparallelEdgesTransform: () => new CollapseAntiparallelEdgesTransform(),
    DropIsolatedNodesTransform:         () => new DropIsolatedNodesTransform(),
};

// Transforms that need a callback at construction time. Listed here
// so they can carry metadata in the YAML repo and pass validation;
// instantiated with a stub callback for the metadata cross-check
// only. BuildPipeline does NOT consider these when resolving a
// configuration's transform list.
const PARAMETERIZED_TRANSFORMS: Record<string, () => IGraphTransform> = {
    FilterNodesTransform: () => new FilterNodesTransform(() => true),
    FilterEdgesTransform: () => new FilterEdgesTransform(() => true),
    MapLabelsTransform:   () => new MapLabelsTransform(n => n.Label),
};

const LAYER_ASSIGNERS: Record<string, () => ILayerAssigner> = {
    LongestPathLayerAssigner: () => new LongestPathLayerAssigner(),
};

const FIRST_LAYER_ORDERERS: Record<string, () => IFirstLayerOrderer> = {
    IdentityFirstLayerOrderer:  () => new IdentityFirstLayerOrderer(),
    OutDegreeFirstLayerOrderer: () => new OutDegreeFirstLayerOrderer(),
};

const LAYER_IMPROVERS: Record<string, () => ILayerImprover> = {
    AdjacentLayerMoveImprover: () => new AdjacentLayerMoveImprover(),
};

const DUMMY_INSERTERS: Record<string, () => IDummyInserter> = {
    ChainDummyInserter:  () => new ChainDummyInserter(),
    SparseDummyInserter: () => new SparseDummyInserter(),
};

const REORDERERS: Record<string, () => IReorderer> = {
    BarycenterReorderer: () => new BarycenterReorderer(),
    MedianReorderer:     () => new MedianReorderer(),
};

const IMPROVERS: Record<string, () => ILocalImprover> = {
    TransposeImprover:    () => new TransposeImprover(),
    GreedySwitchImprover: () => new GreedySwitchImprover(),
    SiftingImprover:      () => new SiftingImprover(),
    IlpExactImprover:     () => new IlpExactImprover(),
};

const POSITION_COMPUTERS: Record<string, () => IPositionComputer> = {
    CenteredGridPositionComputer: () => new CenteredGridPositionComputer(),
    BrandesKopfPositionComputer:  () => new BrandesKopfPositionComputer(),
};

const VERTICAL_ALIGNERS: Record<string, () => IVerticalAligner> = {
    BarycenterVerticalAligner: () => new BarycenterVerticalAligner(),
};

const PORT_ASSIGNERS: Record<string, () => IPortAssigner> = {
    CardinalPortAssigner:    () => new CardinalPortAssigner(),
    DistributedPortAssigner: () => new DistributedPortAssigner(),
};

const EDGE_ROUTERS: Record<string, () => IEdgeRouter> = {
    PolylineEdgeRouter:     () => new PolylineEdgeRouter(),
    OrthogonalEdgeRouter:   () => new OrthogonalEdgeRouter(),
    StraightLineEdgeRouter: () => new StraightLineEdgeRouter(),
    CardinalSideRouter:     () => new CardinalSideRouter(),
};

// Crossing counters aren't user-selectable from configurations, but
// they're still pipeline elements — include them so the YAML repo
// validates fully.
const CROSSING_COUNTERS: Record<string, () => IPipelineElement> = {
    GeometricCrossingCounter: () => new GeometricCrossingCounter(),
    AdjacentCrossingCounter:  () => new AdjacentCrossingCounter(),
};

// Stage-name → registry mapping. The stage names here must match
// the top-level keys in pipeline-elements.yaml.
const STAGE_REGISTRIES: Record<string, Record<string, () => IPipelineElement>> = {
    'graph-transforms':    { ...TRANSFORMS, ...PARAMETERIZED_TRANSFORMS },
    'layer-assigner':      LAYER_ASSIGNERS,
    'layer-improver':      LAYER_IMPROVERS,
    'first-layer-orderer': FIRST_LAYER_ORDERERS,
    'dummy-inserter':      DUMMY_INSERTERS,
    'reorderer':           REORDERERS,
    'improver':            IMPROVERS,
    'position-computer':   POSITION_COMPUTERS,
    'vertical-aligner':    VERTICAL_ALIGNERS,
    'port-assigner':       PORT_ASSIGNERS,
    'edge-router':         EDGE_ROUTERS,
    'crossing-counter':    CROSSING_COUNTERS,
};

// The className keys registered for each stage. Drives the catalog and
// lets consumers enumerate the available strategies per slot without
// reaching into the private registries.
export function ListStrategyNames(): Record<string, string[]>
{
    const out: Record<string, string[]> = {};
    for (const [stage, registry] of Object.entries(STAGE_REGISTRIES))
    {
        out[stage] = Object.keys(registry);
    }
    return out;
}

// ------------------------------------------------------------------
// YAML repo — pipeline-elements.yaml.
// ------------------------------------------------------------------
interface YamlReference
{
    authors: string;
    year:    number;
    title:   string;
    venue?:  string;
}

interface YamlElement
{
    name:        string;
    algorithm:   string;
    references?: YamlReference[];
}

export type PipelineElementRepository = Record<string /* stage */, Record<string /* className */, YamlElement>>;

// Returns the statically-imported, browser-safe metadata module. This is
// the only element-repository source used at runtime (renderer + catalog +
// BuildPipeline); reading the yaml from fs lives in configuration-loader-node.ts
// so this module stays free of node:fs and safe to import in the browser.
export function LoadElementRepository(): PipelineElementRepository
{
    return elementRepository;
}

// Cross-checks the repo entries against the class-side metadata.
// Throws on any drift: stage missing from registries, repo entry
// missing a registry match (or vice-versa), name/algorithm mismatch,
// or reference list shape mismatch.
export function ValidateRepositoryAgainstClasses(repo: PipelineElementRepository): void
{
    const errors: string[] = [];

    for (const stage of Object.keys(repo))
    {
        const registry = STAGE_REGISTRIES[stage];
        if (registry === undefined)
        {
            errors.push(`YAML stage "${stage}" has no matching registry in configuration-loader.ts`);
            continue;
        }
        const entries = repo[stage]!;
        for (const className of Object.keys(entries))
        {
            const factory = registry[className];
            if (factory === undefined)
            {
                errors.push(`YAML entry "${stage}.${className}" has no matching class registered`);
                continue;
            }
            const inst = factory();
            const yml  = entries[className]!;

            if (inst.Name !== yml.name)
            {
                errors.push(`Name drift on ${stage}.${className}: class="${inst.Name}" yaml="${yml.name}"`);
            }
            if (inst.AlgorithmName !== yml.algorithm)
            {
                errors.push(`AlgorithmName drift on ${stage}.${className}: class="${inst.AlgorithmName}" yaml="${yml.algorithm}"`);
            }
            const ymlRefs = yml.references ?? [];
            if (inst.AcademicReferences.length !== ymlRefs.length)
            {
                errors.push(`AcademicReferences length drift on ${stage}.${className}: class=${inst.AcademicReferences.length} yaml=${ymlRefs.length}`);
            }
            else
            {
                for (let i = 0; i < ymlRefs.length; i++)
                {
                    const r = inst.AcademicReferences[i]!;
                    const y = ymlRefs[i]!;
                    if (r.authors !== y.authors || r.year !== y.year || r.title !== y.title || (r.venue ?? undefined) !== (y.venue ?? undefined))
                    {
                        errors.push(`AcademicReferences[${i}] drift on ${stage}.${className}`);
                    }
                }
            }
        }
        // Reverse direction: every registry entry must appear in the YAML.
        for (const className of Object.keys(registry))
        {
            if (!(className in entries))
            {
                errors.push(`Class ${stage}.${className} is registered in code but missing from the YAML repo`);
            }
        }
    }

    // Stages that exist in code but aren't in the YAML repo.
    for (const stage of Object.keys(STAGE_REGISTRIES))
    {
        if (!(stage in repo))
        {
            errors.push(`Stage "${stage}" is registered in code but missing from the YAML repo`);
        }
    }

    if (errors.length > 0)
    {
        throw new Error(
            `Pipeline element repository validation failed:\n  - ${errors.join('\n  - ')}`,
        );
    }
}

// ------------------------------------------------------------------
// Lookup helpers. The registries above carry both "what factory" and
// "what stage" — these helpers add validation against the repo so
// every name a configuration references must appear in the YAML.
// ------------------------------------------------------------------
function pick<T extends IPipelineElement>(
    registry: Record<string, () => T>,
    repo:     PipelineElementRepository,
    stage:    string,
    name:     string | undefined,
): T | undefined
{
    if (name === undefined) return undefined;
    if (!(stage in repo) || !(name in (repo[stage] ?? {})))
    {
        throw new Error(
            `Configuration references ${stage}.${name}, which is not declared in the YAML repo.`,
        );
    }
    const factory = registry[name];
    if (factory === undefined)
    {
        throw new Error(
            `Unknown ${stage} strategy "${name}". Registered: ${Object.keys(registry).join(', ')}`,
        );
    }
    return factory();
}

// The explicit "off" sentinel for an optional stage.
function isOff(value: unknown): value is OffSpec
{
    return typeof value === 'object' && value !== null && (value as { off?: unknown }).off === true;
}

// Resolves an OPTIONAL stage, distinguishing three cases the required-stage
// resolver can't: an explicit { off: true } → skip; an absent value → the
// stage's default (via defaultFactory, or skip when none); otherwise build
// the named strategy. This is where "off" actually reaches the pipeline as
// undefined — the LayoutPipeline constructor no longer defaults these
// stages, so undefined genuinely skips them.
function optionalStage<T extends IPipelineElement>(
    registry:        Record<string, () => T>,
    repo:            PipelineElementRepository,
    stage:           string,
    value:           StageEntry | null | undefined,
    defaultFactory?: () => T,
): T | undefined
{
    if (isOff(value)) return undefined;
    if (value === null || value === undefined) return defaultFactory ? defaultFactory() : undefined;
    return resolveStage(registry, repo, stage, value);
}

// Resolves one layout stage value: null/undefined → use LayoutPipeline's
// default; a class-name string → no-arg construction; a LayoutStageSpec with
// params → parameterized construction via strategy-params.ts. Every referenced
// class must be declared in the repo.
function resolveStage<T extends IPipelineElement>(
    registry: Record<string, () => T>,
    repo:     PipelineElementRepository,
    stage:    string,
    value:    StageValue | null | undefined,
): T | undefined
{
    if (value === null || value === undefined) return undefined;
    const className = typeof value === 'string' ? value : value.className;
    if (!(stage in repo) || !(className in (repo[stage] ?? {})))
    {
        throw new Error(`Configuration references ${stage}.${className}, which is not declared in the repo.`);
    }
    if (typeof value !== 'string' && value.params !== undefined)
    {
        const def = STRATEGY_PARAMS[className];
        if (def !== undefined) return def.build(value.params) as T;
    }
    const factory = registry[className];
    if (factory === undefined)
    {
        throw new Error(`Unknown ${stage} strategy "${className}". Registered: ${Object.keys(registry).join(', ')}`);
    }
    return factory();
}

// ------------------------------------------------------------------
// Public API.
// ------------------------------------------------------------------

// Resolves one transform entry: a plain class-name string (no-arg
// transform) or a TransformSpec carrying declarative params for a
// parameterized filter transform. Every referenced class must be
// declared in the YAML/data repo, same as the layout strategies.
function buildTransform(entry: string | TransformSpec, repo: PipelineElementRepository): IGraphTransform
{
    if (typeof entry === 'string')
    {
        const t = pick(TRANSFORMS, repo, 'graph-transforms', entry);
        if (t === undefined) throw new Error(`graph-transforms entry "${entry}" could not be resolved`);
        return t;
    }

    const stage = repo['graph-transforms'] ?? {};
    if (!(entry.className in stage))
    {
        throw new Error(`Configuration references graph-transforms.${entry.className}, which is not declared in the repo.`);
    }

    if (entry.params !== undefined)
    {
        if (entry.className === 'FilterNodesTransform') return new FilterNodesTransform(buildNodePredicate(entry.params));
        if (entry.className === 'FilterEdgesTransform') return new FilterEdgesTransform(buildEdgePredicate(entry.params));
        throw new Error(`Transform "${entry.className}" does not accept declarative params.`);
    }

    // A spec without params must name a no-arg transform.
    const t = pick(TRANSFORMS, repo, 'graph-transforms', entry.className);
    if (t === undefined) throw new Error(`graph-transforms entry "${entry.className}" could not be resolved`);
    return t;
}

export function BuildPipeline(
    config: PipelineConfiguration,
    repo:   PipelineElementRepository,
): {
    graphPipeline:  GraphPipeline;
    layoutPipeline: LayoutPipeline;
}
{
    const graphPipeline = new GraphPipeline();
    for (const entry of config.transforms)
    {
        graphPipeline.Add(buildTransform(entry, repo));
    }

    const L = config.layout;
    const layoutPipeline = new LayoutPipeline(
        resolveStage(REORDERERS,             repo, 'reorderer',           L.reorderer),
        optionalStage(IMPROVERS,             repo, 'improver',            L.improver),
        resolveStage(FIRST_LAYER_ORDERERS,   repo, 'first-layer-orderer', L.firstLayerOrderer),
        L.firstLayerNodes !== undefined ? new Set(L.firstLayerNodes) : undefined,
        optionalStage(LAYER_IMPROVERS,       repo, 'layer-improver',      L.layerImprover),
        resolveStage(LAYER_ASSIGNERS,        repo, 'layer-assigner',      L.layerAssigner),
        resolveStage(DUMMY_INSERTERS,        repo, 'dummy-inserter',      L.dummyInserter),
        resolveStage(POSITION_COMPUTERS,     repo, 'position-computer',   L.positionComputer),
        undefined,  // geometricCounter — keep default
        undefined,  // adjacentCounter  — keep default
        undefined,  // maxLayerImproverIterations — keep default
        optionalStage(VERTICAL_ALIGNERS,     repo, 'vertical-aligner',    L.verticalAligner),
        // edge-router and port-assigner are ON by default: BuildPipeline
        // supplies the default here (the constructor no longer does), so
        // { off: true } can genuinely skip them.
        optionalStage(EDGE_ROUTERS,          repo, 'edge-router',         L.edgeRouter,   () => new StraightLineEdgeRouter()),
        optionalStage(PORT_ASSIGNERS,        repo, 'port-assigner',       L.portAssigner, () => new DistributedPortAssigner()),
    );

    return { graphPipeline, layoutPipeline };
}
