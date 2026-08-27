import type { Edge } from '../graph.js';

// Which border of a container box a port sits on. Top/Bottom carry the
// dominant top-to-bottom flow (in-ports / out-ports); Left/Right carry
// same-rank sibling crossings.
export enum PortSide { Top, Bottom, Left, Right }

// A boundary connection point minted for an edge that crosses a container
// border. Ports are ephemeral: they exist as synthetic nodes only during a
// container's interior layout run, and never appear in the final model.
export interface Port
{
    id:          string;   // synthetic node id used inside the interior run
    side:        PortSide;  // border it sits on
    containerId: string;    // the container boundary it belongs to
    edge:        Edge;      // the original crossing edge it represents
}

// Deterministic synthetic id for a port, unique per (container, edge, side).
export function portId(containerId: string, edge: Edge, side: PortSide): string
{
    return `__port:${containerId}:${edge.From}->${edge.To}:${side}`;
}
