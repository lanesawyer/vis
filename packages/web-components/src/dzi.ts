import type { DziImage, DziRenderSettings } from '@alleninstitute/vis-dzi';
import { buildAsyncDziRenderer, fetchDziMetadata } from '@alleninstitute/vis-dzi';
import { type RenderFrameFn } from '@alleninstitute/vis-core';
import { BaseViewer } from './base-viewer';
import { zoom, pan } from '@alleninstitute/vis-core';
import { Box2D } from '@alleninstitute/vis-geometry';

/**
 * DziViewer is a custom web component for rendering DZI (Deep Zoom Image) files.
 */
export class DziViewer extends BaseViewer {
    private renderer: ReturnType<typeof buildAsyncDziRenderer> | null = null;
    private dziImage: DziImage | null = null;
    private settings: DziRenderSettings | null = null;

    // camera state for built-in pan/zoom
    private view = Box2D.create([0, 0], [1, 1]);
    private screenSize: [number, number] = [100, 100];
    private dragging = false;
    private lastPos: [number, number] = [0, 0];
    private static readonly ZOOM_STEP = 0.1;
    private static readonly ZOOM_IN = 1 / (1 - DziViewer.ZOOM_STEP);
    private static readonly ZOOM_OUT = 1 - DziViewer.ZOOM_STEP;

    static get observedAttributes() {
        return super.observedAttributes.concat(['url']);
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        super.attributeChangedCallback(name, oldValue, newValue);

        if (oldValue === newValue) {
            return;
        }

        if (name === 'url') {
            this.logger.info(`URL changed from ${oldValue} to ${newValue}`);
            this.loadData();
        }
    }

    public setRenderSettings(settings: DziRenderSettings, emitEvent: boolean = true) {
        this.settings = settings;
        this.beginRendering();
        // emit camera-change so sync wrappers can listen
        if (emitEvent) {
            this.dispatchEvent(
                new CustomEvent('camera-change', {
                    detail: settings.camera,
                    bubbles: true,
                    composed: true,
                }),
            );
        }
    }

    protected onServerReady() {
        if (!this.renderServer) {
            this.logger.error('Render server is not ready, but onServerReady was called');
            return;
        }
        this.renderer = buildAsyncDziRenderer(this.renderServer.regl);
    }

    private async loadData() {
        const url = this.getAttribute('url');
        if (!url) {
            this.logger.error('loadData failed: No URL provided for DZI metadata');
            return;
        }

        this.logger.info(`Loading DZI metadata for ${url}`);

        const data = await fetchDziMetadata(url);
        if (!data) {
            this.logger.error(`Failed to load DZI metadata from ${url}`);
            return;
        }

        this.logger.info(`Successfully loaded DZI metadata from ${url}`);
        this.dziImage = data;

        this.beginRendering();
    }

    private beginRendering() {
        if (!this.renderServer || !this.renderer || !this.dziImage || !this.settings) {
            this.logger.info('Tried to render, but missing required data');
            return;
        }
        const renderFrame: RenderFrameFn<DziImage, any> = (target, cache, callback) => {
            if (!this.renderer || !this.dziImage || !this.settings) {
                this.logger.error('Renderer, DziImage, or settings are not set.');
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

    connectedCallback() {
        super.connectedCallback();
        // initialize camera with actual canvas size
        this.screenSize = [this.canvas.width, this.canvas.height];
        // set initial settings
        this.setRenderSettings({ camera: { view: this.view, screenSize: this.screenSize } });
        // wire pan/zoom on the canvas
        this.canvas.addEventListener('wheel', this.handleWheel);
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
    }

    private handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? DziViewer.ZOOM_IN : DziViewer.ZOOM_OUT;
        this.view = zoom(this.view, this.screenSize, factor, [e.offsetX, e.offsetY]);
        this.setRenderSettings({ camera: { view: this.view, screenSize: this.screenSize } });
    };

    private handleMouseDown = (e: MouseEvent) => {
        this.dragging = true;
        this.lastPos = [e.offsetX, e.offsetY];
    };

    private handleMouseUp = () => {
        this.dragging = false;
    };

    private handleMouseMove = (e: MouseEvent) => {
        if (!this.dragging) return;
        const dx = e.offsetX - this.lastPos[0];
        const dy = e.offsetY - this.lastPos[1];
        this.lastPos = [e.offsetX, e.offsetY];
        this.view = pan(this.view, this.screenSize, [dx, dy]);
        this.setRenderSettings({ camera: { view: this.view, screenSize: this.screenSize } });
    };
}

// Define the custom element if not already defined
if (!customElements.get('dzi-viewer')) {
    customElements.define('dzi-viewer', DziViewer);
}
