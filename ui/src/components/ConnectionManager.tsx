import { useState, useEffect } from 'react';
import { socket } from '../lib/socket';
import Modal from './Modal';
import { Modes } from '../lib/modes';

async function getState() {
    const url = "http://localhost:3001/api/camera_state";
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
      }
  
      const json = await response.json();
      return json;
    } catch (error) {
      console.error(error.message);
    }
  }

export default function ConnectionManager({updateState}:{updateState: (s: Modes) => void}) {
    const [isConnected, setIsConnected] = useState(socket.active);
    useEffect(() => {
        const f = () => {
            console.log("disconnect")
            setIsConnected(false)
        };
        socket.on("disconnect", f) 
        return () => {
            console.log("exit disconnect")
            socket.off("disconnect", f)
        }
    }, [])

    useEffect(() => {
        const f = async () => {
            console.log("connect")
            setIsConnected(true);
            const json = await getState();
            updateState(json);
        }
        socket.on("connect", f);
        return () => {
            console.log("exit connect")
            socket.off("connect", f)
        }
    }, [])

    useEffect(() => {
        const f = async () => {
            const json = await getState();
            updateState(json);
        }
        f()
    }, [])

    if (isConnected) {
        return <></>
    }

    return (
        <Modal headerText="Connection Error" bodyText="Cannot connect to backend, please (re)start the python server." />
    );
}