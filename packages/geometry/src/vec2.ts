import { VectorLibFactory } from './vector';

export type vec2 = readonly [number, number];
const isVec2 = (v: ReadonlyArray<number>): v is vec2 => v.length === 2;
export const Vec2 = { isVec2, ...VectorLibFactory<vec2>() };
