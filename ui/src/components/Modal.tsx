import { Variant } from 'react-bootstrap/esm/types';
import Toast from 'react-bootstrap/Toast';

interface Props {
    headerText: string,
    bodyText: string,
    dismissible?: boolean,
    variant?: Variant
}

export default function Modal({headerText, bodyText, variant="danger", dismissible=false}:Props) {
    return (
        <>
            <div style={{
                zIndex: 200,
                position: "fixed",
                left: 0,
                width: "100%",
                top: 0,
                height: "100%",
                backgroundColor: "black",
                opacity: 0.5
            }} />
            <Toast bg={variant} show={true} style={{
                position: "fixed",
                zIndex: 300,
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)"
            }}>
                <Toast.Header closeButton={dismissible}>
                    <strong className="me-auto">{headerText}</strong>
                </Toast.Header>
                <Toast.Body>
                    {bodyText}
                </Toast.Body>
            </Toast>
        </>
    );
}