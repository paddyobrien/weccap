import { socket } from '../lib/socket';
import {FormEventHandler, useCallback, useRef, useState } from "react"
import { Button, Col, Overlay } from 'react-bootstrap';
import Form from 'react-bootstrap/Form';

export default function CameraSettings() {
    const [overlayVisible, setOverlayVisible] = useState(false);
    const [exposure, setExposure] = useState(100);
    const [gain, setGain] = useState(0);
    const [sharpness, setSharpness] = useState(0);
    const [contrast, setContrast]= useState(0);
    const [contourThreshold, setContourThreshold] = useState(40);
    const target = useRef(null);

    const updateCameraSettings: FormEventHandler = useCallback((e) => {
        e.preventDefault()
        socket.emit("update-camera-settings", {
            exposure,
            gain,
            sharpness,
            contrast
        })
    }, [exposure, gain, sharpness, contrast]);

    const updatePointCaptureSettings: FormEventHandler = useCallback((e) => {
        e.preventDefault()
        socket.emit("update-point-capture-settings", {
            contourThreshold: contourThreshold/100
        })
    }, [contourThreshold]);

    return <>
        <Button size="sm" className="me-3" variant="outline-secondary" ref={target} onClick={() => setOverlayVisible(!overlayVisible)}>⚙️ Camera Settings</Button>
        <Overlay target={target.current} show={overlayVisible} rootClose={true} onHide={() => setOverlayVisible(false)} placement="bottom">
            <div className="overlay">
                <Form onChange={updateCameraSettings} as={Col} className='ps-3'>
                    <Form.Group className="mb-1">
                        <Form.Label column>Exposure: {exposure}</Form.Label>
                        <Form.Range value={exposure} min={0} max={255} onChange={(event) => setExposure(parseFloat(event.target.value))} />
                    </Form.Group>
                    <Form.Group className="mb-1">
                        <Form.Label>Gain: {gain}</Form.Label>
                        <Form.Range value={gain} min={0} max={63} onChange={(event) => setGain(parseFloat(event.target.value))} />
                    </Form.Group>
                    <Form.Group className="mb-1">
                        <Form.Label>Sharpness: {sharpness}</Form.Label>
                        <Form.Range value={sharpness} min={0} max={63} onChange={(event) => setSharpness(parseFloat(event.target.value))} />
                    </Form.Group>
                    <Form.Group className="mb-1">
                        <Form.Label>Contrast: {contrast}</Form.Label>
                        <Form.Range value={contrast} min={0} max={255} onChange={(event) => setContrast(parseFloat(event.target.value))} />
                    </Form.Group>
                    
                </Form>
                <Form onChange={updatePointCaptureSettings} as={Col} className='ps-3'>
                <hr />
                    <Form.Group className="mb-1">
                        <Form.Label>Contour Threshold: {contourThreshold}</Form.Label>
                        <Form.Range value={contourThreshold} min={1} max={100} onChange={(event) => setContourThreshold(parseFloat(event.target.value))} />
                    </Form.Group>
                </Form>
            </div>
        </Overlay>
    </>
}