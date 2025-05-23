import { type OmeZarrMetadata, loadMetadata } from '@alleninstitute/vis-omezarr';
import type { AxisAlignedPlane } from '../../data-renderers/versa-renderer';
import type { ColorMapping } from '../../data-renderers/types';
import type { OptionalTransform, Simple2DTransform } from '../types';
import { CartesianPlane } from '@alleninstitute/vis-geometry';
import type { WebResource } from '@alleninstitute/vis-core';
export type ZarrSliceConfig = {
    type: 'zarrSliceConfig';
    resource: WebResource;
    plane: AxisAlignedPlane;
    planeParameter: number; // [0:1] eg. if if plane is 'xy' and parameter is 0.5, then we want the slice from the middle of the z-axis
    gamut: ColorMapping;
    rotation?: number;
    trn?: Simple2DTransform | undefined;
};

export type AxisAlignedZarrSlice = {
    type: 'AxisAlignedZarrSlice';
    metadata: OmeZarrMetadata;
    plane: CartesianPlane;
    planeParameter: number;
    gamut: ColorMapping;
    rotation: number;
} & OptionalTransform;
function assembleZarrSlice(config: ZarrSliceConfig, metadata: OmeZarrMetadata): AxisAlignedZarrSlice {
    const { rotation, trn } = config;
    return {
        ...config,
        plane: new CartesianPlane(config.plane),
        type: 'AxisAlignedZarrSlice',
        metadata,
        toModelSpace: trn,
        rotation: rotation ?? 0,
    };
}
export function createZarrSlice(config: ZarrSliceConfig): Promise<AxisAlignedZarrSlice> {
    const { resource } = config;
    return loadMetadata(resource).then((metadata) => {
        return assembleZarrSlice(config, metadata);
    });
}
