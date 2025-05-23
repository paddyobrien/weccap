import { MutableRefObject, useEffect, useState } from "react"
import { Button, Col, Container, Row } from "react-bootstrap"
import InfoTooltip from "./InfoTooltip"
import { socket } from "../lib/socket"
import { Modes } from "../lib/modes"
import SmallHeader from "./SmallHeader"

interface Props {
    mocapMode: Modes,
    cameraPoses: any,
    toWorldCoordsMatrix: any,
    objectPoints: MutableRefObject<number[][][]>,
}

export default function AlignmentCalibration({mocapMode, cameraPoses, toWorldCoordsMatrix, objectPoints}: Props) {
    const [captureNextPoint, setCaptureNextPoint] = useState(false)
    useEffect(() => {
        socket.on("object-points", (data) => {
            if (captureNextPoint) {
                objectPoints.current.push(data["object_points"])
                setCaptureNextPoint(false);
            }
        })
    
        return () => {
          socket.off("object-points")
        }
      }, [captureNextPoint])
    const objectPointsEnabled = mocapMode >= Modes.Triangulation
    const countOfPoints = objectPoints.current.length
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
                <details>
                    <summary>Calibration procedure</summary>
                    <p>Use this procedure to set the scale of the world so that distances are valid.</p>
                    <ol>
                        <li>Turn on <em>both</em> lights on the tracker object.</li>
                        <li>Enable <em>Triangulation</em></li>
                        <li>Place the object on the <em>floor</em> of your scene where it can be seen by multiple cameras.</li>
                        <li>Press the <em>Record point</em> button.</li>
                        <li>Move the tracker to another location on the floor and record another point.</li>
                        <li>Once several points on the floor have been recorded, click on <em>Set scale</em></li>
                    </ol>
                </details>
                </Col>
            </Row>
            <Row>
                <Col>
                    <Button
                        size='sm'
                        className="mr-2"
                        variant="outline-primary"
                        disabled={countOfPoints == 0}
                        onClick={() => {
                            socket.emit("acquire-floor", { objectPoints: objectPoints.current, cameraPoses, toWorldCoordsMatrix })
                        }
                    }>
                        Align world
                    </Button>
                </Col>
            </Row>
        </Container>
    )
}