import { socket } from "./socket";
import { Modes } from "./modes";

export default function changeMode(newState: Modes) {
    socket.emit("change-mocap-mode", newState)
}