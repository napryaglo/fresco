import { Graph } from '../graph.js';
import { LongestPathLayerAssigner } from '../layer-assigner/index.js';
import { isContainer } from './hierarchy.js';
import { PortSide } from './port.js';

// The global orientation pass. It gives one consistent notion of "up/down"
// across every nesting level so a container's interior flows the same way as
// its parent, and so port sides can be chosen coherently.
//
// IMPORTANT: this only ORIENTS. It never positions anything — every
// container is still laid out in isolation. We borrow a single flat
// longest-path layering purely to rank the leaf nodes.

// Longest-path rank per leaf node (containers excluded). Edges are assumed
// to connect leaves — the flat rank sees them directly.
export function globalRank(graph: Graph): Map<string, number>
{
    const leaves = graph.nodes.filter(n => !isContainer(graph, n.Id));
    const flat = new Graph([...leaves], [...graph.edges]);
    return new LongestPathLayerAssigner().Assign(flat);
}

// Which border a crossing edge exits, given the global ranks of the edge's
// interior endpoint (source) and the far endpoint (target):
//   target below source  → Bottom (out-port)
//   target above source   → Top    (in-port)
//   same rank             → Left    (side-port; the caller assigns Right to
//                                    the facing boundary of the other end)
export function portSideFor(sourceRank: number, targetRank: number): PortSide
{
    if (targetRank > sourceRank) return PortSide.Bottom;
    if (targetRank < sourceRank) return PortSide.Top;
    return PortSide.Left;
}
