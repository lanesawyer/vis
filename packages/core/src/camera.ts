import { Box2D, Vec2, type box2D, type vec2 } from '@alleninstitute/vis-geometry';

/**
 * Zooms relative to the current mouse position
 */
export function zoom(view: box2D, screenSize: vec2, zoomScale: number, mousePos: vec2): box2D {
    const zoomPoint: vec2 = Vec2.add(view.minCorner, Vec2.mul(Vec2.div(mousePos, screenSize), Box2D.size(view)));
    return Box2D.translate(
        Box2D.scale(Box2D.translate(view, Vec2.scale(zoomPoint, -1)), [zoomScale, zoomScale]),
        zoomPoint,
    );
}

/**
 * Pans by a pixel delta in screen space
 */
export function pan(view: box2D, screenSize: vec2, delta: vec2): box2D {
    const relative = Vec2.div(Vec2.mul(delta, [-1, -1]), screenSize);
    const offset = Vec2.mul(relative, Box2D.size(view));
    return Box2D.translate(view, offset);
}
