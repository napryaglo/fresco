// Declarative parameters for the parameterized graph transforms
// (FilterNodesTransform / FilterEdgesTransform). These let a JSON
// PipelineConfiguration carry a filter predicate as data rather than a
// code callback, so a builder UI can compose them and they round-trip.
//
// Kept in sync with the `parameters` declared for these transforms in
// pipeline-catalog.ts.

import type { Node, Edge } from './graph.js';

export type TransformParams = {
    field: string;
    op:    'contains' | 'equals' | 'matches';
    value: string;
};

function evalOp(op: TransformParams['op'], subject: string, value: string): boolean
{
    switch (op)
    {
        case 'contains': return subject.includes(value);
        case 'equals':   return subject === value;
        case 'matches':  return new RegExp(value).test(subject);
    }
}

export function buildNodePredicate(p: TransformParams): (node: Node) => boolean
{
    return (node) => evalOp(p.op, p.field === 'id' ? node.Id : (node.Label ?? ''), p.value);
}

export function buildEdgePredicate(p: TransformParams): (edge: Edge) => boolean
{
    return (edge) => evalOp(p.op, p.field === 'to' ? edge.To : edge.From, p.value);
}
