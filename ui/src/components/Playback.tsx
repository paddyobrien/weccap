import { useCallback, useEffect, useRef, useState } from "react"
import { Button, Col, Container, Row } from "react-bootstrap"
import PosePoints from "./PosePoints";

interface Props {
    isRecording: boolean,
}

enum Modes {
    INIT = 0,
    IMAGE_POINTS = 1,
    INVALID_FILE = 100
}

const IMAGE_POINTS_FILE_NAME = 'image_points.jsonl'

const WIDTH = 320;

export default function Playback({ isRecording }: Props) {
    const [mode, setMode] = useState<Modes>(Modes.INIT);
    const [imagePoints, setImagePoints] = useState([]);
    const [timestamps, setTimestamps] = useState([]);
    const fileInputRef = useRef(null);
    const canvasRef = useRef(null);
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
            setImagePoints(JSON.parse(lines[1]))
            console.log(JSON.parse(lines[1]))
        } else {
            setMode(Modes.INVALID_FILE)
        }
        event.target.value = ""
    }, [setImagePoints])

    const triggerUpload = useCallback(() => {
        fileInputRef.current?.click()
    }, [])

    useEffect(() => {
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
        imagePoints.forEach((timeStep) => {
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
      }, [imagePoints])

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
                            <div style={{background: "black"}}>
                                <canvas ref={canvasRef} width={4 * WIDTH} height={WIDTH}/>
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