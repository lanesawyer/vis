import { Logger } from '@alleninstitute/vis-core';
import { Box2D } from '@alleninstitute/vis-geometry';

/**
 * SVGRenderer is a plugin for BaseViewer: drop it into a viewer with slot="plugin" and it will
 * fetch and overlay an external SVG URL atop the viewer canvas.
 */
export class SvgRenderer extends HTMLElement {
    private overlaySvg: SVGSVGElement | null = null;
    private intrinsicSize: [number, number] = [0, 0];
    private logger = new Logger('SvgRenderer', 'info');

    static get observedAttributes() {
        return ['src'];
    }

    constructor() {
        super();
        // Slot this element into the viewer's plugin slot
        this.setAttribute('slot', 'plugin');
    }

    connectedCallback() {
        // listen for camera-change on the viewer host (direct parent)
        const host = this.parentElement as HTMLElement | null;
        host?.addEventListener('camera-change', this.onCameraChange as EventListener);
        // load initial overlay
        const src = this.getAttribute('src');
        if (src) this.loadSvg(src);
    }

    disconnectedCallback() {
        const host = this.parentElement as HTMLElement | null;
        host?.removeEventListener('camera-change', this.onCameraChange as EventListener);
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        if (name === 'src' && newValue && newValue !== oldValue) {
            this.loadSvg(newValue);
        }
    }

    private onCameraChange = (evt: Event) => {
        const { view } = (evt as CustomEvent<{ view: any }>).detail;
        if (!this.overlaySvg) return;
        const [w0, h0] = this.intrinsicSize;
        // get fractional view size
        const [vw, vh] = Box2D.size(view);
        // compute pixel coords in the intrinsic SVG space
        const x = view.minCorner[0] * w0;
        const y = view.minCorner[1] * h0;
        const w = vw * w0;
        const h = vh * h0;
        this.overlaySvg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    };

    private async loadSvg(url: string) {
        // use an <img> overlay so it fits the viewer bounds
        try {
            const text = await (await fetch(url)).text();
            const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
            const svg = doc.documentElement as unknown as SVGSVGElement;
            // determine intrinsic coordinate space: from viewBox or width/height
            const vb = svg.getAttribute('viewBox');
            if (vb) {
                const [, , w0, h0] = vb.split(/[ ,]+/).map(Number);
                this.intrinsicSize = [w0, h0];
            } else {
                const w0 = parseFloat(svg.getAttribute('width') || '0');
                const h0 = parseFloat(svg.getAttribute('height') || '0');
                this.intrinsicSize = [w0, h0];
                svg.setAttribute('viewBox', `0 0 ${w0} ${h0}`);
            }
            svg.setAttribute('preserveAspectRatio', 'none');
            // style overlay to fill host
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.pointerEvents = 'none';
            if (this.overlaySvg) this.removeChild(this.overlaySvg);
            this.overlaySvg = svg;
            this.appendChild(svg);
        } catch (err) {
            console.error('SvgRenderer failed to load overlay', err);
        }
    }
}

// register custom element
if (!customElements.get('svg-renderer')) {
    customElements.define('svg-renderer', SvgRenderer);
}
