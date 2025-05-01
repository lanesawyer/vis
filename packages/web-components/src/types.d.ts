import { RenderServer } from '@alleninstitute/vis-core';
import { RenderSettings } from '@alleninstitute/vis-omezarr';

declare global {
    interface OmeZarrViewer extends HTMLElement {
        /**
         * Sets the render server for the viewer.
         * @param renderServer - The render server instance.
         */
        // setRenderServer(renderServer: RenderServer): void;

        /**
         * Sets the render settings for the viewer.
         * @param settings - The render settings.
         */
        setSettings(settings: RenderSettings): void;

        /**
         * The URL of the OME-Zarr dataset to load.
         */
        url: string;

        /**
         * The width of the viewer in pixels.
         */
        width: number;

        /**
         * The height of the viewer in pixels.
         */
        height: number;
    }

    interface HTMLElementTagNameMap {
        'ome-zarr-viewer': OmeZarrViewer;
    }
}
