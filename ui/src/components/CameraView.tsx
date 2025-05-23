import { Container, Badge, Button, Col, Row } from 'react-bootstrap';
import PosePoints from "./PosePoints"
import { useCallback, useState } from 'react';
import useSocketListener from '../hooks/useSocketListener';
import { Modes } from '../lib/modes';
import changeMode from '../lib/changeMode';
import CameraSettings from './CameraSettings';
import InfoTooltip from './InfoTooltip';

const BASEURL = "http://localhost:3001/api/camera-stream";

interface Props {
    mocapMode: Modes,
    parsedCapturedPointsForPose: any
}

function randString() {
    return Math.random().toString(36).slice(2)
}

export default function CameraView({mocapMode, parsedCapturedPointsForPose}: Props) {
    const [fps, setFps] = useState(0);
    const [numCams, setNumCams] = useState(0);
    // A random image suffix to cache bust
    const [imageSuffix, setImageSuffix] = useState(randString());
    useSocketListener("fps", data => {
        setFps([data["fps"]])
    })
    useSocketListener("num-cams", setNumCams)
    const refreshImage = useCallback(() => {
        setImageSuffix(randString());
    }, [])
    
    return (
        <Container fluid={true} className="p-2 shadow-md container-card">
            <Row>
                <Col>
                    <Button
                        size="sm"
                        className="me-3"
                        variant="outline-secondary"
                        onClick={refreshImage}
                        disabled={mocapMode === Modes.CamerasFound}
                    >
                    🔄 Refresh stream
                    </Button>
                    <CameraSettings />
                    <InfoTooltip disabled={mocapMode === Modes.CamerasFound} message="Image processing must be disabled">
                        <Button
                            size="sm"
                            className="me-3"
                            variant="outline-secondary"
                            onClick={() => changeMode(Modes.SaveImage)}
                            disabled={mocapMode !== Modes.CamerasFound}
                        >
                        📸 Capture frame
                        </Button>
                    </InfoTooltip>
                </Col>
                <Col style={{ textAlign: "right" }}>
                    <Badge style={{ minWidth: 80 }} bg={fps < 25 ? "danger" : fps < 60 ? "warning" : "success"}>FPS: {fps}</Badge>
                </Col>
            </Row>
            <Row className='mt-2 mb-1' style={{ height: "320px" }}>
                <Col style={{ "position": "relative", paddingLeft: 10 }}>
                    {mocapMode > Modes.CamerasNotFound ? 
                        <>
                            <img src={`${BASEURL}/${imageSuffix}`} />
                            <PosePoints numCams={numCams} points={parsedCapturedPointsForPose} />
                        </> 
                        : 
                        <div className="centered" style={{height: "300px", color: "#dc3545"}}>No cameras found!</div> }
                      
                </Col>
            </Row>
        </Container>
    )
}