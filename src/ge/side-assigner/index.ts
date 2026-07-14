// Side assignment — the diagram-facing sibling of the port-assigner
// stage. Instead of projecting each edge endpoint onto a concrete
// boundary point (for Fresco's own SVG router), a side assigner picks
// the cardinal side of each node the edge attaches to and hands the
// exact point + parallel-connector fan-out to the consuming diagram's
// automatic port assignment (e.g. mural's PortSide slot distribution).
export { Side, type EdgeSides, type ISideAssigner } from './side-assigner.js';
export { CardinalSideAssigner }                     from './cardinal-side-assigner.js';
