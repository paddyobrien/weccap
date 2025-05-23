import { MutableRefObject, useEffect, useState } from "react"
import { Button, Col, Container, Row } from "react-bootstrap"
import InfoTooltip from "./InfoTooltip"
import { socket } from "../lib/socket"
import { Modes } from "../lib/modes"
import useSocketListener from "../hooks/useSocketListener"

interface Props {
    mocapMode: Modes,
    cameraPoses: any,
    toWorldCoordsMatrix: any,
    objectPoints: MutableRefObject<number[][][]>,
}

export default function OriginCalibration({mocapMode, toWorldCoordsMatrix}: Props) {
    const [captureNextPoint, setCaptureNextPoint] = useState(false)
    useSocketListener("object-points", (data) => {
        if (captureNextPoint) {
            socket.emit("set-origin", { objectPoint: data["object_points"][0], toWorldCoordsMatrix })
            setCaptureNextPoint(false)
        }
    })
   
    const objectPointsEnabled = mocapMode >= Modes.Triangulation
    return (
        <Container fluid={true} className="container-card">
            <Row className="pt-2">
                <Col>
                <InfoTooltip disabled={objectPointsEnabled} message="Enable triangulation to set origin">
                    <Button
                        size='sm'
                        variant="outline-primary"
                        className="mr-2"
                        disabled={!objectPointsEnabled}
                        onClick={() => {
                            setCaptureNextPoint(true);
                        }
                    }>
                        Set origin
                    </Button>
                </InfoTooltip>
                </Col>
            </Row>
            <Row>
                <Col>
                <details>
                    <summary>Calibration procedure</summary>
                    <p>Use this procedure to set the world origin.</p>
                    <ol>
                        <li>Turn on <em>one</em> light on the tracker object.</li>
                        <li>Enable <em>Triangulation</em></li>
                        <li>Place the object wherever you would like the origin to be.</li>
                        <li>Click <em>Set origin</em></li>
                    </ol>
                </details>
                </Col>
            </Row>
            <Row>
                <Col>
                
                </Col>
            </Row>
        </Container>
    )
}