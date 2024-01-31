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
import { Box2D, box2D } from "@aibs-vis/geometry";

const file =
  "https://aind-open-data.s3.amazonaws.com/SmartSPIM_644106_2022-12-09_12-12-39_stitched_2022-12-16_16-55-11/processed/OMEZarr/Ex_488_Em_525.zarr";

function renderAFrame(
  regl: REGL.Regl,
  cache: AsyncDataCache<REGL.Texture2D>,
  view: box2D,
  plane: AxisAlignedPlane,
  dataset: ZarrDataset,
  viewport: REGL.BoundingBox,
  renderer: (
    item: VoxelTile,
    settings: VoxelSliceRenderSettings,
    tasks: Record<string, REGL.Texture2D | undefined>
  ) => void
) {
  const visibleTiles = getVisibleTiles(view, plane, dataset);
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
  const voxelSliceCache: AsyncDataCache<REGL.Texture2D> = new AsyncDataCache<REGL.Texture2D>();
  const canvas: HTMLCanvasElement = regl._gl.canvas as HTMLCanvasElement;
  const view = Box2D.create([0, 0], [512, 512]);
  const zarr = await load(file);
  regl.clear({ color: [0, 0, 0, 1], depth: 1 });
  const imageRenderer = buildImageRenderer(regl);
  renderAFrame(
    regl,
    voxelSliceCache,
    view,
    "xy",
    zarr,
    {
      x: 0,
      y: 0,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    },
    imageRenderer
  );
}

// since I am just included in a script tag in a raw html document, this is how we start:
demotime();
