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
        const custom = event as CustomEvent & {
            detail: { view: any; screenSize?: [number, number]; __sync?: boolean };
        };
        // ignore events originating from sync to prevent loops
        if (custom.detail.__sync) {
            return;
        }
        custom.stopPropagation();
        const camera = custom.detail;
        const source = event.target as HTMLElement;
        // Apply camera settings to all sibling DziViewers
        this.querySelectorAll('dzi-viewer').forEach((v) => {
            if (v !== source) {
                // Apply settings without re-emitting core event
                const target = v as DziViewer;
                target.setRenderSettings?.({ camera }, false);
                // dispatch sync camera-change for plugins
                const syncDetail = { ...camera, __sync: true };
                target.dispatchEvent(
                    new CustomEvent('camera-change', {
                        detail: syncDetail,
                        bubbles: true,
                        composed: true,
                    }),
                );
            }
        });
    }
}

if (!customElements.get('camera-sync')) {
    customElements.define('camera-sync', CameraSync);
}
