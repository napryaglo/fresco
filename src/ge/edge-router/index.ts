// Stage 10 — Edge Routing.
// Interface and concrete implementations for deciding how each original
// edge is drawn. Runs after position computation + vertical alignment.
// A router emits either Fresco polyline waypoints (bending long edges
// through their dummy chain) or cardinal sides for a host diagram to
// route natively — see EdgeRouting.
export { Side, type EdgeRouting, type IEdgeRouter } from './edge-router.js';
export { PolylineEdgeRouter }             from './polyline-edge-router.js';
export { OrthogonalEdgeRouter }           from './orthogonal-edge-router.js';
export { StraightLineEdgeRouter }         from './straight-line-edge-router.js';
export { CardinalSideRouter, cardinalSides } from './cardinal-side-router.js';
