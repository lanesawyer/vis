import { vec4 } from "@aibs-vis/geometry";
import REGL from "regl";
import type { Node, ScatterPlotRenderSettings, Task } from "./types";

type Props = { position: REGL.BufferData; view: vec4; count: number; viewport: REGL.BoundingBox };
export function buildScatterplotRenderer(regl: REGL.Regl) {
  const cmd = regl<{ view: vec4 }, { pos: REGL.BufferData }, Props>({
    vert: `attribute vec2 pos;
        
        uniform vec4 view;
        void main(){
            gl_PointSize=5.0;
            vec2 p = (pos.xy-view.xy)/(view.zw-view.xy);
            // now, to clip space
            p = (p*2.0)-1.0;
            gl_Position = vec4(p.x,p.y,0.0,1.0);
        }`,
    frag: `void main(){
            gl_FragColor = vec4(0.6,0.2,0.2,1);
        }`,
    attributes: {
      pos: regl.prop<Props, "position">("position"),
    },
    uniforms: {
      view: regl.prop<Props, "view">("view"),
    },
    count: regl.prop<Props, "count">("count"),
    viewport: regl.prop<Props, "viewport">("viewport"),
    primitive: "points",
    // ... more!
  });
  return (item: Node, settings: ScatterPlotRenderSettings, tasks: Record<string, Task | undefined>) => {
    const { view, viewport } = settings;
    const pos = tasks.position;
    const { count } = item;
    if (!pos) return; // we cant render if the data for the positions is missing!
    const { buffer } = pos;
    cmd([{ position: buffer, view: [...view.minCorner, ...view.maxCorner], count, viewport }]);
  };
}
