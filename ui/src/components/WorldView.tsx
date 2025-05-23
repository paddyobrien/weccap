import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import CameraWireframe from './CameraWireframe';
import Objects from './Objects';
import Points from './Points';
import { Container, Row } from 'react-bootstrap';

interface Props {
    cameraPoses: any,
    toWorldCoordsMatrix: any,
    objectPoints: any,
    objectPointErrors: any,
    objectPointCount: any,
    filteredObjects: any,
}

export default function WorldView({ cameraPoses, toWorldCoordsMatrix, objectPoints, objectPointErrors, objectPointCount, filteredObjects }: Props) {
    return (
        <Container fluid={true} className="p-2 shadow-md container-card">
            <Row className='mt-2 mb-1' style={{ height: "420px" }}>
                <Canvas orthographic camera={{ zoom: 500, position: [10, 10, 10] }}>
                    <ambientLight />
                    {cameraPoses.map(({ R, t }, i) => (
                        <CameraWireframe R={R} t={t} toWorldCoordsMatrix={toWorldCoordsMatrix} key={i} />
                    ))}
                    <Points objectPointsRef={objectPoints} objectPointErrorsRef={objectPointErrors} count={objectPointCount} />
                    <Objects filteredObjectsRef={filteredObjects} count={objectPointCount} />
                    <OrbitControls />
                    <axesHelper args={[0.2]} />
                    <gridHelper args={[4, 4 * 10]} />
                    <directionalLight />
                </Canvas>
            </Row>
        </Container>
    )
}