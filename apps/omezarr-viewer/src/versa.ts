// I am the scatterplot demo //
import { ImGui, ImGui_Impl } from "@zhobo63/imgui-ts";
import REGL from "regl";
import { ZarrDataset, explain, load } from "./zarr-data";
import { AsyncDataCache, beginLongRunningFrame } from "@aibs-vis/scatterbrain";
import {
  AxisAlignedPlane,
  VoxelSliceRenderSettings,
  VoxelTile,
  buildVersaRenderer,
  cacheKeyFactory,
  getVisibleTiles,
  requestsForTile,
} from "./versa-renderer";
import { Box2D, Interval, Vec2, box2D, vec2 } from "@aibs-vis/geometry";
import { FrameLifecycle } from "@aibs-vis/scatterbrain/lib/render-queue";
import { Camera } from "./camera";
import { partial } from "lodash";
import { buildImageRenderer } from "./image-renderer";

const versa = "https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/";
const file = versa;

// function renderFrame(
//   regl: REGL.Regl,
//   cache: AsyncDataCache<REGL.Texture2D>,
//   camera: Camera,
//   plane: AxisAlignedPlane,
//   planeIndex: number,
//   dataset: ZarrDataset,
//   viewport: { x: number; y: number; width: number; height: number },
//   rotation: number,
//   gamut: Interval,
//   renderer: (
//     item: VoxelTile,
//     settings: VoxelSliceRenderSettings,
//     tasks: Record<string, REGL.Texture2D | undefined>
//   ) => void
// ) {
//   const { view, tiles: visibleTiles } = getVisibleTiles(camera, plane, planeIndex, dataset);
//   const frame = beginLongRunningFrame<REGL.Texture2D, VoxelTile, VoxelSliceRenderSettings>(
//     3,
//     33,
//     visibleTiles,
//     cache,
//     {
//       view,
//       dataset,
//       regl,
//       viewport,
//       gamut,
//     },
//     requestsForTile,
//     renderer,
//     (event) => {
//       switch (event.status) {
//         case "error":
//           throw event.error; // error boundary might catch this
//         case "progress":
//           break;
//         case "finished_synchronously":
//         case "finished":
//           break;
//         case "begun":
//           break;
//         case "cancelled":
//           break;
//         default:
//       }
//     },
//     cacheKeyFactory
//   );
//   return frame;
// }

class VersaDemo {
  mouse: "up" | "down";
  mousePos: vec2;
  camera: Camera;
  gamut: Interval;
  plane: AxisAlignedPlane;
  sliceIndex: number;
  canvas: HTMLCanvasElement;
  curFrame: FrameLifecycle | null;
  rotation: number;
  cache: AsyncDataCache<REGL.Texture2D>;
  regl: REGL.Regl;
  dataset: ZarrDataset;
  screenRenderer: ReturnType<typeof buildImageRenderer>;
  renderer: ReturnType<typeof buildVersaRenderer>;

  screenBuffer: { bounds: box2D; fbo: REGL.Framebuffer2D };
  constructor(canvas: HTMLCanvasElement, dataset: ZarrDataset, regl: REGL.Regl, cache: AsyncDataCache<REGL.Texture2D>) {
    const [w, h] = [canvas.clientWidth, canvas.clientHeight];
    this.camera = {
      view: Box2D.create([0, 0], [w / h, 1]),
      screen: [w, h],
    };
    this.screenBuffer = { bounds: this.camera.view, fbo: regl.framebuffer(w, h) };
    this.dataset = dataset;
    this.regl = regl;
    // setupGui(regl._gl);
    this.sliceIndex = 0;
    this.plane = "xy";
    this.mouse = "up";
    this.cache = cache;

    this.mousePos = [0, 0];
    this.gamut = { min: 0, max: 0.5 };
    this.canvas = canvas;
    this.curFrame = null;
    this.rotation = 0;
    this.renderer = buildVersaRenderer(regl);
    this.screenRenderer = buildImageRenderer(regl);
    const loop = () => {
      this.refreshScreen();
      window.requestAnimationFrame(loop);
    };
    window.requestAnimationFrame(loop);
  }
  renderFrame() {
    const { camera, plane, sliceIndex, dataset, cache, regl, gamut, renderer } = this;
    const { view, tiles: visibleTiles } = getVisibleTiles(camera, plane, sliceIndex, dataset);
    this.screenBuffer.bounds = this.camera.view;
    console.log("start frame!");
    // regl._refresh();
    // regl.clear({ color: [0, 1, 0, 1], depth: 1, framebuffer: this.screenBuffer.fbo });
    const frame = beginLongRunningFrame<REGL.Texture2D, VoxelTile, VoxelSliceRenderSettings>(
      3,
      33,
      visibleTiles,
      cache,
      {
        view,
        dataset,
        regl,
        target: this.screenBuffer.fbo,
        viewport: {
          x: 0,
          y: 0,
          width: this.canvas.clientWidth,
          height: this.canvas.clientHeight,
        },
        gamut,
      },
      requestsForTile,
      renderer,
      (event) => {
        console.log(event);
        switch (event.status) {
          case "error":
            throw event.error; // error boundary might catch this
          case "progress":
            this.refreshScreen();
            break;
          case "finished_synchronously":
          case "finished":
            this.refreshScreen();
            this.curFrame = null;
            break;
          case "begun":
            this.refreshScreen();
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
  refreshScreen() {
    const now = performance.now();
    // this.regl._refresh();
    this.regl.clear({ depth: 1, color: [0, 0, 0, 1], framebuffer: null });
    // draw the image to the screen, using its camera
    this.screenRenderer([
      {
        box: Box2D.toFlatArray(this.screenBuffer.bounds),
        img: this.screenBuffer.fbo,
        target: null,
        view: Box2D.toFlatArray(this.camera.view),
      },
    ]);
    this.drawUI(now);

    // this.regl._refresh();
  }
  drawUI(time: number) {
    return;
    // let drawAgain = false;
    // this.regl._gl.bindFramebuffer(this.regl._gl.FRAMEBUFFER, null);
    // ImGui_Impl.NewFrame(time);
    // ImGui.NewFrame();
    // ImGui.Begin("Hello");
    // ImGui.Text("Version " + ImGui.VERSION);
    // ImGui.InputText("Input", text);
    // ImGui.InputTextMultiline("Text", text_area);
    // if (ImGui.Button("refresh")) {
    //   drawAgain = true;
    // }
    // ImGui.End();
    // ImGui.EndFrame();
    // ImGui.Render();

    // // ImGui_Impl.ClearBuffer(new ImGui.ImVec4(0.25, 0.25, 0.25, 1));
    // ImGui_Impl.RenderDrawData(ImGui.GetDrawData());
    // if (drawAgain) {
    //   this.rerender();
    // }
  }
  rerender() {
    if (this.curFrame !== null) {
      this.curFrame.cancelFrame();
    }
    this.curFrame = this.renderFrame();
  }
  mouseButton(click: "up" | "down") {
    this.mouse = click;
  }
  mouseMove(delta: vec2) {
    if (this.mouse === "down") {
      // drag the view
      const { screen, view } = this.camera;
      const p = Vec2.div(delta, [this.canvas.clientWidth, this.canvas.clientHeight]);
      const c = Vec2.mul(p, Box2D.size(view));
      this.camera = { view: Box2D.translate(view, c), screen };
      this.rerender();
    }
    this.mousePos = Vec2.add(this.mousePos, delta);
  }
  changeSlice(delta: number) {
    this.sliceIndex += delta;
    this.rerender();
  }
  changeGamut(delta: number) {
    this.gamut = { min: this.gamut.min, max: this.gamut.max * delta };
    this.rerender();
  }
  zoom(scale: number) {
    const { view, screen } = this.camera;
    const m = Box2D.midpoint(view);
    this.camera = {
      view: Box2D.translate(Box2D.scale(Box2D.translate(view, Vec2.scale(m, -1)), [scale, scale]), m),
      screen,
    };
    this.rerender();
  }
  nextAxis() {
    this.plane = this.plane == "xy" ? "xz" : this.plane === "xz" ? "yz" : "xy";
    this.rerender();
  }
  rotateTiles() {
    this.rotation += Math.PI / 2;
    this.rerender();
  }
}

let text: ImGui.ImStringBuffer = new ImGui.ImStringBuffer(128, "input text");
let text_area: ImGui.ImStringBuffer = new ImGui.ImStringBuffer(128, "edit multiline");

// function renderGui(time: number): void {
//   ImGui_Impl.NewFrame(time);
//   ImGui.NewFrame();
//   ImGui.Begin("Hello");
//   ImGui.Text("Version " + ImGui.VERSION);
//   ImGui.InputText("Input", text);
//   ImGui.InputTextMultiline("Text", text_area);
//   ImGui.End();
//   ImGui.EndFrame();
//   ImGui.Render();

//   // ImGui_Impl.ClearBuffer(new ImGui.ImVec4(0.25, 0.25, 0.25, 1));
//   ImGui_Impl.RenderDrawData(ImGui.GetDrawData());
//   //   window.requestAnimationFrame(partial(loop, demo));
// }
function setupEventHandlers(canvas: HTMLCanvasElement, demo: VersaDemo) {
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
    if (e.ctrlKey) {
      demo.nextAxis();
    } else if (e.altKey) {
      demo.changeSlice(e.deltaY > 0 ? 1 : -1);
    } else if (e.shiftKey) {
      demo.changeGamut(e.deltaY > 0 ? 1.05 : 0.95);
    } else {
      demo.zoom(e.deltaY > 0 ? 1.1 : 0.9);
    }
  };
  canvas.onkeydown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "a":
        demo.nextAxis();
        break;
      case "r":
        demo.rotateTiles();
        break;
      default:
    }
  };
}
// function setupGui(canvas: HTMLCanvasElement | WebGL2RenderingContext | WebGLRenderingContext) {
//   ImGui.default().then(() => {
//     ImGui.CHECKVERSION();
//     ImGui.CreateContext();
//     const io: ImGui.IO = ImGui.GetIO();
//     ImGui.StyleColorsDark();
//     io.Fonts.AddFontDefault();
//     ImGui_Impl.Init(canvas);
//   });
// }
async function demotime() {
  const thing = document.getElementById("glCanvas") as HTMLCanvasElement;
  thing.width = 2000;
  thing.height = 2000;
  const gl = thing.getContext("webgl2", {
    alpha: true,
    preserveDrawingBuffer: true,
    antialias: true,
    premultipliedAlpha: true,
  }) as WebGL2RenderingContext;
  const regl = REGL({
    gl,
    // attributes: {},
    // extensions: ["ANGLE_instanced_arrays", "OES_texture_float", "WEBGL_color_buffer_float"],
  });
  const canvas: HTMLCanvasElement = regl._gl.canvas as HTMLCanvasElement;
  //   setupGui(gl);
  const voxelSliceCache: AsyncDataCache<REGL.Texture2D> = new AsyncDataCache<REGL.Texture2D>();
  //   const imageRenderer = buildVersaRenderer(regl);
  const zarr = await load(file);
  explain(zarr);

  //   regl.clear({ framebuffer: null, color: [0, 0, 1, 1], depth: 1 });
  //   canvas.tabIndex = 3; // get keyboard events please
  //   const renderPlease = (demo: VersaDemo, time: number) => {
  //     const viewport = {
  //       x: 0,
  //       y: 0,
  //       width: demo.canvas.width,
  //       height: demo.canvas.height,
  //     };
  //     regl.clear({ color: [0, 0, 0, 1], depth: 1 });
  //     renderGui(time);
  //     regl._refresh();
  //     return renderFrame(
  //       regl,
  //       voxelSliceCache,
  //       demo.camera,
  //       demo.plane,
  //       demo.sliceIndex,
  //       zarr,
  //       viewport,
  //       demo.rotation,
  //       demo.gamut,
  //       imageRenderer
  //     );
  //   };
  const theDemo = new VersaDemo(canvas, zarr, regl, voxelSliceCache);

  //   setupEventHandlers(canvas, theDemo);
  theDemo.rerender();
}

// since I am just included in a script tag in a raw html document, this is how we start:
demotime();
