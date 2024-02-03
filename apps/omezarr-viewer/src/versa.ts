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
import { buildImageRenderer } from "./image-renderer";
import { ImGuiSliderFlags } from "@zhobo63/imgui-ts/src/imgui";
import { ImTuple2 } from "@zhobo63/imgui-ts/src/bind-imgui";
import { colorMapWidget } from "./components/color-map";

const versa = "https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/";
const file = versa;
type Channel = 'R' | 'G' | 'B'; // we can support 3 visual channels at once
type ChannelColorSettings = {
  gamut: Interval;
  index: number;
}
class VersaDemo {
  mouse: "up" | "down";
  mousePos: vec2;
  camera: Camera;
  channels: Record<Channel, ChannelColorSettings>;
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
    this.sliceIndex = 0;
    this.plane = "xy";
    this.mouse = "up";
    this.cache = cache;

    this.mousePos = [0, 0];
    this.channels = {
      R: {
        gamut: { min: 0, max: 1 },
        index: 0,
      },
      G: {
        gamut: { min: 0, max: 1 },
        index: 1,
      },
      B: {
        gamut: { min: 0, max: 1 },
        index: 2,
      }
    }
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
  private renderFrame() {
    const { camera, plane, sliceIndex, dataset, cache, regl, channels, renderer } = this;
    const { layer, view, tiles } = getVisibleTiles(camera, plane, sliceIndex, dataset);
    regl.clear({ color: [0, 0, 0, 0], depth: 1, framebuffer: this.screenBuffer.fbo });
    const gamut = {
      R: channels.R.gamut,
      G: channels.G.gamut,
      B: channels.B.gamut
    }
    const {
      layer: baseLayer,
      view: baseView,
      tiles: baseTiles,
    } = getVisibleTiles({ ...camera, screen: [1, 1] }, plane, sliceIndex, dataset);

    if (layer === baseLayer) {
      this.renderFrameHelper(baseView, baseTiles);
      return;
    }
    const frame = beginLongRunningFrame<REGL.Texture2D, VoxelTile, VoxelSliceRenderSettings>(
      3,
      33,
      baseTiles,
      cache,
      {
        view: baseView,
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
        switch (event.status) {
          case "error":
            throw event.error; // error boundary might catch this
          case "progress":
            break;
          case "finished_synchronously":
          case "finished":
            this.curFrame = this.renderFrameHelper(view, tiles);
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
    frame.cancelFrame();
  }
  // not my fav thing to do - but renderFrame and renderFrame helper are tightly linked
  // to accomplish our smoke&mirrors to avoid flickering as tiles load in -
  // the both make assumptions about state, and the contents of buffers. do not
  // call either of them!
  private renderFrameHelper(view: box2D, visibleTiles: VoxelTile[]) {
    const { camera, dataset, cache, regl, channels, renderer } = this;
    this.screenBuffer.bounds = camera.view;
    regl._refresh();
    const gamut = {
      R: channels.R.gamut,
      G: channels.G.gamut,
      B: channels.B.gamut
    }
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
        switch (event.status) {
          case "error":
            throw event.error; // error boundary might catch this
          case "progress":
            this.refreshScreen();
            break;
          case "finished_synchronously":
          case "finished":
            this.curFrame = null;
            this.refreshScreen();
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
    this.regl._refresh();
    this.regl.clear({ depth: 1, color: [0, 0, 0, 1], framebuffer: null });

    this.screenRenderer([
      {
        box: Box2D.toFlatArray(this.screenBuffer.bounds),
        img: this.screenBuffer.fbo,
        target: null,
        view: Box2D.toFlatArray(this.camera.view),
      },
    ]);

    this.drawUI(now);

    this.regl._refresh();
  }

  drawUI(time: number) {
    let drawAgain = false;
    const effects: Array<() => void> = [];
    // imgui wants mutable access to stuff... which is pretty weird - imAccess is nice, but all the vector-style updaters are nasty
    try {
      this.regl._gl.bindFramebuffer(this.regl._gl.FRAMEBUFFER, null);
      ImGui_Impl.NewFrame(time);
      ImGui.NewFrame();
      ImGui.Begin("N E U R A L   G A Z E R");
      if (ImGui.Button("-")) {
        drawAgain = true;
        effects.push(() => { this.changeSlice(-1); })
      }
      ImGui.SameLine();
      if (ImGui.Button("+")) {
        drawAgain = true;
        effects.push(() => { this.changeSlice(1); })
      }
      ImGui.SameLine();
      ImGui.LabelText("Slide", this.sliceIndex.toFixed(0))


      Object.entries(this.channels).forEach(([channel, settings]) => {
        const result = colorMapWidget(channel, {
          gamut: settings.gamut,
          color: new ImGui.Vec4(channel === 'R' ? 255 : 0, channel === 'G' ? 255 : 0, channel === 'B' ? 255 : 0, 255),
          useMe: true
        })
        if (result.changed) {
          this.channels[channel as Channel].gamut = result.gamut
          drawAgain = true;
        }
      })
      ImGui.Image;
      ImGui.End();
      ImGui.EndFrame();
      ImGui.Render();

      ImGui_Impl.RenderDrawData(ImGui.GetDrawData());
      effects.forEach(fx => fx())
      if (drawAgain) {
        window.setTimeout(() => this.rerender(), 5);
      }
    } catch (err) {
      console.warn(err);
    }
  }
  rerender() {
    if (this.curFrame !== null) {
      this.curFrame.cancelFrame();
    }
    this.renderFrame();
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
  // changeGamut(delta: number) {
  //   this.gamut = { min: this.gamut.min, max: this.gamut.max * delta };
  //   this.rerender();
  // }
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

function setupEventHandlers(canvas: HTMLCanvasElement, demo: VersaDemo) {
  canvas.onmousedown = (e: MouseEvent) => {
    if (ImGui.GetIO().WantCaptureMouse) return;
    demo.mouseButton("down");
  };
  canvas.onmouseup = (e: MouseEvent) => {
    if (ImGui.GetIO().WantCaptureMouse) return;
    demo.mouseButton("up");
  };
  canvas.onmousemove = (e: MouseEvent) => {
    if (ImGui.GetIO().WantCaptureMouse) return;
    // account for gl-origin vs. screen origin:
    demo.mouseMove([-e.movementX, e.movementY]);
  };
  canvas.onwheel = (e: WheelEvent) => {
    if (ImGui.GetIO().WantCaptureMouse) return;
    if (e.ctrlKey) {
      demo.nextAxis();
    } else if (e.altKey) {
      demo.changeSlice(e.deltaY > 0 ? 1 : -1);
    } else {
      demo.zoom(e.deltaY > 0 ? 1.1 : 0.9);
    }
  };
  canvas.onkeydown = (e: KeyboardEvent) => {
    if (ImGui.GetIO().WantCaptureKeyboard) return;

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
function setupGui(canvas: HTMLCanvasElement | WebGL2RenderingContext | WebGLRenderingContext) {
  ImGui.default().then(() => {
    ImGui.CHECKVERSION();
    ImGui.CreateContext();
    const io: ImGui.IO = ImGui.GetIO();
    ImGui.StyleColorsDark();
    io.Fonts.AddFontDefault();
    ImGui_Impl.Init(canvas);
  });
}
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
  setupGui(gl);
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

  setupEventHandlers(canvas, theDemo);
  theDemo.rerender();
}

// since I am just included in a script tag in a raw html document, this is how we start:
demotime();
