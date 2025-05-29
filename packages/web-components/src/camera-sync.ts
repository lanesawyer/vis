import type { DziViewer } from './dzi';

/**
 * CameraSync pairs sibling viewers by listening for one viewer's `camera-change` event
 * and applying its camera settings to all other viewers under this element.
 * 
 * TODO: Consider more than just the DZI and 2D use cases
 */
export class CameraSync extends HTMLElement {
    connectedCallback() {
        this.addEventListener('camera-change', this.handleCameraChange);
    }

    disconnectedCallback() {
        this.removeEventListener('camera-change', this.handleCameraChange);
    }

    private handleCameraChange(event: Event) {
        event.stopPropagation();
        const camera = (event as CustomEvent).detail;
        const source = event.target as HTMLElement;
        // Apply camera settings to all sibling DziViewers
        this.querySelectorAll('dzi-viewer').forEach((v) => {
            if (v !== source) {
                // TODO: Better typing, also maybe don't call setRenderSettings if it doesn't exist yet?
                // TODO: Probably just need to play with the mounting order of the components
                // Apply settings without re-emitting to avoid recursion
                (v as DziViewer).setRenderSettings?.({ camera }, false);
            }
        });
    }
}

if (!customElements.get('camera-sync')) {
    customElements.define('camera-sync', CameraSync);
}
