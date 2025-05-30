import { Button, Col, Container, Form, Row } from "react-bootstrap";
import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { Modes } from "../lib/modes";
import { socket } from "../lib/socket";
import SmallHeader from "./SmallHeader";
import InfoTooltip from "./InfoTooltip";

import { createZipFile, triggerDownload } from "../lib/download";

interface Props {
    cameraPoses: any,
    toWorldCoordsMatrix: any,
    mocapMode: Modes,
    objectPoints: MutableRefObject<number[][][]>
    objectPointErrors: any,
    lastObjectPointTimestamp: any,
    isRecording: boolean,
    setIsRecording: (b: boolean) => void
}


export default function Capture({ cameraPoses, toWorldCoordsMatrix, mocapMode, objectPoints, objectPointErrors, lastObjectPointTimestamp, isRecording, setIsRecording }: Props) {
    const [currentCaptureName, setCurrentCaptureName] = useState("");
    const [recordVideo, setRecordVideo] = useState(false);
    const objectPointTimes = useRef<Array<Array<Array<number>>>>([]);
    const imagePoints = useRef<Array<Array<number>>>([])


    useEffect(() => {
        const record = (data) => {
            if (isRecording) {
                objectPoints.current.push(data["object_points"]);
                objectPointTimes.current.push(data["time_ms"]);
                objectPointErrors.current.push(data["errors"]);
                imagePoints.current.push(data["image_points"]);
            }
        }
        socket.on("object-points", record)
        return () => {
            socket.off("object-points", record)
        }
    }, [objectPoints, isRecording])

    const canRecord = mocapMode === Modes.Triangulation && currentCaptureName !== "";

    const downloadZipFile = useCallback(() => {
        createZipFile(
            currentCaptureName,
            objectPointTimes.current,
            objectPoints.current,
            objectPointErrors.current,
            imagePoints.current,
            cameraPoses,
            toWorldCoordsMatrix,
        )
    }, [currentCaptureName, cameraPoses, toWorldCoordsMatrix])

    const stopRecording = useCallback(() => {
        createZipFile(
            currentCaptureName,
            objectPointTimes.current,
            objectPoints.current,
            objectPointErrors.current,
            imagePoints.current,
            cameraPoses,
            toWorldCoordsMatrix,
        )
        setIsRecording(false)
        socket.emit("stop_recording")

    }, [currentCaptureName, cameraPoses, toWorldCoordsMatrix])

    return (
        <Container fluid={true} className="pb-2 shadow-md container-card">
            <Row>
                <Col>
                    <SmallHeader>Recording Name</SmallHeader>
                    <Form.Control
                        value={currentCaptureName}
                        onChange={(event) => setCurrentCaptureName(event.target.value)}
                        width={"50%"}
                        className="mb-2"
                    />
                    <Form.Check
                        type="checkbox"
                        label="Record video (reduces framerate)"
                        checked={recordVideo}
                        id="recordVideoCB"
                        onChange={() => setRecordVideo(!recordVideo)}
                        className="p-6"
                    />
                </Col>
            </Row>
            <Row className="mt-2">
                <Col>
                    <InfoTooltip disabled={canRecord || isRecording} message="Enable triangulation and add a recording name">
                        <Button
                            size='sm'
                            className="mr-2"
                            variant="outline-primary"
                            disabled={!canRecord || isRecording}
                            onClick={() => {
                                objectPoints.current = []
                                objectPointTimes.current = [];
                                imagePoints.current = [];
                                objectPointErrors.current = [];
                                if (recordVideo) {
                                    socket.emit("start_recording", {name: currentCaptureName})
                                }
                                setIsRecording(true);
                            }}>
                            {isRecording ? "Recording..." : "Start recording"}
                        </Button>
                        
                    </InfoTooltip>
                    {isRecording &&
                        <>
                            <Button
                                size='sm'
                                className="mr-2"
                                variant="outline-danger"
                                disabled={!canRecord}
                                onClick={stopRecording}>
                                Stop
                            </Button>
                            {objectPoints.current.length} samples captured
                        </>
                    }
                    {!isRecording && objectPoints.current.length > 0 &&
                        <>
                            <Button
                                size='sm'
                                className="mr-2"
                                variant="outline-danger"
                                onClick={downloadZipFile}>
                                Download last recording
                            </Button>
                        </>
                    }
                </Col>
            </Row>
        </Container>
    )
}