import REGL from "regl";
import { type box2D } from "@aibs-vis/geometry";
export type Node = { count: number; bounds: box2D; url: string };
export type ScatterPlotRenderSettings = {
  view: box2D;
  viewport: REGL.BoundingBox;
};
export type Task = { buffer: Float32Array };
