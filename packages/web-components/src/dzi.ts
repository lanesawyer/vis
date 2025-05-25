// Define a DZI Viewer web component using the vis-dzi library
import type { DziImage, DziRenderSettings } from '@alleninstitute/vis-dzi';
import { buildAsyncDziRenderer } from '@alleninstitute/vis-dzi';
import { type RenderServer, type RenderFrameFn, logger } from '@alleninstitute/vis-core';

export class DziViewer extends HTMLElement {
    private canvas: HTMLCanvasElement;
    private renderServer: RenderServer | null = null;
    private renderer: ReturnType<typeof buildAsyncDziRenderer> | null = null;
    private dziImage: DziImage | null = null;
    private settings: DziRenderSettings | null = null;

    static get observedAttributes() {
        return ['width', 'height'];
    }

    constructor() {
        super();
        this.canvas = document.createElement('canvas');
        this.appendChild(this.canvas);
    }

    connectedCallback() {
        this.updateSize();
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        if (oldValue !== newValue && (name === 'width' || name === 'height')) {
            this.updateSize();
        }
    }

    // Set the render server (must be provided by host)
    public setRenderServer(renderServer: RenderServer) {
        this.renderServer = renderServer;
        this.renderer = buildAsyncDziRenderer(renderServer.regl);
    }

    // Set the DZI image and rendering settings, then start rendering
    public setImage(dzi: DziImage, settings: DziRenderSettings) {
        this.dziImage = dzi;
        this.settings = settings;
        this.beginRendering();
    }

    private beginRendering() {
        const dziImage = this.dziImage;
        const settings = this.settings;
        if (!this.renderServer || !this.renderer || !dziImage || !settings) {
            return;
        }
        const renderFrame: RenderFrameFn<DziImage, any> = (target, cache, callback) => {
            return this.renderer!(dziImage, settings, callback, target, cache);
        };
        // renderServer handles scheduling and composition
        this.renderServer.beginRendering(
            renderFrame,
            (e) => {
                switch (e.status) {
                    case 'begin': {
                        logger.info('Rendering started');
                        this.renderServer?.regl?.clear({
                            framebuffer: e.target,
                            color: [0, 0, 0, 0],
                            depth: 1,
                        });
                        break;
                    }
                    case 'progress': {
                        logger.info('Rendering progress');
                        e.server.copyToClient((ctx: CanvasRenderingContext2D, image: ImageData) => {
                            ctx.putImageData(image, 0, 0);
                        });
                        break;
                    }
                    case 'finished': {
                        logger.info('Rendering finished');
                        e.server.copyToClient((ctx: CanvasRenderingContext2D, image: ImageData) => {
                            ctx.putImageData(image, 0, 0);
                        });
                        break;
                    }
                    case 'cancelled': {
                        logger.info('Rendering cancelled');
                        break;
                    }
                    default: {
                        logger.warn(`Unknown render status: ${e.status}`);
                    }
                }
            },
            this.canvas,
        );
    }

    private updateSize() {
        const w = this.getAttribute('width') || '300';
        const h = this.getAttribute('height') || '200';
        this.canvas.width = parseInt(w, 10);
        this.canvas.height = parseInt(h, 10);
        this.style.display = 'inline-block';
        this.style.width = `${w}px`;
        this.style.height = `${h}px`;
    }
}

// Define the custom element if not already defined
if (!customElements.get('dzi-viewer')) {
    customElements.define('dzi-viewer', DziViewer);
}
