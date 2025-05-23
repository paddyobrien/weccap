import { Button, Col, Container, Form, Row } from "react-bootstrap";
import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { Modes } from "../lib/modes";
import { socket } from "../lib/socket";
import SmallHeader from "./SmallHeader";
import InfoTooltip from "./InfoTooltip";

import { createZipFile } from "../lib/download";

interface Props {
    mocapMode: Modes,
    objectPoints: MutableRefObject<number[][][]>
    objectPointErrors: any,
    lastObjectPointTimestamp: any,
}


export default function Capture({mocapMode, objectPoints, objectPointErrors, lastObjectPointTimestamp}: Props) {
    const [currentCaptureName, setCurrentCaptureName] = useState("");
    const objectPointTimes = useRef<Array<Array<Array<number>>>>([]);
    const imagePoints = useRef<Array<Array<number>>>([])
    const [isRecording, setIsRecording] = useState(false);

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
            imagePoints.current
        )
    }, [currentCaptureName])

    const stopRecording = useCallback(() => {
        createZipFile(
            currentCaptureName, 
            objectPointTimes.current, 
            objectPoints.current, 
            objectPointErrors.current, 
            imagePoints.current
        )
        setIsRecording(false)
    }, [currentCaptureName, isRecording])

    return (
        <Container fluid={true} className="pb-2 shadow-md container-card">
            <Row>
                <Col>
                    <SmallHeader>Recording Name</SmallHeader>
                    <Form.Control
                        value={currentCaptureName}
                        onChange={(event) => setCurrentCaptureName(event.target.value)}
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