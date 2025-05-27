import type { DziImage, DziRenderSettings } from '@alleninstitute/vis-dzi';
import { buildAsyncDziRenderer } from '@alleninstitute/vis-dzi';
import { type RenderFrameFn } from '@alleninstitute/vis-core';
import { BaseViewer } from './base-viewer';

/**
 * DziViewer is a custom web component for rendering DZI (Deep Zoom Image) files.
 */
export class DziViewer extends BaseViewer {
    private renderer: ReturnType<typeof buildAsyncDziRenderer> | null = null;
    private dziImage: DziImage | null = null;
    private settings: DziRenderSettings | null = null;

    constructor() {
        super();
        this.logger.info('Creating DziViewer component');
    }

    public setImage(dzi: DziImage, settings: DziRenderSettings) {
        this.dziImage = dzi;
        this.settings = settings;
        this.beginRendering();
    }

    protected onServerReady() {
        if (!this.renderServer) {
            this.logger.error('Render server is not ready, but onServerReady was called');
            return;
        }
        this.renderer = buildAsyncDziRenderer(this.renderServer.regl);

        // If the necessary properties are set, start rendering, otherwise it's on the dev
        // to call setImage with the appropriate parameters later.
        if (this.dziImage && this.settings) {
            this.beginRendering();
        }
    }

    private beginRendering() {
        if (!this.renderServer || !this.renderer || !this.dziImage || !this.settings) {
            return;
        }
        const renderFrame: RenderFrameFn<DziImage, any> = (target, cache, callback) => {
            if (!this.renderer || !this.dziImage || !this.settings) {
                this.logger.error('DziViewer: Renderer, DziImage, or settings are not set.');
                return null;
            }
            return this.renderer(this.dziImage, this.settings, callback, target, cache);
        };
        // renderServer handles scheduling and composition
        this.renderServer.beginRendering(
            renderFrame,
            (e) => {
                switch (e.status) {
                    case 'begin': {
                        this.logger.info('Rendering started');
                        this.renderServer?.regl?.clear({
                            framebuffer: e.target,
                            color: [0, 0, 0, 0],
                            depth: 1,
                        });
                        break;
                    }
                    case 'progress': {
                        this.logger.info('Rendering progress');
                        e.server.copyToClient((ctx, image) => {
                            ctx.putImageData(image, 0, 0);
                        });
                        break;
                    }
                    case 'finished': {
                        this.logger.info('Rendering finished');
                        e.server.copyToClient((ctx, image) => {
                            ctx.putImageData(image, 0, 0);
                        });
                        break;
                    }
                    case 'cancelled': {
                        this.logger.info('Rendering cancelled');
                        break;
                    }
                    default: {
                        this.logger.warn(`Unknown render status: ${e.status}`);
                    }
                }
            },
            this.canvas,
        );
    }
}

// Define the custom element if not already defined
if (!customElements.get('dzi-viewer')) {
    customElements.define('dzi-viewer', DziViewer);
}
