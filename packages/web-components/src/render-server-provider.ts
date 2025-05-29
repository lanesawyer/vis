import { Logger, RenderServer } from '@alleninstitute/vis-core';
import { REQUEST_RENDER_SERVER } from './base-viewer';

export const RENDER_SERVER_TAG_NAME = 'render-server-provider';
export const RENDER_SERVER_READY = 'render-server-ready';

export class RenderServerProvider extends HTMLElement {
    private renderServer: RenderServer;
    private logger = new Logger(RENDER_SERVER_TAG_NAME, 'info');

    constructor() {
        super();
        this.logger.info('Created');
        // TODO: Pass in render server options
        // Initialize RenderServer with a reasonable max size and oes_texture_float extension for OME-Zarr viewer
        this.renderServer = new RenderServer([4096, 4096], ['oes_texture_float']);
    }

    connectedCallback() {
        this.logger.info('Connected');
        // Listen for requests from child components
        this.addEventListener(REQUEST_RENDER_SERVER, (event: Event) => {
            this.logger.info('Received request for render server');
            event.stopPropagation();
            const targetEl = event.target as HTMLElement;
            const responseEvent = new CustomEvent(RENDER_SERVER_READY, {
                detail: this.renderServer,
                bubbles: true,
                composed: true,
            });
            targetEl.dispatchEvent(responseEvent);
        });
    }
}

// Define the custom element if not already defined
if (!customElements.get(RENDER_SERVER_TAG_NAME)) {
    customElements.define(RENDER_SERVER_TAG_NAME, RenderServerProvider);
}
