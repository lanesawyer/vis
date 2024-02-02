import REGL from "regl";
import { ZarrDataset, ZarrRequest, getSlice, pickBestScale, sizeInVoxels } from "./zarr-data";
import { Box2D, Interval, Vec2, box2D, vec2, vec4 } from "@aibs-vis/geometry";
import { omit } from "lodash";
import { Camera } from "./camera";

type Props = { tile: vec4; view: vec4; gamut: vec2; viewport: REGL.BoundingBox; img: REGL.Texture2D; rot: number };
export function buildImageRenderer(regl: REGL.Regl) {
  const cmd = regl<
    { view: vec4; tile: vec4; img: REGL.Texture2D; gamut: vec2; rot: number },
    { pos: REGL.BufferData },
    Props
  >({
    vert: ` precision highp float;
    attribute vec2 pos;
        
        uniform vec4 view;
        uniform vec4 tile;
        uniform float rot;
        varying vec2 texCoord;
        vec2 rotateTextureCoordinates(vec2 tx, float radians){
          vec2 xy = tx-vec2(0.5,0.5);
          mat2 R = mat2(
            vec2(cos(radians),sin(radians)), 
            vec2(-sin(radians),cos(radians))
            );
          return (R*xy)+vec2(0.5,0.5);
        }
        void main(){
           vec2 tileSize = tile.zw-tile.xy;
           texCoord = rotateTextureCoordinates(pos,rot);
           vec2 obj = (pos.xy*tileSize+tile.xy);
            vec2 p = (obj-view.xy)/(view.zw-view.xy);
            // now, to clip space
            p = (p*2.0)-1.0;
            gl_Position = vec4(p.x,p.y,0.0,1.0);
        }`,
    frag: `
    precision highp float;
    uniform sampler2D img;
    uniform vec2 gamut;
    varying vec2 texCoord;
    void main(){
            float span = gamut.y-gamut.x;
            float lum = texture2D(img, texCoord).r/span-gamut.x;
            gl_FragColor = vec4(lum,lum,lum, 1.0);
        }`,
    attributes: {
      pos: [0, 0, 1, 0, 1, 1, 0, 1],
    },
    uniforms: {
      rot: regl.prop<Props, "rot">("rot"),
      tile: regl.prop<Props, "tile">("tile"),
      view: regl.prop<Props, "view">("view"),
      img: regl.prop<Props, "img">("img"),
      gamut: regl.prop<Props, "gamut">("gamut"),
    },
    count: 4,
    // viewport: regl.prop<Props, "viewport">("viewport"),
    primitive: "triangle fan",
    // ... more!
  });

  return (item: VoxelTile, settings: VoxelSliceRenderSettings, tasks: Record<string, Bfr | undefined>) => {
    const { view, viewport, gamut } = settings;
    const { bounds } = item;
    const img = tasks[LUMINANCE];
    if (!img) return; // we cant render if the data for the positions is missing!
    cmd({
      view: [...view.minCorner, ...view.maxCorner],
      tile: [...bounds.minCorner, ...bounds.maxCorner],
      // viewport,
      gamut: [gamut.min, gamut.max],
      img,
      rot: settings.rotation,
    });
  };
}
type Bfr = REGL.Texture2D;

type Tile = { bounds: box2D };
export type VoxelSliceRenderSettings = {
  regl: REGL.Regl;
  dataset: ZarrDataset;
  view: box2D;
  gamut: Interval;
  rotation: number;
  viewport: REGL.BoundingBox;
};
export type AxisAlignedPlane = "xy" | "yz" | "xz";
export type VoxelTile = {
  plane: AxisAlignedPlane;
  bounds: box2D; // in voxels, in the plane
  planeIndex: number;
  layerIndex: number;
  // time and channel are always = 0, for now
};

function toZarrRequest(tile: VoxelTile): ZarrRequest {
  const { plane, planeIndex, bounds } = tile;
  const { minCorner: min, maxCorner: max } = bounds;
  const u = { min: min[0], max: max[0] };
  const v = { min: min[1], max: max[1] };
  switch (plane) {
    case "xy":
      return {
        x: u,
        y: v,
        t: 0,
        c: 0,
        z: planeIndex,
      };
    case "xz":
      return {
        x: u,
        z: v,
        t: 0,
        c: 0,
        y: planeIndex,
      };
    case "yz":
      return {
        y: u,
        z: v,
        t: 0,
        c: 0,
        x: planeIndex,
      };
  }
}
export function cacheKeyFactory(col: string, item: VoxelTile, settings: VoxelSliceRenderSettings) {
  return `${settings.dataset.url}_${JSON.stringify(omit(item, "desiredResolution"))}_${col}`;
}
const LUMINANCE = "luminance";
export function requestsForTile(tile: VoxelTile, settings: VoxelSliceRenderSettings, signal?: AbortSignal) {
  const { dataset, regl } = settings;

  return {
    luminance: async () => {
      const vxl = await getSlice(dataset, toZarrRequest(tile), tile.layerIndex);
      // TODO: cancel?
      const { shape, buffer } = vxl;
      // upload the data to a webgl texture
      // draw that texture to the screen with our command
      // console.log("upload new tile: ", cacheKeyFactory("lum", tile, settings));
      const tex = regl.texture({
        data: new Float32Array(buffer),
        width: shape[1],
        height: shape[0], // TODO this swap is sus
        format: LUMINANCE,
      });
      return tex;
    },
  };
}

function getAllTiles(idealTilePx: vec2, layerSize: vec2) {
  // return the set of all our "tiles" of this layer, given the tilePx size
  const tiles: box2D[] = [];
  for (let x = 0; x < layerSize[0]; x += idealTilePx[0]) {
    for (let y = 0; y < layerSize[1]; y += idealTilePx[1]) {
      const xy: vec2 = [x, y];
      tiles.push(Box2D.create(xy, Vec2.min(Vec2.add(xy, idealTilePx), layerSize)));
    }
  }
  return tiles;
}
const uvTable = {
  xy: { u: "x", v: "y" },
  xz: { u: "x", v: "z" },
  yz: { u: "y", v: "z" },
} as const;

export function getVisibleTiles(
  camera: Camera,
  plane: AxisAlignedPlane,
  planeIndex: number,
  dataset: ZarrDataset,
): { view: box2D, tiles: VoxelTile[] } {
  const thingy = pickBestScale(dataset, uvTable[plane], camera.view, camera.screen);
  const layerIndex = dataset.multiscales[0].datasets.indexOf(thingy);

  const size = sizeInVoxels(uvTable[plane], dataset.multiscales[0].axes, thingy);
  if (!size) return { view: camera.view, tiles: [] };

  // camera.view is in a made up dataspace, where 1=height of the current dataset
  // thus, we have to convert it into a voxel-space camera for intersections
  const voxelView = Box2D.scale(camera.view, size);
  return {
    view: voxelView,
    tiles: getAllTiles([256, 256], size)
      .filter((tile) => !!Box2D.intersection(voxelView, tile))
      .map((uv) => ({
        plane,
        bounds: uv,
        planeIndex,
        layerIndex,
      }))
  }
}
