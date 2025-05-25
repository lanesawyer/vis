import { logger, RenderServer } from '@alleninstitute/vis-core';

export class RenderServerProvider extends HTMLElement {
    private renderServer: RenderServer;

    constructor() {
        super();
        logger.info('RenderServerProvider created');
        // Initialize RenderServer with a reasonable max size and no extensions
        this.renderServer = new RenderServer([4096, 4096], []);
    }

    connectedCallback() {
        logger.info('RenderServerProvider connected');
        // Listen for requests from child components
        this.addEventListener('request-render-server', (event: Event) => {
            logger.info('RenderServerProvider received request for render server');
            event.stopPropagation();
            const targetEl = event.target as HTMLElement;
            const responseEvent = new CustomEvent('render-server-provided', {
                detail: this.renderServer,
                bubbles: true,
                composed: true,
            });
            targetEl.dispatchEvent(responseEvent);
        });
    }
}

// Define the custom element if not already defined
if (!customElements.get('render-server-provider')) {
    customElements.define('render-server-provider', RenderServerProvider);
}
