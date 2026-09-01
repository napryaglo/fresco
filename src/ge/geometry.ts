import { Point } from '@pragmatic-tech-ai/mural/runtime';

// Small value types shared by the layout stages and the compound
// composer. Fresco imports only `Point` from mural/runtime; `Size` and
// `Rect` live here so both the flat pipeline (variable-size Brandes–Köpf)
// and NestedCompoundLayout (container boxes) can speak the same currency.

export interface Size { width: number; height: number }
export interface Rect { position: Point; width: number; height: number }

// Smallest Rect covering the given (optionally sized) items. Each item's
// (x, y) is treated as its CENTER; `w`/`h` are its full extents (default 0),
// so the item spans [x - w/2, x + w/2] × [y - h/2, y + h/2]. An empty input
// yields a zero Rect at the origin.
export function boundingBox(
    items: Iterable<{ x: number; y: number; w?: number; h?: number }>,
): Rect
{
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const it of items)
    {
        const hw = (it.w ?? 0) / 2;
        const hh = (it.h ?? 0) / 2;
        minX = Math.min(minX, it.x - hw); maxX = Math.max(maxX, it.x + hw);
        minY = Math.min(minY, it.y - hh); maxY = Math.max(maxY, it.y + hh);
    }
    if (!isFinite(minX)) { minX = minY = maxX = maxY = 0; }
    return { position: new Point(minX, minY), width: maxX - minX, height: maxY - minY };
}
