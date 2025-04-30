import { logger, type RenderFrameFn, type RenderServer, type WebResource } from '@alleninstitute/vis-core';
import {
    type OmeZarrMetadata,
    type RenderSettings,
    type VoxelTile,
    buildAsyncOmezarrRenderer,
    defaultDecoder,
    loadMetadata,
} from '@alleninstitute/vis-omezarr';

const URL_REGEX = /^(s3|https):\/\/.*/;

const urlToWebResource = (url: string, region = 'us-west-2'): WebResource | undefined => {
    if (!URL_REGEX.test(url)) {
        logger.error('cannot load resource: invalid URL');
        return;
    }
    const isS3 = url.slice(0, 5) === 's3://';
    const resource: WebResource = isS3 ? { type: 's3', url, region } : { type: 'https', url };

    return resource;
};

export class OmeZarrViewer extends HTMLElement {
    private container: HTMLCanvasElement;
    private renderServer: RenderServer | null = null;
    private renderer: ReturnType<typeof buildAsyncOmezarrRenderer> | null = null;
    private omeZarrMetadata: OmeZarrMetadata | null = null;
    private settings: RenderSettings | null = null;

    constructor() {
        super();
        this.container = document.createElement('canvas');
        this.container.id = this.getAttribute('id') || 'ome-zarr-viewer';
        this.attachShadow({ mode: 'open' }).appendChild(this.container);
    }

    static observedAttributes = ['id', 'url', 'width', 'height'];

    connectedCallback() {
        logger.info('OmeZarrViewer added to page.');
        this.updateSize();
    }

    disconnectedCallback() {
        logger.info('OmeZarrViewer removed from page.');
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        if (oldValue === newValue) {
            return;
        }

        if (name === 'width' || name === 'height') {
            this.updateSize();
        }

        if (name === 'url') {
            this.loadOmeZarr();
        }
    }

    public setRenderServer(renderServer: RenderServer) {
        this.renderServer = renderServer;
        logger.info('Render server set');
    }

    public setSettings(settings: RenderSettings) {
        this.settings = settings;
    }

    private loadOmeZarr() {
        const url = this.getAttribute('url');

        if (!url) {
            logger.error('OmeZarrViewer: No URL provided.');
            return;
        }

        const webResource = urlToWebResource(url);

        if (!webResource) {
            logger.error('OmeZarrViewer: Invalid URL provided.');
            return;
        }

        logger.info('OmeZarrViewer: Loading metadata from URL:', url);

        loadMetadata(webResource).then((metadata: OmeZarrMetadata) => {
            logger.info('OmeZarr metadata loaded:', metadata);
            this.omeZarrMetadata = metadata;
            if (!this.renderServer) {
                logger.error('OmeZarrViewer: No render server set.');
                return;
            }
            const numChannels = this.omeZarrMetadata.colorChannels.length || 3;
            this.renderer = buildAsyncOmezarrRenderer(this.renderServer.regl, defaultDecoder, {
                numChannels,
                queueOptions: { maximumInflightAsyncTasks: 2 },
            });
            logger.info('OmeZarr renderer created:');
            this.beginRendering();
        });
    }

    private compose(ctx: CanvasRenderingContext2D, image: ImageData) {
        ctx.putImageData(image, 0, 0);
    }

    private beginRendering() {
        logger.info('OmeZarrViewer: Beginning rendering');
        const renderFrame: RenderFrameFn<OmeZarrMetadata, VoxelTile> = (target, cache, callback) => {
            if (this.renderer && this.omeZarrMetadata && this.settings) {
                // if we had a stashed buffer of the previous frame...
                // we could pre-load it into target, right here!
                return this.renderer(this.omeZarrMetadata, this.settings, callback, target, cache);
            }
            return null;
        };

        this.renderServer?.beginRendering(
            renderFrame,
            (e) => {
                switch (e.status) {
                    case 'begin':
                        logger.info('begin rendering');
                        // server.regl?.clear({
                        //     framebuffer: e.target,
                        //     color: [0, 0, 0, 0],
                        //     depth: 1,
                        // });
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
                    case 'progress':
                        logger.info('progress rendering');
                        // wanna see the tiles as they arrive?
                        // e.server.copyToClient(compose);
                        // if (e.target !== null && server) {
                        //     stashProgress(server, e.target);
                        // }
                        break;
                    case 'finished': {
                        logger.info('finished rendering');
                        e.server.copyToClient(this.compose);
                        // // stash our nice image... do this all the time?
                        // if (e.target !== null && server) {
                        //     stashProgress(server, e.target);
                        // }
                        break;
                    }
                    case 'cancelled':
                        logger.info('cancelled rendering');
                        break;
                    default: {
                        logger.info('default rendering');
                        break;
                    }
                }
            },
            this.container,
        );
        logger.info('OmeZarrViewer: Rendering started');
    }

    private updateSize() {
        const width = this.getAttribute('width') || '100';
        const height = this.getAttribute('height') || '100';

        this.container.style.width = `${width}px`;
        this.container.style.height = `${height}px`;
        this.container.style.border = '1px solid black';
    }
}

customElements.define('ome-zarr-viewer', OmeZarrViewer);
