import { PropsWithChildren, useId } from "react";
import { Tooltip } from "react-tooltip";

interface Props {
    disabled: boolean,
    message: string
}

export default function InfoTooltip({disabled, message, children}: PropsWithChildren<Props>) {
    const id = useId();
    const ttId = `tt-${id}`;
    return (
        <>
        <a 
            data-tooltip-hidden={disabled}
            data-tooltip-variant='dark' 
            data-tooltip-id={ttId}
            data-tooltip-content={message}>{children}
        </a>
        <Tooltip id={ttId} />
        </>
    )
}