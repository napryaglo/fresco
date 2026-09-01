import type { Point } from '@pragmatic-tech-ai/mural/runtime';
import type { Edge } from '../graph.js';
import type { Size } from '../geometry.js';
import type { IPipelineElement } from '../pipeline-element.js';

// Strategy interface for the POSITION COMPUTATION stage: maps a
// finished layer ordering (each layer = ordered list of node Ids,
// possibly including dummy nodes) to per-node (x, y) coordinates.
//
// Contract:
//   * Returned map contains an entry for every Id present in any
//     layer of the input (dummies included; the caller is
//     responsible for filtering dummies if it doesn't want them
//     rendered).
//   * All coordinates should be non-negative — HeadlessTarget's
//     auto-bounds machinery requires that.
//   * `edges` is OPTIONAL — only edge-aware computers (e.g. the
//     Brandes–Köpf coordinate assigner) use it; centred-grid-style
//     computers can ignore the argument.
//   * `sizes` is OPTIONAL — maps a node id to its intrinsic Size.
//     Size-aware computers (Brandes–Köpf) use it to widen in-layer gaps
//     and layer bands for larger nodes (e.g. container boxes); absent
//     ids are treated as 0×0, which reproduces the uniform-spacing
//     behaviour. Computers that ignore it lay out as before.
export interface IPositionComputer extends IPipelineElement
{
    Compute(layers: string[][], edges?: Edge[], sizes?: Map<string, Size>): Map<string, Point>;
}
