import { type vec2, type box2D, PLANE_XY, type Interval } from '@alleninstitute/vis-geometry';
import type { OmeZarrMetadata, RenderSettings, RenderSettingsChannels } from '@alleninstitute/vis-omezarr';

const defaultInterval: Interval = { min: 0, max: 80 };

export function makeZarrSettings(
    screenSize: vec2,
    view: box2D,
    orthoVal: number,
    omezarr: OmeZarrMetadata,
): RenderSettings {
    const omezarrChannels = omezarr.colorChannels.reduce((acc, val, index) => {
        acc[val.label ?? `${index}`] = {
            rgb: val.rgb,
            gamut: val.range,
            index,
        };
        return acc;
    }, {} as RenderSettingsChannels);

    const fallbackChannels: RenderSettingsChannels = {
        R: { rgb: [1.0, 0, 0], gamut: defaultInterval, index: 0 },
        G: { rgb: [0, 1.0, 0], gamut: defaultInterval, index: 1 },
        B: { rgb: [0, 0, 1.0], gamut: defaultInterval, index: 2 },
    };

    return {
        camera: { screenSize, view },
        orthoVal,
        plane: PLANE_XY,
        tileSize: 256,
        channels: Object.keys(omezarrChannels).length > 0 ? omezarrChannels : fallbackChannels,
    };
}
