import { Button, Col, Container, Form, Row, Tab, Tabs } from "react-bootstrap"
import CameraPoseCalibration from "./CameraPoseCalibration"
import { socket } from "../lib/socket"
import { Modes } from "../lib/modes"
import { MutableRefObject, useCallback, useRef, useState } from "react"
import SmallHeader from "./SmallHeader"
import ScaleCalibration from "./ScaleCalibration"
import AlignmentCalibration from "./AlignmentCalibration"
import OriginCalibration from "./OriginCalibration"
import { LS_DISTC_KEY, LS_INTRINSIC_KEY, LS_POSE_KEY, LS_WORLD_KEY } from "../App"

interface Props {
    mocapMode: Modes,
    cameraPoses: any,
    toWorldCoordsMatrix: any,
    intrinsicMatrices: any,
    distortionCoefs: any,
    objectPoints: MutableRefObject<number[][][]>,
    lastObjectPointTimestamp: number,
    setCameraPoses: (s: any) => void,
    setToWorldCoordsMatrix: (s: any) => void
    setIntrinsicMatrices: (s: any) => void
    setDistortionCoefs: (s: any) => void
    setParsedCapturedPointsForPose: (s: Array<Array<Array<number>>>) => void
    setReprojectedPoints: (s: Array<Array<Array<number>>>) => void
    setLastObjectPointTimestamp: (s: any) => void
}

export default function Configure({
    mocapMode,
    cameraPoses,
    toWorldCoordsMatrix,
    intrinsicMatrices,
    distortionCoefs,
    objectPoints,
    lastObjectPointTimestamp,
    setCameraPoses,
    setToWorldCoordsMatrix,
    setIntrinsicMatrices,
    setDistortionCoefs,
    setParsedCapturedPointsForPose,
    setReprojectedPoints,
    setLastObjectPointTimestamp
}: Props) {
    const [isSaved, setIsSaved] = useState(false)
    const saveCameraPoses = useCallback(() => {
        socket.emit("set-camera-poses", {cameraPoses})
        localStorage.setItem(LS_POSE_KEY, JSON.stringify(cameraPoses))
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000)
    }, [cameraPoses])

    const [isLoaded, setIsLoaded] = useState(false)
    const loadCameraPoses = useCallback(() => {
        const savedPoses = localStorage.getItem(LS_POSE_KEY);
        if (savedPoses) {
            const cameraPoses = JSON.parse(savedPoses);
            setCameraPoses(cameraPoses);
            socket.emit("set-camera-poses", {cameraPoses})
            setIsLoaded(true);
            setTimeout(() => setIsLoaded(false), 2000)
        }
    }, [cameraPoses])

    const [isSavedWorld, setIsSavedWorld] = useState(false)
    const saveWorldMatrix = useCallback(() => {
        socket.emit("set-to-world-matrix", {toWorldCoordsMatrix})
        localStorage.setItem(LS_WORLD_KEY, JSON.stringify(toWorldCoordsMatrix))
        setIsSavedWorld(true);
        setTimeout(() => setIsSavedWorld(false), 2000)
    }, [toWorldCoordsMatrix])

    const [isLoadedMatrix, setLoadedMatrix] = useState(false)
    const loadWorldMatrix = useCallback(() => {
        const saved = localStorage.getItem(LS_WORLD_KEY);
        if (saved) {
            const toWorldCoordsMatrix = JSON.parse(saved);
            setToWorldCoordsMatrix(toWorldCoordsMatrix);
            socket.emit("set-to-world-matrix", {toWorldCoordsMatrix})
            setLoadedMatrix(true);
            setTimeout(() => setLoadedMatrix(false), 2000)
        }
    }, [toWorldCoordsMatrix])

    const [isSavedIntrinsics, setIsSavedIntrinsics] = useState(false)
    const saveIntrinsicMatrices = useCallback(() => {
        socket.emit("set-intrinsic-matrices", {intrinsicMatrices})
        localStorage.setItem(LS_INTRINSIC_KEY, JSON.stringify(intrinsicMatrices))
        setIsSavedIntrinsics(true);
        setTimeout(() => setIsSavedIntrinsics(false), 2000)
    }, [intrinsicMatrices])

    const [isLoadedIntrinsics, setLoadedIntrinsics] = useState(false)
    const loadIntrinsicMatrices = useCallback(() => {
        const saved = localStorage.getItem(LS_INTRINSIC_KEY);
        if (saved) {
            const intrinsicMatrices = JSON.parse(saved);
            setIntrinsicMatrices(intrinsicMatrices);
            socket.emit("set-intrinsic-matrices", {intrinsicMatrices})
            setLoadedIntrinsics(true);
            setTimeout(() => setLoadedIntrinsics(false), 2000)
        }
    }, [intrinsicMatrices])

    const [isSavedDistCoefs, setIsSavedDistCoefs] = useState(false)
    const saveDistortionCoefs = useCallback(() => {
        socket.emit("set-distortion-coefs", {distortionCoefs})
        localStorage.setItem(LS_DISTC_KEY, JSON.stringify(distortionCoefs))
        setIsSavedDistCoefs(true);
        setTimeout(() => setIsSavedDistCoefs(false), 2000)
    }, [distortionCoefs])

    const [isLoadedDistCoefs, setLoadedDistCoefs] = useState(false)
    const loadDistortionCoefs = useCallback(() => {
        const saved = localStorage.getItem(LS_DISTC_KEY);
        if (saved) {
            const distortionCoefs = JSON.parse(saved);
            setDistortionCoefs(distortionCoefs);
            socket.emit("set-distortion-coefs", {distortionCoefs})
            setLoadedDistCoefs(true);
            setTimeout(() => setLoadedDistCoefs(false), 2000)
        }
    }, [distortionCoefs])
    
    return (
        <Container fluid={true} className="p-2 shadow-md container-card">
            
            <Row>
                <Col>
                    <Tabs
                        defaultActiveKey="pose"
                        id="uncontrolled-tab-example"
                    >
                        <Tab eventKey="pose" title="📍Calibrate pose">
                            <CameraPoseCalibration 
                                mocapMode={mocapMode}
                                cameraPoses={cameraPoses}
                                setParsedCapturedPointsForPose={setParsedCapturedPointsForPose} 
                                setReprojectedPoints={setReprojectedPoints}
                            />
                        </Tab>
                        <Tab eventKey="scale" title="📏 Set scale">
                            <ScaleCalibration 
                                mocapMode={mocapMode}
                                cameraPoses={cameraPoses}
                                objectPoints={objectPoints}
                                lastObjectPointTimestamp={lastObjectPointTimestamp}
                                setLastObjectPointTimestamp={setLastObjectPointTimestamp}
                                setCameraPoses={setCameraPoses}
                            />
                        </Tab>
                        <Tab eventKey="align" title="→ Align">
                            <AlignmentCalibration
                                mocapMode={mocapMode}
                                cameraPoses={cameraPoses}
                                toWorldCoordsMatrix={toWorldCoordsMatrix}
                                objectPoints={objectPoints}
                                lastObjectPointTimestamp={lastObjectPointTimestamp}
                                setLastObjectPointTimestamp={setLastObjectPointTimestamp}
                            />
                        </Tab>
                        <Tab eventKey="origin" title="Ｘ Set origin">
                            <OriginCalibration 
                                mocapMode={mocapMode}
                                cameraPoses={cameraPoses}
                                toWorldCoordsMatrix={toWorldCoordsMatrix}
                                objectPoints={objectPoints}
                            />
                        </Tab>
                        <Tab eventKey="current" title="📄 Current Config">
                            <Container fluid={true} className="pb-4 container-card">
                                <Row>
                                    <Col>
                                        <SmallHeader>Current camera pose</SmallHeader>
                                        <Form.Control
                                            as="textarea" rows={3}
                                            value={JSON.stringify(cameraPoses)}
                                            onChange={(event) => setCameraPoses(JSON.parse(event.target.value))}
                                        />
                                        <Button className="mt-2 mr-2" variant="outline-primary" onClick={saveCameraPoses}>Save</Button>
                                        <Button className="mt-2 mr-2" variant="outline-primary" onClick={loadCameraPoses}>Load</Button>
                                        <span>{isSaved && "Poses saved!"}</span>
                                        <span>{isLoaded && "Poses loaded"}</span>
                                    </Col>
                                </Row>
                                <Row className="mb-4">
                                    <Col xs={4} className='pt-2'>
                                        <SmallHeader>Current Intrinsic Matrices:</SmallHeader>
                                        <Form.Control
                                            as="textarea" rows={3}
                                            value={JSON.stringify(intrinsicMatrices)}
                                            onChange={(event) => setIntrinsicMatrices(JSON.parse(event.target.value))}
                                        />
                                        <Button className="mt-2" variant="outline-primary" onClick={saveIntrinsicMatrices}>Save</Button>
                                        <Button className="mt-2 mr-2" variant="outline-primary" onClick={loadIntrinsicMatrices}>Load</Button>
                                        <span>{isSavedIntrinsics && "Intrinsic matrices saved!"}</span>
                                        <span>{isLoadedIntrinsics && "Intrinsic matrices loaded!"}</span>
                                    </Col>
                                </Row>
                                <Row className="mb-4">
                                    <Col xs={4} className='pt-2'>
                                        <SmallHeader>Current Distortion Coefficients:</SmallHeader>
                                        <Form.Control
                                            as="textarea" rows={3}
                                            value={JSON.stringify(distortionCoefs)}
                                            onChange={(event) => {
                                                const distortionCoefs = JSON.parse(event.target.value);
                                                setDistortionCoefs(distortionCoefs);
                                                socket.emit("set-distortion-coefs", {distortionCoefs})
                                            }}
                                        />
                                        <Button className="mt-2" variant="outline-primary" onClick={saveDistortionCoefs}>Save</Button>
                                        <Button className="mt-2 mr-2" variant="outline-primary" onClick={loadDistortionCoefs}>Load</Button>
                                        <span>{isSavedDistCoefs && "Distortion coefficients saved!"}</span>
                                        <span>{isLoadedDistCoefs && "Distortion coefficients loaded!"}</span>
                                    </Col>
                                </Row>
                                <Row className="mb-4">
                                    <Col xs={4} className='pt-2'>
                                        <SmallHeader>Current To World Matrix:</SmallHeader>
                                        <Form.Control
                                            as="textarea" rows={3}
                                            value={JSON.stringify(toWorldCoordsMatrix)}
                                            onChange={(event) => setToWorldCoordsMatrix(JSON.parse(event.target.value))}
                                        />
                                        <Button className="mt-2" variant="outline-primary" onClick={saveWorldMatrix}>Save</Button>
                                        <Button className="mt-2 mr-2" variant="outline-primary" onClick={loadWorldMatrix}>Load</Button>
                                        <span>{isSavedWorld && "World matrix saved!"}</span>
                                        <span>{isLoadedMatrix && "World matrix loaded!"}</span>
                                    </Col>
                                </Row>
                            </Container>
                        </Tab>
                    </Tabs>
                </Col>
            </Row>
        </Container>
    )
}