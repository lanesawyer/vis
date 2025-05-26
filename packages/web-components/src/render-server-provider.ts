import { logger, RenderServer } from '@alleninstitute/vis-core';
import { REQUEST_RENDER_SERVER } from './base-viewer';

export const RENDER_SERVER_TAG_NAME = 'render-server-provider';
export const RENDER_SERVER_READY = 'render-server-ready';

export class RenderServerProvider extends HTMLElement {
    private renderServer: RenderServer;

    constructor() {
        super();
        logger.info('RenderServerProvider created');
        // TODO: Pass in render server options
        // Initialize RenderServer with a reasonable max size and no extensions
        this.renderServer = new RenderServer([4096, 4096], []);
    }

    connectedCallback() {
        logger.info('RenderServerProvider connected');
        // Listen for requests from child components
        this.addEventListener(REQUEST_RENDER_SERVER, (event: Event) => {
            logger.info('RenderServerProvider received request for render server');
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
