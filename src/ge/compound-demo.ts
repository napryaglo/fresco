import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Color, Point } from '@pragmatic-lab/mural/runtime';
import { HeadlessTarget, SolidColorBrush, SvgDrawingContext } from '@pragmatic-lab/mural/visual-engine';
import { Canvas, TextBlock } from '@pragmatic-lab/mural/basic';

import { Graph } from './graph.js';
import { NestedCompoundLayout } from './compound/nested-compound-layout.js';
import { EdgeVisual } from './scene.js';
import { BuildPipeline, LoadElementRepository, type PipelineConfiguration } from './configuration-loader.js';

// compound-demo — builds a nested compound graph (containers, cross-boundary
// edges, a frozen container) and renders NestedCompoundLayout to an SVG so the
// container boxes + routed edges can be eyeballed.
//   Run with: npx tsx src/ge/compound-demo.ts [out.svg]

const g = new Graph();
const leaf = (id: string, parent?: string, w = 64, h = 36): void => {
    const n = g.AddNode(id, id);
    if (parent) n.ParentId = parent;
    n.Size = { width: w, height: h };
};
const box = (id: string, parent?: string): void => {
    const n = g.AddNode(id, id);
    if (parent) n.ParentId = parent;
};

// Cloud ⊃ { API, Data ⊃ { DB, Cache } }
box('Cloud');
leaf('API', 'Cloud');
box('Data', 'Cloud');
leaf('DB', 'Data');
leaf('Cache', 'Data');

// Edge ⊃ { CDN, WAF }
box('Edge');
leaf('CDN', 'Edge');
leaf('WAF', 'Edge');

// A top-level actor.
leaf('User');

// Legacy — FROZEN: children keep their hand-placed relative positions.
box('Legacy');
g.nodes.find(n => n.Id === 'Legacy')!.LayoutContent = false;
const main = g.AddNode('Main', 'Main'); main.ParentId = 'Legacy'; main.Size = { width: 64, height: 36 }; main.LocalPosition = new Point(0, 0);
const aux  = g.AddNode('Aux',  'Aux');  aux.ParentId  = 'Legacy'; aux.Size  = { width: 64, height: 36 }; aux.LocalPosition  = new Point(150, 70);

// Edges — several cross container boundaries. User fans out to Edge and
// Cloud (so those two containers sit side by side), each of which flows on.
g.AddEdge('User', 'WAF');   // User -> Edge
g.AddEdge('User', 'API');   // User -> Cloud  (sibling of Edge)
g.AddEdge('CDN', 'WAF');    // inside Edge
g.AddEdge('API', 'DB');     // Cloud -> Data
g.AddEdge('API', 'Cache');  // Cloud -> Data
g.AddEdge('API', 'Main');   // Cloud -> frozen Legacy

const config: PipelineConfiguration = {
    name: 'compound', transforms: [],
    layout: { edgeRouter: 'StraightLineEdgeRouter' },
};
const { layoutPipeline } = BuildPipeline(config, LoadElementRepository());
const res = new NestedCompoundLayout(layoutPipeline).Apply(g);

// --- Compose the scene: boxes (back) → edges → nodes (front) ---
const canvas = new Canvas();

const rectOutline = (x: number, y: number, w: number, h: number, color: Color, thickness: number): void => {
    const v = new EdgeVisual([
        new Point(0, 0), new Point(w, 0), new Point(w, h), new Point(0, h), new Point(0, 0),
    ]);
    v.Color = color; v.Thickness = thickness;
    Canvas.SetLeft(v, x); Canvas.SetTop(v, y);
    canvas.AddChild(v);
};
const label = (text: string, x: number, y: number, size: number, color: Color): void => {
    const t = new TextBlock(text);
    t.FontSize = size; t.Foreground = new SolidColorBrush(color);
    Canvas.SetLeft(t, x); Canvas.SetTop(t, y);
    canvas.AddChild(t);
};

// Container boxes — deeper boxes drawn with a lighter stroke.
const boxColors = ['#1F4E79', '#2E75B6', '#5B9BD5'];
for (const [id, r] of res.boxes!) {
    const depth = id.split(':').length; // cheap; all top-ish here
    const color = Color.FromHex(boxColors[Math.min(depth, boxColors.length - 1)]!);
    rectOutline(r.position.X, r.position.Y, r.width, r.height, color, 2);
    label(id, r.position.X + 4, r.position.Y + 2, 12, color);
}

// Routed edges.
for (const [, routing] of res.routes!) {
    if (routing.kind !== 'points') continue;
    const pts = routing.waypoints;
    let minX = Infinity, minY = Infinity;
    for (const p of pts) { if (p.X < minX) minX = p.X; if (p.Y < minY) minY = p.Y; }
    const v = new EdgeVisual(pts.map(p => new Point(p.X - minX, p.Y - minY)));
    v.Color = Color.FromHex('#C55A11'); v.Thickness = 1.5;
    Canvas.SetLeft(v, minX); Canvas.SetTop(v, minY);
    canvas.AddChild(v);
}

// Leaf nodes as rectangles of their real Size.
for (const n of g.nodes) {
    const p = res.positions.get(n.Id);
    if (p === undefined || n.Size === undefined) continue;
    const w = n.Size.width, h = n.Size.height;
    rectOutline(p.X - w / 2, p.Y - h / 2, w, h, Color.FromHex('#548235'), 1.5);
    label(n.Label ?? n.Id, p.X - w / 2 + 6, p.Y - 8, 12, Color.FromHex('#375623'));
}

const target = new HeadlessTarget(undefined, undefined, canvas);
target.Background = new SolidColorBrush(Color.White);
const dc = new SvgDrawingContext();
target.Render(dc);
const svg = dc.ToSvg(target.ActualWidth, target.ActualHeight);

const outPath = resolve(process.cwd(), process.argv[2] ?? 'compound-demo.svg');
writeFileSync(outPath, svg, 'utf8');
console.log(`Wrote ${outPath} (${target.ActualWidth}x${target.ActualHeight})`);
console.log(`  boxes: ${[...res.boxes!.keys()].join(', ')}`);
console.log(`  nodes: ${res.positions.size}, edges routed: ${res.routes!.size}`);
