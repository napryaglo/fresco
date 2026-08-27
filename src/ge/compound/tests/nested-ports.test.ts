import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Graph } from '../../graph.js';
import { NestedCompoundLayout } from '../nested-compound-layout.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from '../../configuration-loader.js';

function engine() {
    const config: PipelineConfiguration = { name: 't', transforms: [], layout: {} };
    return BuildPipeline(config, LoadElementRepository()).layoutPipeline;
}

test('an edge from inside a container to an outside node below keeps both placed and box intact', () => {
    const g = new Graph();
    g.AddNode('BOX'); g.AddNode('a'); g.AddNode('out');
    const a = g.nodes.find(n => n.Id === 'a')!; a.ParentId = 'BOX'; a.Size = { width: 20, height: 20 };
    g.nodes.find(n => n.Id === 'out')!.Size = { width: 20, height: 20 };
    g.AddEdge('a', 'out'); // crosses BOX boundary, flows downward

    const res = new NestedCompoundLayout(engine()).Apply(g);
    assert.ok(res.boxes!.get('BOX'), 'box exists');
    assert.ok(res.positions.get('a'), 'a placed');
    assert.ok(res.positions.get('out'), 'out placed');
    // 'a' is inside the box; 'out' is not (it is a sibling of BOX at root)
    const box = res.boxes!.get('BOX')!;
    const outp = res.positions.get('out')!;
    const outsideBox = outp.X < box.position.X || outp.X > box.position.X + box.width
                    || outp.Y < box.position.Y || outp.Y > box.position.Y + box.height;
    assert.ok(outsideBox, 'out is not inside BOX');
    // The cross-boundary edge must actually connect BOX to `out` at root
    // level, so `out` flows BELOW the box (not dropped and placed beside it).
    assert.ok(outp.Y > box.position.Y + box.height / 2, 'out flows below the box (edge preserved)');
});
