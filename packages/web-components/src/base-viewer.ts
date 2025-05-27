import { Logger, type RenderServer } from '@alleninstitute/vis-core';
import { RENDER_SERVER_READY, RENDER_SERVER_TAG_NAME } from './render-server-provider';

export const REQUEST_RENDER_SERVER = 'request-render-server';

/**
 * Base viewer class that provides common functionality for all viewers.
 * It's primary job is requesting the RenderServer and setting up the canvas (including width and height).
 *
 * Concrete implementations should extend this class and implement the `onServerReady` method to
 * start the rendering process.
 */
export abstract class BaseViewer extends HTMLElement {
    protected canvas = document.createElement('canvas');
    protected renderServer: RenderServer | null = null;
    // TODO: Change to warn once I'm done working on the viewer components
    protected logger = new Logger(this.tagName, 'info');

    constructor() {
        super();

        this.logger.info(`Creating ${this.tagName} component`);
        this.attachShadow({ mode: 'closed' }).appendChild(this.canvas);
    }

    private renderServerReadyListener(e: Event) {
        this.renderServer = (e as CustomEvent<RenderServer>).detail;
        this.onServerReady();
    }

    static get observedAttributes() {
        return ['width', 'height'];
    }

    connectedCallback() {
        this.logger.info(`${this.tagName} connected`);

        if (!customElements.get(RENDER_SERVER_TAG_NAME)) {
            this.logger.error('Render Server Provider does not exist. Please make sure to include it in the DOM');
        }

        this.updateSize();

        this.addEventListener(RENDER_SERVER_READY, this.renderServerReadyListener, { once: true });
        this.dispatchEvent(
            new CustomEvent(REQUEST_RENDER_SERVER, {
                // Has to bubble so we can catch it in the RenderServerProvider
                bubbles: true,
            }),
        );
    }

    disconnectedCallback() {
        this.logger.info(`${this.tagName} disconnected`);

        // Clean references (no need to remove event listener, it will be removed automatically due to `once`)
        this.renderServer?.destroyClient(this.canvas);
        this.renderServer = null;
        this.canvas.remove();
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        if (oldValue === newValue) {
            return;
        }

        if (name === 'width' || name === 'height') {
            this.updateSize();
        }
    }

    protected updateSize() {
        const w = this.getAttribute('width') || '100';
        const h = this.getAttribute('height') || '100';
        this.canvas.width = parseInt(w, 10);
        this.canvas.height = parseInt(h, 10);
        this.canvas.style.width = `${this.canvas.width}px`;
        this.canvas.style.height = `${this.canvas.height}px`;
    }

    /**
     * Used to set up the concrete implementation of a viewer once the RenderServer has been provided.
     */
    protected abstract onServerReady(): void;
}
