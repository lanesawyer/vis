import { Button } from '@czi-sds/components';
import type { Demo } from '../layers';
import { AnnotationGrid } from '../ui/annotation-grid';
import { ContactSheetUI } from '../ui/contact-sheet';
import { ScatterplotUI } from '../ui/scatterplot-ui';
import { SliceViewLayer } from '../ui/slice-ui';

export function AppUi(props: { demo: Demo }) {
    const { demo } = props;
    return (
        <div>
            <Button
                onClick={() => {
                    demo.requestSnapshot(3000);
                }}
            >
                {'📷'}
            </Button>
            <label htmlFor="layer">{`Layer ${demo.selectedLayer}`}</label>
            <Button
                name="layer"
                onClick={() => {
                    demo.selectLayer(demo.selectedLayer - 1);
                }}
            >
                {'<-'}
            </Button>
            <Button
                onClick={() => {
                    demo.selectLayer(demo.selectedLayer + 1);
                }}
            >
                {'->'}
            </Button>
            <LayerUi demo={demo} />
        </div>
    );
}
function LayerUi(props: { demo: Demo }) {
    const { demo } = props;
    const layer = demo.layers[demo.selectedLayer];
    if (layer) {
        switch (layer.type) {
            case 'annotationGrid':
                return <AnnotationGrid demo={demo} />;
            case 'volumeGrid':
                return <ContactSheetUI demo={demo} />;
            case 'volumeSlice':
                return <SliceViewLayer demo={demo} />;
            case 'scatterplot':
            case 'scatterplotGrid':
                return <ScatterplotUI demo={demo} />;
            default:
                return null;
        }
    }
    return <SliceViewLayer demo={props.demo} />;
}
