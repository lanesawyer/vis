// I am the scatterplot demo //

import REGL from "regl";
import { ZarrDataset, load } from "./zarr-data";
import { AsyncDataCache, beginLongRunningFrame } from "@aibs-vis/scatterbrain";
import {
  AxisAlignedPlane,
  VoxelSliceRenderSettings,
  VoxelTile,
  buildImageRenderer,
  cacheKeyFactory,
  getVisibleTiles,
  requestsForTile,
} from "./slice-renderer";
import { Box2D, Interval, Vec2, box2D, vec2 } from "@aibs-vis/geometry";
import { FrameLifecycle } from "@aibs-vis/scatterbrain/lib/render-queue";

const file =
  "https://aind-open-data.s3.amazonaws.com/SmartSPIM_644106_2022-12-09_12-12-39_stitched_2022-12-16_16-55-11/processed/OMEZarr/Ex_488_Em_525.zarr";

function renderAFrame(
  regl: REGL.Regl,
  cache: AsyncDataCache<REGL.Texture2D>,
  view: box2D,
  plane: AxisAlignedPlane,
  planeIndex: number,
  dataset: ZarrDataset,
  viewport: REGL.BoundingBox,
  gamut: Interval,
  renderer: (
    item: VoxelTile,
    settings: VoxelSliceRenderSettings,
    tasks: Record<string, REGL.Texture2D | undefined>
  ) => void
) {
  const visibleTiles = getVisibleTiles(view, plane, planeIndex, dataset);
  const frame = beginLongRunningFrame<REGL.Texture2D, VoxelTile, VoxelSliceRenderSettings>(
    5,
    33,
    visibleTiles,
    cache,
    {
      view,
      dataset,
      regl,
      viewport,
      gamut,
    },
    requestsForTile,
    renderer,
    (event) => {
      switch (event.status) {
        case "error":
          throw event.error; // error boundary might catch this
        case "progress":
          break;
        case "finished_synchronously":
        case "finished":
          break;
        case "begun":
          break;
        case "cancelled":
          break;
        default:
      }
    },
    cacheKeyFactory
  );
  return frame;
}

class Demo {
  mouse: "up" | "down";
  mousePos: vec2;
  view: box2D;
  gamut: Interval;
  plane: AxisAlignedPlane;
  sliceIndex: number;
  canvas: HTMLCanvasElement;
  curFrame: FrameLifecycle | null;
  onChange: (state: Demo) => FrameLifecycle;
  constructor(canvas: HTMLCanvasElement, size: vec2, change: (state: Demo) => FrameLifecycle) {
    this.sliceIndex = 50;
    this.plane = "xy";
    this.mouse = "up";
    this.view = Box2D.create([0, 0], size);
    this.mousePos = [0, 0];
    this.gamut = { min: 0, max: 2500 };
    this.onChange = change;
    this.canvas = canvas;
    this.curFrame = null;
  }
  rerender() {
    if (this.curFrame !== null) {
      this.curFrame.cancelFrame();
    }
    this.curFrame = this.onChange(this);
  }
  mouseButton(click: "up" | "down") {
    this.mouse = click;
  }
  mouseMove(delta: vec2) {
    if (this.mouse === "down") {
      // drag the view
      this.view = Box2D.translate(this.view, delta);
      this.rerender();
    }
    this.mousePos = Vec2.add(this.mousePos, delta);
  }
  changeSlice(delta: number) {
    this.sliceIndex += delta;
    this.rerender();
  }
  changeGamut(delta: number) {
    this.gamut = { min: this.gamut.min, max: this.gamut.max + delta };
    this.rerender();
  }
  zoom(scale: number) {
    const m = Box2D.midpoint(this.view);
    this.view = Box2D.translate(Box2D.scale(Box2D.translate(this.view, Vec2.scale(m, -1)), [scale, scale]), m);
    this.rerender();
  }
}

function setupEventHandlers(canvas: HTMLCanvasElement, demo: Demo) {
  canvas.onmousedown = (e: MouseEvent) => {
    demo.mouseButton("down");
  };
  canvas.onmouseup = (e: MouseEvent) => {
    demo.mouseButton("up");
  };
  canvas.onmousemove = (e: MouseEvent) => {
    // account for gl-origin vs. screen origin:
    demo.mouseMove([-e.movementX, e.movementY]);
  };
  canvas.onwheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.altKey) {
      demo.changeSlice(e.deltaY > 0 ? 1 : -1);
    } else if (e.shiftKey) {
      demo.changeGamut(e.deltaY);
    } else {
      demo.zoom(e.deltaY > 0 ? 1.1 : 0.9);
    }
  };
  // canvas.onkeyup = (e: KeyboardEvent) => {};
}
async function demotime() {
  const regl = REGL({
    attributes: {
      alpha: true,
      preserveDrawingBuffer: true,
      antialias: true,
      premultipliedAlpha: true,
    },
    extensions: ["ANGLE_instanced_arrays", "OES_texture_float", "WEBGL_color_buffer_float"],
  });
  const canvas: HTMLCanvasElement = regl._gl.canvas as HTMLCanvasElement;

  const viewport = {
    x: 0,
    y: 0,
    width: canvas.clientWidth,
    height: canvas.clientHeight,
  };
  const voxelSliceCache: AsyncDataCache<REGL.Texture2D> = new AsyncDataCache<REGL.Texture2D>();
  const imageRenderer = buildImageRenderer(regl);
  const zarr = await load(file);
  regl.clear({ color: [0, 0, 0, 1], depth: 1 });

  const renderPlease = (demo: Demo) => {
    const viewport = {
      x: 0,
      y: 0,
      width: demo.canvas.width,
      height: demo.canvas.height,
    };
    regl.clear({ color: [0, 0, 0, 1], depth: 1 });
    return renderAFrame(
      regl,
      voxelSliceCache,
      demo.view,
      demo.plane,
      demo.sliceIndex,
      zarr,
      viewport,
      demo.gamut,
      imageRenderer
    );
  };
  const theDemo = new Demo(canvas, [viewport.width, viewport.height], renderPlease);
  setupEventHandlers(canvas, theDemo);
  theDemo.rerender();
}

// since I am just included in a script tag in a raw html document, this is how we start:
demotime();
