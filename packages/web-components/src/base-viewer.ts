import { Logger, type RenderServer } from '@alleninstitute/vis-core';
import { RENDER_SERVER_READY, RENDER_SERVER_TAG_NAME } from './render-server-provider';

export const REQUEST_RENDER_SERVER = 'request-render-server';

export abstract class BaseViewer extends HTMLElement {
    protected canvas = document.createElement('canvas');
    protected renderServer: RenderServer | null = null;
    protected logger = new Logger(this.tagName, 'info');

    constructor() {
        super();

        this.logger.info(`Creating ${this.tagName} component`);
        this.appendChild(this.canvas);
    }

    private eventListener(e: Event) {
        e.stopPropagation();
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

        this.addEventListener(RENDER_SERVER_READY, this.eventListener, { once: true });
        this.dispatchEvent(
            new CustomEvent(REQUEST_RENDER_SERVER, {
                bubbles: true,
                composed: true,
            }),
        );
    }

    disconnectedCallback() {
        this.logger.info(`${this.tagName} disconnected`);

        // Clean up event listeners and references
        this.removeEventListener(RENDER_SERVER_READY, this.onServerReady);
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
        this.style.display = 'inline-block';
        this.style.width = `${w}px`;
        this.style.height = `${h}px`;
    }

    /**
     * Used to set up the concrete implementation of a viewer once the RenderServer has been provided.
     */
    protected abstract onServerReady(): void;
}
