import { Button } from "react-bootstrap"
import { Modes } from "../lib/modes"
import changeMode from "../lib/changeMode";
import useSocketListener from "../hooks/useSocketListener";
import Toast from 'react-bootstrap/Toast';
import { ToastContainer } from 'react-bootstrap';
import { useState } from "react";

interface Props {
    mocapMode: Modes
    setMocapMode: (s: Modes) => void
}

export default function ModeControlBar({mocapMode, setMocapMode} : Props) {
    const processingEnabled = mocapMode >= Modes.ImageProcessing;
    const pointCaptureEnabled = mocapMode >= Modes.PointCapture;
    const triangulationEnabled = mocapMode >= Modes.Triangulation;
    
    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
  
    const toggleShowError = () => setShowError(!showError);

    useSocketListener("mode-change", setMocapMode);
    useSocketListener("mode-change-failure", setErrorMessage)

    return (
        <>
            <div className="mode-control-bar shadow-md">
                <Button
                    size="sm"
                    className="mr-2"
                    variant="outline-secondary"
                    disabled={mocapMode > Modes.ImageProcessing}
                    onClick={() => changeMode(mocapMode === Modes.CamerasFound ? Modes.ImageProcessing : Modes.CamerasFound)}
                >{processingEnabled ? "✅ Image processing": "🎆 Enable image processing"}</Button>
                <Button
                    size="sm"
                    className="mr-2"
                    variant="outline-secondary"
                    disabled={mocapMode < Modes.ImageProcessing || mocapMode > Modes.PointCapture}
                    onClick={() => changeMode(mocapMode === Modes.PointCapture ? Modes.ImageProcessing : Modes.PointCapture)}
                >{pointCaptureEnabled ? "✅ Capturing points": "👉 Enable point capture"}</Button>
                <Button
                    size="sm"
                    className="mr-2"
                    variant="outline-secondary"
                    disabled={mocapMode < Modes.PointCapture || mocapMode > Modes.Triangulation}
                    onClick={() => changeMode(mocapMode === Modes.PointCapture ? Modes.Triangulation : Modes.PointCapture)}
                >{triangulationEnabled ? "✅ Triangulating": "◢ Enable Triangulation"}</Button>
            </div>
        
            <ToastContainer position="bottom-center">
                <Toast show={showError} onClose={toggleShowError}>
                    <Toast.Header>
                        <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
                        <strong className="me-auto">Mode change failed</strong>
                    </Toast.Header>
                    <Toast.Body>{errorMessage}</Toast.Body>
                </Toast>
            </ToastContainer>
        </>
    )
}