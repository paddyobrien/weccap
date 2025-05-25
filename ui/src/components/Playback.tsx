import { useCallback, useEffect, useRef, useState } from "react"
import { Button, Col, Container, Form, Row } from "react-bootstrap"
import PosePoints from "./PosePoints";
import { bundleAdjustment } from "../lib/api";

interface Props {
    isRecording: boolean,
    cameraPoses: any,
}

enum Modes {
    INIT = 0,
    IMAGE_POINTS = 1,
    INVALID_FILE = 100
}

const IMAGE_POINTS_FILE_NAME = 'image_points.jsonl'

const WIDTH = 320;

export default function Playback({ isRecording, cameraPoses }: Props) {
    const [mode, setMode] = useState<Modes>(Modes.INIT);
    const [startIndex, setStartIndex] = useState<number>(0);
    const [endIndex, setEndIndex] = useState<number>(0);
    const [removeExtraPoints, setRemoveExtraPoints] = useState<boolean>(false);
    const [currentImageStep, setCurrentImageStep]= useState(0);
    const [imagePoints, setImagePoints] = useState([]);
    const [filteredImagePoints, setFilteredImagePoints] = useState([]);
    const [timestamps, setTimestamps] = useState([]);
    const fileInputRef = useRef(null);
    const canvasRef = useRef(null);
    const canvasRef2 = useRef(null);
    const readFile = useCallback(async (event) => {
        const file = event.target.files.item(0)
        const text = await file.text();
        if (file.name === IMAGE_POINTS_FILE_NAME) {
            setMode(Modes.IMAGE_POINTS)
            const lines = text.split("\n")
            if (lines.length > 2) {
                console.error("More than two lines in image points file")
            }
            setTimestamps(JSON.parse(lines[0]))
            const imagePoints = JSON.parse(lines[1])
            setImagePoints(imagePoints)
            setStartIndex(0);
            setEndIndex(imagePoints.length);
        } else {
            setMode(Modes.INVALID_FILE)
        }
        event.target.value = ""
    }, [setImagePoints])

    const triggerUpload = useCallback(() => {
        fileInputRef.current?.click()
    }, [])

    const filterPoints = useEffect(() => {
        let filtered = JSON.parse(JSON.stringify(imagePoints));
        filtered = filtered.slice(startIndex, endIndex)
        if (removeExtraPoints) {
            filtered.forEach((timeStep, index) => {
                timeStep.forEach((camera, index) => {
                    delete camera[2]
                })
            })
        }
        console.log(filtered)
        setFilteredImagePoints(filtered)
    }, [imagePoints, startIndex, endIndex, removeExtraPoints, removeExtraPoints])

    const drawDots = useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }
        const context = canvas.getContext('2d')!;
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.fillStyle =  "#FFFFFF";
        context.fillRect(WIDTH, 0, 1, canvas.height)
        context.fillRect(WIDTH * 2, 0, 1, canvas.height)
        context.fillRect(WIDTH * 3, 0, 1, canvas.height)
        filteredImagePoints.forEach((timeStep) => {
            timeStep.forEach((camera, index) => {
                const offset = index * WIDTH;
                camera.forEach((point, index) => {
                    if (index == 0) {
                        context.fillStyle = "#0000FF";
                    } else if (index ==1){
                        context.fillStyle = "#00FF00";  
                    } else {
                        context.fillStyle = "#FF0000";
                    }
                    context.fillRect(point[0] + offset - 1, point[1] - 1, 4, 4);
                })
            })
        });
      }, [filteredImagePoints])

    const drawCurrentDot = useEffect(() => {
        const canvas = canvasRef2.current;
        if (!canvas) {
            return;
        }
        const context = canvas.getContext('2d')!;
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.fillStyle =  "#FFFF00";
        const timeStep = imagePoints[currentImageStep];
        timeStep?.forEach((camera, index) => {
            const offset = index * WIDTH;
            camera.forEach((point, index) => {
                context.fillRect(point[0] + offset - 1, point[1] - 1, 4, 4);
            })
        })
    }, [currentImageStep])

    const calculateBundleAdjustment = useCallback(async () => {
        const points = []
        filteredImagePoints.forEach((timeStep, index) => {
            if (timeStep[0][0] && timeStep[1][0] && timeStep[2][0] && timeStep[3][0])
                points.push([timeStep[0][0], timeStep[1][0], timeStep[2][0], timeStep[3][0]])
            if (timeStep[0][1] && timeStep[1][1] && timeStep[2][1] && timeStep[3][1])
            points.push([timeStep[0][1], timeStep[1][1], timeStep[2][1], timeStep[3][1]])
        })
        console.log(points);
        const response = await bundleAdjustment(points, cameraPoses)
        console.log(response);
    }, [filteredImagePoints])


    if (isRecording) {
        return <div>Unavailable while recording</div>
    }
    return (
        <Container fluid={true} className="p-2 shadow-md container-card">
            <Row>
                <Col>
                    <Button size='sm' variant="outline-primary" onClick={triggerUpload}>Pick a file</Button>
                    <input ref={fileInputRef} type="file" onChange={readFile} style={{display:'none'}}/>
                </Col>
            </Row>
            <Row>
                <Col>
                    {mode === Modes.IMAGE_POINTS && 
                        <>
                            <h4>Image point viewer</h4>
                            <Form.Range value={currentImageStep} min={0} max={imagePoints?.length} onChange={(event) => setCurrentImageStep(parseFloat(event.target.value))} />
                            <Button size="sm" variant="outline-secondary" onClick={() => setStartIndex(currentImageStep)}>Set Start</Button>
                            <Button size="sm" variant="outline-secondary" onClick={() => setEndIndex(currentImageStep)}>Set End</Button>
                            <Button size="sm" variant="outline-secondary" onClick={() => setRemoveExtraPoints(!removeExtraPoints)}>{removeExtraPoints ? "Include extra points" : "Remove extra points"}</Button>
                            <div style={{background: "black", position: "relative"}}>
                                <canvas ref={canvasRef} width={4 * WIDTH} height={WIDTH}/>
                                <canvas ref={canvasRef2} style={{position: "absolute", left: 0}} width={4 * WIDTH} height={WIDTH}/>
                            </div>
                            <div>
                                <Button size="sm" variant="outline-secondary" onClick={() => calculateBundleAdjustment()}>Generate New Pose</Button>
                            </div>
                        </>
                    }
                    {mode === Modes.INVALID_FILE && 
                    
                        <h4>Unknown file type</h4>
                    }
                </Col>
            </Row>
        </Container>
    )
}