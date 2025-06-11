import { pan, zoom, type RenderFrameFn, type WebResource } from '@alleninstitute/vis-core';
import {
    type OmeZarrMetadata,
    type RenderSettings,
    type VoxelTile,
    buildAsyncOmezarrRenderer,
    defaultDecoder,
    loadMetadata,
    makeZarrSettings,
    sizeInUnits,
} from '@alleninstitute/vis-omezarr';
import { BaseViewer } from './base-viewer';
import { Box2D, PLANE_XY, type vec2 } from '@alleninstitute/vis-geometry';

const URL_REGEX = /^(s3|https):\/\/.*/;

export class OmeZarrViewer extends BaseViewer {
    private renderer: ReturnType<typeof buildAsyncOmezarrRenderer> | null = null;
    private omeZarrMetadata: OmeZarrMetadata | null = null;
    private settings: RenderSettings | null = null;

    // camera state for built-in pan/zoom
    private view = Box2D.create([0, 0], [1, 1]);
    private screenSize: [number, number] = [100, 100];
    private dragging = false;
    private lastPos: [number, number] = [0, 0];
    private static readonly ZOOM_STEP = 0.1;
    private static readonly ZOOM_IN = 1 / (1 - OmeZarrViewer.ZOOM_STEP);
    private static readonly ZOOM_OUT = 1 - OmeZarrViewer.ZOOM_STEP;


    constructor() {
        super();
    }

    static get observedAttributes() {
        return super.observedAttributes.concat(['id', 'url']);
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        super.attributeChangedCallback(name, oldValue, newValue);

        if (oldValue === newValue) {
            return;
        }

        if (name === 'url') {
            this.loadData();
        }
    }

    public setRenderSettings(settings: RenderSettings) {
        this.settings = settings;
        this.beginRendering();
    }

    // TODO: Take loading out of this, maybe call it in onServerReady?
    protected async onServerReady() {
        this.logger.info('OmeZarrViewer: Render server is ready');
        if (!this.renderServer) {
            this.logger.error('Render server is not ready, but onServerReady was called');
            return;
        }

        // If we have the settings, we can start rendering immediately, otherwise it's on the dev
        // to call setSettings with the appropriate parameters later.
        if (this.settings) {
            this.beginRendering();
        }
    }

    // TODO: We're loading in here but also in the Astro component. Should let the web component do the loading
    // and then we can ask for the data we need in the Astro component.
    private async loadData() {
        this.logger.info('OmeZarrViewer: Loading data');
        const url = this.getAttribute('url');

        if (!url) {
            this.logger.error('OmeZarrViewer: No URL provided.');
            return;
        }

        const urlToWebResource = (url: string, region = 'us-west-2'): WebResource | undefined => {
            if (!URL_REGEX.test(url)) {
                this.logger.error('cannot load resource: invalid URL');
                return;
            }
            const isS3 = url.slice(0, 5) === 's3://';
            const resource: WebResource = isS3 ? { type: 's3', url, region } : { type: 'https', url };

            return resource;
        };
        const webResource = urlToWebResource(url);

        if (!webResource) {
            this.logger.error('OmeZarrViewer: Invalid URL provided.');
            return;
        }

        this.logger.info('OmeZarrViewer: Loading metadata from URL:', url);

        const metadata = await loadMetadata(webResource);

        this.logger.info('OmeZarr metadata loaded:', metadata);
        this.omeZarrMetadata = metadata;

        const dataset = metadata.getFirstShapedDataset(0);
        if (!dataset) {
            throw new Error('dataset 0 does not exist!');
        }
        const size = sizeInUnits(PLANE_XY, metadata.attrs.multiscales[0].axes, dataset);
        if (size) {
            // logger.info('dataset size', size);
            const aspectRatio = this.screenSize[0] / this.screenSize[1];
            const adjustedSize: vec2 = [size[0], size[0] / aspectRatio];
            this.view = Box2D.create([0, 0], adjustedSize);
        }

        if (!this.renderServer) {
            this.logger.error('OmeZarrViewer: No render server set.');
            return;
        }
        const numChannels = this.omeZarrMetadata.colorChannels.length || 3;
        this.renderer = buildAsyncOmezarrRenderer(this.renderServer.regl, defaultDecoder, {
            numChannels,
            queueOptions: { maximumInflightAsyncTasks: 2 },
        });
        this.logger.info('OmeZarr renderer created:');
        this.beginRendering();
    }

    private compose(ctx: CanvasRenderingContext2D, image: ImageData) {
        ctx.putImageData(image, 0, 0);
    }

    private beginRendering() {
        this.logger.info('OmeZarrViewer: Beginning rendering');
        const renderFrame: RenderFrameFn<OmeZarrMetadata, VoxelTile> = (target, cache, callback) => {
            this.logger.info('OmeZarrViewer: Render frame called');
            if (this.renderer && this.omeZarrMetadata && this.settings) {
                // if we had a stashed buffer of the previous frame...
                // we could pre-load it into target, right here!
                this.logger.info('OmeZarrViewer: Rendering with renderer');
                return this.renderer(this.omeZarrMetadata, this.settings, callback, target, cache);
            }
            return null;
        };

        this.renderServer?.beginRendering(
            renderFrame,
            (e) => {
                switch (e.status) {
                    case 'begin': {
                        this.logger.info('begin rendering');
                        this.renderServer?.regl?.clear({
                            framebuffer: e.target,
                            color: [0, 0, 0, 0],
                            depth: 1,
                        });
                        // lowResPreview(e.target, server.cache, (_e) => {})?.cancelFrame(
                        //     'lowres preview beneath actual frame',
                        // );
                        // if (imgRenderer.current && stash.current) {
                        //     imgRenderer.current({
                        //         box: Box2D.toFlatArray(stash.current.camera.view),
                        //         img: stash.current.image,
                        //         depth: 1,
                        //         target: e.target,
                        //         view: Box2D.toFlatArray(settings.camera.view),
                        //     });
                        //     e.server.copyToClient(compose);
                        // }
                        break;
                    }
                    case 'progress': {
                        this.logger.info('progress rendering');
                        e.server.copyToClient(this.compose);
                        // if (e.target !== null && server) {
                        //     stashProgress(server, e.target);
                        // }
                        break;
                    }
                    case 'finished': {
                        this.logger.info('finished rendering');
                        e.server.copyToClient(this.compose);
                        // // stash our nice image... do this all the time?
                        // if (e.target !== null && server) {
                        //     stashProgress(server, e.target);
                        // }
                        break;
                    }
                    case 'cancelled': {
                        this.logger.info('cancelled rendering');
                        break;
                    }
                }
            },
            this.canvas,
        );
    }

    connectedCallback() {
        super.connectedCallback();
        this.screenSize = [this.canvas.width, this.canvas.height];

        // wire pan/zoom on the canvas
        this.canvas.addEventListener('wheel', this.handleWheel);
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
    }

    private handleWheel = (e: WheelEvent) => {
        if (!this.omeZarrMetadata) {
            return;
        }
        e.preventDefault();
        const scale = e.deltaY > 0 ? OmeZarrViewer.ZOOM_IN : OmeZarrViewer.ZOOM_OUT;
        this.view = zoom(this.view, this.screenSize, scale, [e.offsetX, e.offsetY]);
        const newSettings = makeZarrSettings(this.omeZarrMetadata, this.screenSize, this.view, PLANE_XY, 0);
        this.setRenderSettings(newSettings);
    };

    private handleMouseDown = (e: MouseEvent) => {
        this.dragging = true;
        this.lastPos = [e.offsetX, e.offsetY];
    };

    private handleMouseUp = () => {
        this.dragging = false;
    };

    private handleMouseMove = (e: MouseEvent) => {
        if (!this.dragging || !this.omeZarrMetadata) {
            return;
        }
        const dx = e.offsetX - this.lastPos[0];
        const dy = e.offsetY - this.lastPos[1];
        this.lastPos = [e.offsetX, e.offsetY];
        this.view = pan(this.view, this.screenSize, [dx, dy]);
        const newSettings = makeZarrSettings(this.omeZarrMetadata, this.screenSize, this.view, PLANE_XY, 0);
        this.setRenderSettings(newSettings);
    };    
}

if (!customElements.get('ome-zarr-viewer')) {
    customElements.define('ome-zarr-viewer', OmeZarrViewer);
}
