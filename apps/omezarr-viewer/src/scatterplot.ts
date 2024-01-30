// I am the scatterplot demo //

import REGL from 'regl';
import { buildScatterplotRenderer } from './renderer';

// I need to add a canvas to the document,
// then instantiate some WebGL on it
// then fire up REGL (https://github.com/regl-project/regl)
// then start my pretend renderer

function demotime() {
    const regl = REGL();
    const renderer = buildScatterplotRenderer(regl);
    const fakeXYPoints: Float32Array = new Float32Array([1, 1, 4, 4, 7, 1]);
    const canvas: HTMLCanvasElement = regl._gl.canvas as HTMLCanvasElement;
    regl.clear({ color: [0, 0, 0, 1], depth: 1 });

    renderer(
        {
            bounds: { minCorner: [0, 0], maxCorner: [10, 10] },
            count: 3,
            url: 'weare_pretending_we_loaded_this_from_teh_internets.com/data.bin',
        },
        {
            view: { minCorner: [0, 0], maxCorner: [10, 10] },
            viewport: {
                x: 0,
                y: 0,
                width: canvas.clientWidth,
                height: canvas.clientHeight,
            },
        },
        {
            position: {
                buffer: fakeXYPoints,
            },
        }
    );
}

// since I am just included in a script tag in a raw html document, this is how we start:
demotime();
