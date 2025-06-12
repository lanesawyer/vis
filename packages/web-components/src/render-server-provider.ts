import { Logger, RenderServer } from '@alleninstitute/vis-core';
import { REQUEST_RENDER_SERVER } from './base-viewer';

export const RENDER_SERVER_TAG_NAME = 'render-server-provider';
export const RENDER_SERVER_READY = 'render-server-ready';

export const DEFAULT_MAX_SIZE = 4096;

export class RenderServerProvider extends HTMLElement {
    private renderServer: RenderServer;
    // TODO: Change to warn once I'm done working on the viewer components
    private logger = new Logger(RENDER_SERVER_TAG_NAME, 'info');

    constructor() {
        super();
        this.logger.info('Created');

        const oes_texture_float = this.getAttribute('oes_texture_float');
        const extensions = oes_texture_float ? ['oes_texture_float'] : [];

        this.logger.info(`Using extensions: ${extensions.join(', ')}`);

        this.renderServer = new RenderServer([DEFAULT_MAX_SIZE, DEFAULT_MAX_SIZE], extensions);
    }

    static get observedAttributes() {
        return ['oes_texture_float'];
    }

    connectedCallback() {
        this.logger.info('Connected');
        // Listen for requests from child components
        this.addEventListener(REQUEST_RENDER_SERVER, (event: Event) => {
            event.stopPropagation();
            this.logger.info('Received request for render server');
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
