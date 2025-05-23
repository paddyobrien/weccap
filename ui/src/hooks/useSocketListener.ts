import { useEffect } from "react"
import { socket } from "../lib/socket"

interface Props {
    eventName: string,
    handler: () => void
}

export default function useSocketListener(eventName, handler) {
    useEffect(() => {
        socket.on(eventName, handler)

        return () => {
            socket.off(eventName, handler)
        }
    }, [handler, eventName])
}