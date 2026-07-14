import type { IPipelineElement, AcademicReference } from './pipeline-element.js';
import type { CatalogParam } from './pipeline-catalog.js';

// A consumer-supplied pipeline element, injected into BuildPipeline and
// GetPipelineCatalog so a host (e.g. Plexus) can extend the pipeline with
// its own implementations without them living in Fresco.
//
// An extension registers one class for one stage. Its `build` owns
// construction (with optional declarative params) and MUST return an
// element conforming to that stage's strategy interface — e.g. a
// 'edge-router' extension returns an IEdgeRouter. Because the consumer
// declares it, an extension bypasses the repo (meta-model) validation
// that built-in class names are checked against.
//
// The metadata (name / algorithmName / references / parameters) is what a
// builder UI shows for the option; it mirrors what the element repository
// carries for built-ins.
export interface PipelineElementExtension
{
    // The stage this element plugs into — a strategy-slot id such as
    // 'edge-router', 'reorderer', 'position-computer'. Must match the
    // stage names used in the configuration / catalog.
    stage:         string;
    // Unique class name referenced from PipelineConfiguration.layout and
    // shown as the option's value.
    className:     string;
    name:          string;
    algorithmName: string;
    references?:   AcademicReference[];
    parameters?:   CatalogParam[];
    build(params?: Record<string, number | boolean>): IPipelineElement;
}
