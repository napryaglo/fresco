// Barrel re-exports for the `ge` graph-visualization framework.
// Consumers (currently main.ts; future experiment scripts) import
// from here rather than the individual files. Strategy implementations
// live in stage-named subfolders; this barrel re-exports each
// subfolder's index for one-stop consumption.
export { Node, Edge, Graph } from './graph.js';
export { type Size, type Rect, boundingBox } from './geometry.js';
export { NestedCompoundLayout } from './compound/nested-compound-layout.js';
export { PortSide, type Port, portId } from './compound/port.js';
export { childrenOf, isContainer, ancestors, lca } from './compound/hierarchy.js';
export { globalRank, portSideFor } from './compound/orientation.js';
export {
    NodeVisual,
    EdgeVisual,
    BuildScene,
    type SceneStyle,
} from './scene.js';
export * from './layer-assigner/index.js';        // Stage 2
export * from './dummy-inserter/index.js';        // Stage 5
export * from './position-computer/index.js';     // Stage 8
export * from './crossing-counter/index.js';      // diagnostics
export * from './vertical-aligner/index.js';      // Stage 9
export * from './edge-router/index.js';           // Stage 10
export * from './port-assigner/index.js';         // Stage 11
export * from './layouts/index.js';
export * from './graph-transforms/index.js';      // Stage 1
export * from './layer-improver/index.js';        // Stage 3
export * from './first-layer-orderer/index.js';   // Stage 4
export * from './reorderer/index.js';             // Stage 6
export * from './improver/index.js';              // Stage 7
export {
    type IPipelineElement,
    type AcademicReference,
} from './pipeline-element.js';
export {
    type PipelineConfiguration,
    type PipelineElementRepository,
    type TransformSpec,
    type LayoutStageSpec,
    type StageValue,
    type StageEntry,
    type OffSpec,
    LoadElementRepository,
    ListStrategyNames,
    ValidateRepositoryAgainstClasses,
    BuildPipeline,
} from './configuration-loader.js';
export { type PipelineElementExtension } from './pipeline-extension.js';
// Note: LoadConfigurationFile / GetConfiguration / LoadElementRepositoryFromFile
// live in configuration-loader-node.ts (they use node:fs) and are intentionally
// NOT re-exported here — importing this barrel must stay browser-safe. Node/CLI
// callers import them from './configuration-loader-node.js' directly.
export { type TransformParams } from './transform-params.js';
export {
    type CatalogParam,
    type CatalogStrategy,
    type CatalogSlot,
    GetPipelineCatalog,
} from './pipeline-catalog.js';
