import { socket } from '../lib/socket';
import {ChangeEventHandler, FormEventHandler, useEffect, useRef, useState } from "react"
import { Button, Col, Overlay } from 'react-bootstrap';
import Form from 'react-bootstrap/Form';

export default function CameraSettings() {
    const overlay = useRef();
    const [overlayVisible, setOverlayVisible] = useState(false);
    const [exposure, setExposure] = useState(100);
    const [gain, setGain] = useState(0);
    const target = useRef(null);
    const updateCameraSettings: FormEventHandler = (e) => {
        e.preventDefault()
        socket.emit("update-camera-settings", {
            exposure,
            gain,
        })
    }

    return <>
        <Button size="sm" className="me-3" variant="outline-secondary" ref={target} onClick={() => setOverlayVisible(!overlayVisible)}>⚙️ Camera Settings</Button>
        <Overlay target={target.current} show={overlayVisible} rootClose={true} onHide={() => setOverlayVisible(false)} placement="bottom">
            <div className="overlay">
                <Form onChange={updateCameraSettings} as={Col} className='ps-3'>
                    <Form.Group className="mb-1">
                        <Form.Label column>Exposure: {exposure}</Form.Label>
                        <Form.Range value={exposure} onChange={(event) => setExposure(parseFloat(event.target.value))} />
                    </Form.Group>
                    <Form.Group className="mb-1">
                        <Form.Label>Gain: {gain}</Form.Label>
                        <Form.Range value={gain} onChange={(event) => setGain(parseFloat(event.target.value))} />
                    </Form.Group>
                </Form>
            </div>
        </Overlay>
    </>
}