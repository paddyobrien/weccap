import useSocketListener from "../hooks/useSocketListener";
import Toast from 'react-bootstrap/Toast';
import { ToastContainer } from 'react-bootstrap';
import { useState } from "react";


export default function ErrorComponent() {
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    useSocketListener("error", (data) => {
        setErrorMessage(data);
        setHasError(true);
    })
    return (
        <ToastContainer position="bottom-center">
            <Toast bg="error" show={hasError} onClose={() => setHasError(false)}>
                <Toast.Header>
                    <img src="holder.js/20x20?text=%20" className="rounded me-2" alt="" />
                    <strong className="me-auto">Error</strong>
                </Toast.Header>
                <Toast.Body>{errorMessage}</Toast.Body>
            </Toast>
        </ToastContainer>
    )
}