// Declarative parameters for the parameterized LAYOUT strategies (the
// Sugiyama pipeline stages), plus a builder that constructs each strategy
// from a plain {key: value} map. This is the single source for:
//   - the catalog's per-strategy `parameters` (what a builder UI renders), and
//   - BuildPipeline's parameter-aware construction.
//
// Every listed constructor takes only primitive config knobs with defaults, so
// a partial/empty value map is always safe (missing keys fall back to default).

import type { CatalogParam } from './pipeline-catalog.js';
import type { IPipelineElement } from './pipeline-element.js';

import { BarycenterReorderer, MedianReorderer } from './reorderer/index.js';
import { SiftingImprover, TransposeImprover, IlpExactImprover } from './improver/index.js';
import { BrandesKopfPositionComputer, CenteredGridPositionComputer } from './position-computer/index.js';
import { CardinalPortAssigner, DistributedPortAssigner } from './port-assigner/index.js';
import { BarycenterVerticalAligner } from './vertical-aligner/index.js';
import { AdjacentLayerMoveImprover } from './layer-improver/index.js';

export type StrategyParamValues = Record<string, number | boolean>;

export interface StrategyParamDef
{
    params: CatalogParam[];
    build:  (v: StrategyParamValues) => IPipelineElement;
}

function num(v: StrategyParamValues, key: string, def: number): number
{
    return typeof v[key] === 'number' ? v[key] as number : def;
}

function bool(v: StrategyParamValues, key: string, def: boolean): boolean
{
    return typeof v[key] === 'boolean' ? v[key] as boolean : def;
}

const N = (key: string, def: number): CatalogParam => ({ key, type: 'number', default: def });
const B = (key: string, def: boolean): CatalogParam => ({ key, type: 'boolean', default: def });

export const STRATEGY_PARAMS: Record<string, StrategyParamDef> = {
    BarycenterReorderer: { params: [N('iterations', 12)], build: (v) => new BarycenterReorderer(num(v, 'iterations', 12)) },
    MedianReorderer:     { params: [N('iterations', 12)], build: (v) => new MedianReorderer(num(v, 'iterations', 12)) },

    SiftingImprover:   { params: [N('maxPasses', 1)],   build: (v) => new SiftingImprover(num(v, 'maxPasses', 1)) },
    TransposeImprover: { params: [N('maxPasses', 100)], build: (v) => new TransposeImprover(num(v, 'maxPasses', 100)) },
    IlpExactImprover:  { params: [N('maxPasses', 8), N('maxLayerSize', 9)], build: (v) => new IlpExactImprover(num(v, 'maxPasses', 8), num(v, 'maxLayerSize', 9)) },

    BrandesKopfPositionComputer:  { params: [N('layerSpacingY', 100), N('nodeSpacingX', 110), N('padding', 50)], build: (v) => new BrandesKopfPositionComputer(num(v, 'layerSpacingY', 100), num(v, 'nodeSpacingX', 110), num(v, 'padding', 50)) },
    CenteredGridPositionComputer: { params: [N('layerSpacingY', 100), N('nodeSpacingX', 110), N('padding', 50)], build: (v) => new CenteredGridPositionComputer(num(v, 'layerSpacingY', 100), num(v, 'nodeSpacingX', 110), num(v, 'padding', 50)) },

    CardinalPortAssigner:    { params: [N('nodeRadius', 28)], build: (v) => new CardinalPortAssigner(num(v, 'nodeRadius', 28)) },
    DistributedPortAssigner: { params: [N('nodeRadius', 28), N('anglePerPortDeg', 15)], build: (v) => new DistributedPortAssigner(num(v, 'nodeRadius', 28), num(v, 'anglePerPortDeg', 15)) },

    BarycenterVerticalAligner: { params: [N('iterations', 8), N('minSpacing', 180), N('clearance', 32)], build: (v) => new BarycenterVerticalAligner(num(v, 'iterations', 8), num(v, 'minSpacing', 180), num(v, 'clearance', 32)) },

    AdjacentLayerMoveImprover: { params: [N('maxPasses', 10), B('allowSameLayerNeighbors', true)], build: (v) => new AdjacentLayerMoveImprover(num(v, 'maxPasses', 10), bool(v, 'allowSameLayerNeighbors', true)) },
};
