import { useEffect, useState } from 'react';
import { socket } from '../lib/socket';
import { Button, Col, Container, Row } from 'react-bootstrap';
import { Modes } from '../lib/modes';
import InfoTooltip from './InfoTooltip';
import useSocketListener from '../hooks/useSocketListener';
import SmallHeader from './SmallHeader';
import Toast from 'react-bootstrap/Toast';
import { ToastContainer } from 'react-bootstrap';

const isValidJson = (str: string) => {
    try {
        const o = JSON.parse(str);
        if (o && typeof o === "object") {
            return true;
        }
    } catch (e) { }
    return false;
}

interface Props { 
    mocapMode: Modes,
    cameraPoses: any,
    setParsedCapturedPointsForPose: (newPoints: unknown) => void
}

export default function CameraPoseCalibration({ mocapMode, cameraPoses, setParsedCapturedPointsForPose }: Props) {
    const [isCalculatingPose, setIsCalculatingPose] = useState(false);
    const [captureNextPointForPose, setCaptureNextPointForPose] = useState(false)
    const [capturedPointsForPose, setCapturedPointsForPose] = useState("");
    const [showPoseCalibrationResult, setShowPoseCalibrationResult] = useState(false)
    const [reprojectionError, setReprojectionError] = useState(0);
    useEffect(() => {
        const handler = (data: any) => {
            if (captureNextPointForPose) {
                const newVal = `${capturedPointsForPose}${JSON.stringify(data)},`;
                setCapturedPointsForPose(newVal);
                setParsedCapturedPointsForPose(JSON.parse(`[${newVal.slice(0, -1)}]`))
                setCaptureNextPointForPose(false);
            }
        }
        socket.on("image-points", handler)

        return () => {
            socket.off("image-points", handler)
        }
    }, [capturedPointsForPose, captureNextPointForPose])
    const calculateCameraPose = async (cameraPoints: Array<Array<Array<number>>>) => {
        setIsCalculatingPose(true);
        socket.emit("calculate-camera-pose", { cameraPoints })
    }

    const calculateBundleAdjustment = async (cameraPoints: Array<Array<Array<number>>>) => {
        setIsCalculatingPose(true);
        socket.emit("calculate-bundle-adjustment", { cameraPoints, cameraPoses })
    }
    useSocketListener("camera-pose", (data) => {
        setIsCalculatingPose(false);
        setShowPoseCalibrationResult(true);
        setReprojectionError(data.error)
    });

    const parsedPoints = isValidJson(`[${capturedPointsForPose.slice(0, -1)}]`) ? JSON.parse(`[${capturedPointsForPose.slice(0, -1)}]`) : [];
    const countOfPointsForCameraPoseCalibration =  parsedPoints.length;
    const pointCaptureAvailable = mocapMode === Modes.PointCapture;

    return <>
        <Container fluid={true} className="pb-4 container-card">
            <Row className="pt-2">
                <Col>
                <InfoTooltip disabled={pointCaptureAvailable} message="Enable point capture mode to record points">
                    <Button
                        size='sm'
                        variant="outline-primary"
                        className="mr-2"
                        disabled={!pointCaptureAvailable || isCalculatingPose}
                        onClick={() => {
                            setCaptureNextPointForPose(true);
                        }
                        }>
                        Record point
                    </Button>
                </InfoTooltip>
                <InfoTooltip disabled={countOfPointsForCameraPoseCalibration > 0} message="No points recorded">
                    <Button
                        size='sm'
                        variant="outline-danger"
                        disabled={countOfPointsForCameraPoseCalibration === 0 || isCalculatingPose}
                        onClick={() => {
                            setCapturedPointsForPose("")
                            setParsedCapturedPointsForPose([]);
                        }
                    }>
                        Clear {countOfPointsForCameraPoseCalibration} points
                    </Button>
                </InfoTooltip>
                </Col>
            </Row>
            <Row>
                <Col>
                    <SmallHeader>Recorded points</SmallHeader>
                    <pre style={{border: "1px solid", height: 300, overflowY: "auto"}}>
                        {JSON.stringify(parsedPoints, null, 2)}
                    </pre>
                </Col>
            </Row>
            <Row className="mt-2">
                <Col>
                    <Button
                        size='sm'
                        className="mr-2"
                        variant="outline-primary"
                        disabled={countOfPointsForCameraPoseCalibration === 0 || isCalculatingPose}
                        onClick={() => {
                            calculateCameraPose(parsedPoints)
                        }}>
                        Full camera pose
                    </Button>
                    <Button
                        size='sm'
                        className="mr-2"
                        variant="outline-primary"
                        disabled={countOfPointsForCameraPoseCalibration === 0 || isCalculatingPose}
                        onClick={() => {
                            calculateBundleAdjustment(parsedPoints)
                        }}>
                        Bundle Adjustment
                    </Button>
                    {isCalculatingPose && <span>Calculating...</span>}
                </Col>
            </Row>
            <Row>
                <Col>
                <details>
                <summary>Calibration procedure</summary>
                    <p>Use the following procedure to define the translation and rotation of the cameras relative to each other.</p>
                    <ol>
                        <li>Turn on <em>one</em> light on the tracker object.</li>
                        <li>Place the object in the scene where it can be seen by multiple cameras.</li>
                        <li>Enable <em>Point detection</em></li>
                        <li>Press the <em>Record point</em> button. The captured point will be displayed on the camera feed. A green point indicates the point was visible to all cameras, a blue point was visible to n-1 cameras and a red point was visible to n-2 cameras.</li>
                        <li>Repeat until at least 10-20 points are captured. Try to cover as much of the image as possible with points.</li>
                        <li>Once happy with points, click on either "Full Pose" or "Bundle Adjustment". A full pose is necessary if you do not have an existing camera pose that is close to your camera arrangement. A bundle adjustment is preferred if there is an existing camera pose that is close.</li>
                    </ol>
                    </details>
                </Col>
            </Row>
            <ToastContainer position="bottom-center">
                <Toast show={showPoseCalibrationResult} onClose={() => setShowPoseCalibrationResult(false)}>
                    <Toast.Header>
                        <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
                        <strong className="me-auto">Pose calibration finished</strong>
                    </Toast.Header>
                    <Toast.Body>Average reprojection error {Math.round(reprojectionError*100)/100}px. 
                        <p>
                            This error level is 
                        {reprojectionError <= 1 && " excellent"}
                        {reprojectionError > 1 && reprojectionError <= 3 && " OK"}
                        {reprojectionError > 3 && reprojectionError <= 10 && " poor"}
                        {reprojectionError > 10 && " not good enough."}
                        </p>
                    </Toast.Body>
                </Toast>
            </ToastContainer>
        </Container>
    </>
}