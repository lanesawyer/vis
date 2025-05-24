import type { vec2 } from '@alleninstitute/vis-geometry';
import type { RenderSettings } from '@alleninstitute/vis-omezarr';
import type { OmeZarrViewer } from '@alleninstitute/vis-web-components';
import { useContext, useEffect, useRef } from 'react';
import { renderServerContext } from '../common/react/render-server-provider';

// TODO: Do this as part of the library
declare global {
    namespace JSX {
        interface IntrinsicElements {
            'ome-zarr-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                id?: string;
                url?: string;
                width?: number;
                height?: number;
            };
        }
    }
}

interface WebComponentViewerProps {
    id: string;
    screenSize: vec2;
    settings: RenderSettings | undefined;
    onWheel?: (this: HTMLElement, ev: WheelEvent) => void;
    onMouseDown?: (this: HTMLElement, ev: MouseEvent) => void;
    onMouseUp?: (this: HTMLElement, ev: MouseEvent) => void;
    onMouseMove?: (ev: MouseEvent) => void;
    onMouseLeave?: (this: HTMLElement, ev: MouseEvent) => void;
    selectedDatasetUrl: string | undefined;
}

export function WebComponentViewer({
    id,
    settings,
    screenSize,
    selectedDatasetUrl,
    onMouseDown,
    onMouseUp,
    onMouseMove,
    onMouseLeave,
    onWheel,
}: WebComponentViewerProps) {
    const server = useContext(renderServerContext);

    const webComponentRef = useRef<OmeZarrViewer>(null);

    // setup renderer and delete it when component goes away
    useEffect(() => {
        // set up the web component
        if (server?.regl && webComponentRef.current) {
            webComponentRef.current.setRenderServer(server);
        }

        return () => {
            // TODO: destroy render server
        };
    }, [server]);

    useEffect(() => {
        if (settings && webComponentRef.current) {
            webComponentRef.current.setSettings(settings);
        }
    }, [settings]);

    // WebComponent Event Listeners
    useEffect(() => {
        const viewer = webComponentRef.current;

        if (viewer && onMouseDown) {
            viewer.addEventListener('mousedown', onMouseDown);

            return () => {
                viewer.removeEventListener('mousedown', onMouseDown);
            };
        }
    }, [onMouseDown]);

    useEffect(() => {
        const viewer = webComponentRef.current;

        if (viewer && onMouseUp) {
            viewer.addEventListener('mouseup', onMouseUp);

            return () => {
                viewer.removeEventListener('mouseup', onMouseUp);
            };
        }
    }, [onMouseUp]);

    useEffect(() => {
        const viewer = webComponentRef.current;

        if (viewer && onMouseMove) {
            viewer.addEventListener('mousemove', onMouseMove);

            return () => {
                viewer.removeEventListener('mousemove', onMouseMove);
            };
        }
    }, [onMouseMove]);

    useEffect(() => {
        const viewer = webComponentRef.current;

        if (viewer && onMouseLeave) {
            viewer.addEventListener('mouseleave', onMouseLeave);

            return () => {
                viewer.removeEventListener('mouseleave', onMouseLeave);
            };
        }
    }, [onMouseLeave]);

    useEffect(() => {
        const viewer = webComponentRef.current;

        if (viewer && onWheel) {
            viewer.addEventListener('wheel', onWheel);

            return () => {
                viewer.removeEventListener('wheel', onWheel);
            };
        }
    }, [onWheel]);

    if (!selectedDatasetUrl) {
        return <div>Choose a dataset...</div>;
    }

    return (
        <ome-zarr-viewer
            ref={webComponentRef}
            id="test"
            url={selectedDatasetUrl}
            width={screenSize?.[0]}
            height={screenSize?.[1]}
        />
    );
}
