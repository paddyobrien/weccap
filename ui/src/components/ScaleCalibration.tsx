import { MutableRefObject, useCallback, useEffect, useState } from "react"
import { Button, Col, Container, Form, Row } from "react-bootstrap"
import InfoTooltip from "./InfoTooltip"
import { socket } from "../lib/socket"
import { Modes } from "../lib/modes"
import SmallHeader from "./SmallHeader"
import Toast from 'react-bootstrap/Toast';
import { ToastContainer } from 'react-bootstrap';
import useSocketListener from "../hooks/useSocketListener"

interface Props {
    mocapMode: Modes,
    cameraPoses: any,
    objectPoints: MutableRefObject<number[][][]>,
    lastObjectPointTimestamp: number,
    setCameraPoses: (s: any) => void
    setLastObjectPointTimestamp: (s: any) => void
}

const DEFAULT_DIST = 0.119;

export default function ScaleCalibration({mocapMode, cameraPoses, setCameraPoses, objectPoints, lastObjectPointTimestamp, setLastObjectPointTimestamp}: Props) {
    const [captureNextPoint, setCaptureNextPoint] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false);
    const [realDistance, setRealDistance] = useState(DEFAULT_DIST)
    const [showScaleCalibrationResult, setShowScaleCalibrationResult] = useState(false)
    const [showScaleCalibrationError, setShowScaleCalibrationError] = useState(false);
    const [scaleCalibrationErrorMessage, setScaleCalibrationErrorMessage] = useState("")
    const [scaleFactor, setScaleFactor] = useState(0);

    const updatePoints = useCallback((data) => {
        if (captureNextPoint) {
            objectPoints.current.push(data["object_points"])
            setCaptureNextPoint(false)
        }
    }, [captureNextPoint])

    const setScale = useCallback(() => {
        setIsProcessing(true);
        socket.emit("determine-scale", { objectPoints: objectPoints.current, realDistance: realDistance,  })
    }, [realDistance, objectPoints])

    useSocketListener("object-points", updatePoints)

    useSocketListener("scaled", (data) => {
        setIsProcessing(false);
        setShowScaleCalibrationResult(true);
        setScaleFactor(data.scale_factor);
        setCameraPoses(data.camera_poses);
    })

    useSocketListener("scale-error", (data) => {
        setIsProcessing(false);
        setShowScaleCalibrationError(true);
        setScaleCalibrationErrorMessage(data.message);
    })

    const objectPointsEnabled = mocapMode >= Modes.Triangulation
    const countOfPoints = objectPoints.current.length;
    return (
        <Container fluid={true} className="container-card">
            <Row className="pt-2">
                <Col>
                <InfoTooltip disabled={objectPointsEnabled} message="Enable triangulation to record points">
                    <Button
                        size='sm'
                        variant="outline-primary"
                        className="mr-2"
                        disabled={!objectPointsEnabled}
                        onClick={() => {
                            setCaptureNextPoint(true);
                        }
                    }>
                        Record point
                    </Button>
                </InfoTooltip>
                <InfoTooltip disabled={countOfPoints > 0} message="No points recorded">
                    <Button
                        size='sm'
                        variant="outline-danger"
                        disabled={countOfPoints === 0}
                        onClick={() => {
                            objectPoints.current = [];
                            setLastObjectPointTimestamp(0);
                        }
                    }>
                        Clear {countOfPoints} points
                    </Button>
                </InfoTooltip>
                </Col>
            </Row>
            <Row>
                <Col>
                    <SmallHeader>Recorded points</SmallHeader>
                    <pre style={{border: "1px solid", height: 300, overflowY: "auto"}}>
                        {JSON.stringify(objectPoints.current, null, 2)}
                    </pre>
                </Col>
            </Row>
            <Row>
                <Col>
                    <SmallHeader>Real world distance</SmallHeader>
                    <Form.Control
                        value={realDistance}
                        onChange={(event) => setRealDistance(JSON.parse(event.target.value))}
                    />
                </Col>
            </Row>
            <Row className="mt-2">
                <Col>
                    <Button
                        size='sm'
                        className="mr-2"
                        variant="outline-primary"
                        disabled={countOfPoints == 0}
                        onClick={setScale}>
                        Set scale
                    </Button>
                </Col>
            </Row>
            <Row className="p-2">
                <Col>
                <details>
                    <summary>Calibration procedure</summary>
                    <p>Use this procedure to set the scale of the world so that distances are valid.</p>
                    <ol>
                        <li>Turn on <em>both</em> lights on the tracker object.</li>
                        <li>Place the object in the scene where it can be seen by multiple cameras.</li>
                        <li>Enable <em>Triangulation</em></li>
                        <li>To ensure pose calibration is correct look at the camera feed and verify that the epipolar lines are intersecting both dots from all cameras</li>
                        <li>Press the <em>Record point</em> button.</li>
                        <li>Repeat for several points at different locations in the scene.</li>
                        <li>Set the real world distance to the distance between the lights.</li>
                        <li>Once happy with points, click on <em>Set scale</em></li>
                    </ol>
                </details>
                </Col>
            </Row>
            <ToastContainer position="bottom-center">
                <Toast show={showScaleCalibrationResult} onClose={() => setShowScaleCalibrationResult(false)}>
                    <Toast.Header>
                        <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
                        <strong className="me-auto">Scaling finished</strong>
                    </Toast.Header>
                    <Toast.Body>Scale factor was {scaleFactor}.</Toast.Body>
                </Toast>
                <Toast show={showScaleCalibrationError} onClose={() => setShowScaleCalibrationError(false)}>
                    <Toast.Header>
                        <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
                        <strong className="me-auto">Scaling failed</strong>
                    </Toast.Header>
                    <Toast.Body>{scaleCalibrationErrorMessage}.</Toast.Body>
                </Toast>
            </ToastContainer>
        </Container>
    )
}