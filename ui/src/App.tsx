"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { socket } from './lib/socket';
import { defaultCameraPose, defaultWorldMatrix } from './defaultCameraPose';
import ConnectionManager from './components/ConnectionManager';
import WorldView from './components/WorldView';
import CameraView from './components/CameraView';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import { Modes } from './lib/modes';
import Configure from './components/Configure';
import Capture from './components/Capture';
import Logo from './components/Logo';
import ModeControlBar from './components/ModeControlBar';
import useSocketListener from './hooks/useSocketListener';

export const LS_POSE_KEY = "CAMERA_POSE";
export const LS_WORLD_KEY = "WORLD_MATRIX";

export default function App() {
  const [mocapMode, setMocapMode] = useState(Modes.ImageProcessing);
  const [hasCameraPose, setHasCameraPose] = useState(false);
  const [hasToWorldCoordsMatrix, setHasToWorldMatrix] = useState(false);
  const [parsedCapturedPointsForPose, setParsedCapturedPointsForPose] = useState<Array<Array<Array<number>>>>([]);


  const objectPoints = useRef<Array<Array<Array<number>>>>([])
  const filteredObjects = useRef<object[][]>([])
  const objectPointErrors = useRef<Array<Array<number>>>([])
  const [lastObjectPointTimestamp, setLastObjectPointTimestamp] = useState(0);

  const [cameraPoses, setCameraPoses] = useState<Array<object>>(() => {
    const savedPose = localStorage.getItem(LS_POSE_KEY)
    if (savedPose) {
      return JSON.parse(savedPose);
    }
    return defaultCameraPose
  });

  const [toWorldCoordsMatrix, setToWorldCoordsMatrix] = useState<number[][]>(() => {
    const saved = localStorage.getItem(LS_WORLD_KEY)
    if (saved) {
      return JSON.parse(saved);
    }
    return defaultWorldMatrix
  })

  useSocketListener("object-points",  (data) => {
    setLastObjectPointTimestamp(data["time_ms"])
  })

  useEffect(() => {
    socket.on("to-world-coords-matrix", (data) => {
      setToWorldCoordsMatrix(data["to_world_coords_matrix"])
    })

    return () => {
      socket.off("to-world-coords-matrix")
    }
  }, [])

  useEffect(() => {
    socket.on("camera-pose", data => {
      setHasCameraPose(true)
      setCameraPoses(data["camera_poses"])
    })

    return () => {
      socket.off("camera-pose")
    }
  }, [])

  // TODO - Update exposure here too
  const stateUpdater = useCallback((data) => {
    setMocapMode(data.mode)
    if (!data.camera_poses) {
      setHasCameraPose(false)
      socket.emit("set-camera-poses", {cameraPoses})
    } else {
      setHasCameraPose(true)
      setCameraPoses(data.camera_poses)
    }
    if (!data.to_world_coords_matrix) {
      setHasToWorldMatrix(false)
      socket.emit("set-to-world-matrix", {toWorldCoordsMatrix})
    } else {
      setHasToWorldMatrix(true)
      setToWorldCoordsMatrix(data.to_world_coords_matrix)
    }
  }, [cameraPoses, toWorldCoordsMatrix]);

  return (
    <Container fluid>
      <Logo />
      <ConnectionManager updateState={stateUpdater} />
      <ModeControlBar mocapMode={mocapMode} setMocapMode={setMocapMode} />
      <Row>
        <Col>
            <Tabs
              defaultActiveKey="cameraView"
              id="uncontrolled-tab-example"
            > 
              <Tab eventKey="cameraView" title="🎥 Camera Feed">
                <CameraView
                    mocapMode={mocapMode}
                    parsedCapturedPointsForPose={parsedCapturedPointsForPose}
                  />
              </Tab>
              <Tab eventKey="worldView" title="🌎 World View">
                <WorldView
                  cameraPoses={cameraPoses} 
                  toWorldCoordsMatrix={toWorldCoordsMatrix}
                  objectPoints={objectPoints}
                  objectPointErrors={objectPointErrors}
                  objectPointCount={lastObjectPointTimestamp}
                  filteredObjects={filteredObjects}
                />
              </Tab>
            </Tabs>
          <div style={{height: "30px"}}></div>
            <Tabs
              defaultActiveKey="capture"
              id="uncontrolled-tab-example"
            > 
              <Tab eventKey="capture" title="⏺ Capture">
                  <Capture mocapMode={mocapMode} objectPoints={objectPoints} objectPointErrors={objectPointErrors} lastObjectPointTimestamp={lastObjectPointTimestamp} />
              </Tab>
              <Tab eventKey="configure" title="⚙️ Configure">
                <Configure 
                  mocapMode={mocapMode}
                  cameraPoses={cameraPoses}
                  toWorldCoordsMatrix={toWorldCoordsMatrix}
                  objectPoints={objectPoints}
                  lastObjectPointTimestamp={lastObjectPointTimestamp}
                  setCameraPoses={setCameraPoses}
                  setToWorldCoordsMatrix={setToWorldCoordsMatrix}
                  setParsedCapturedPointsForPose={setParsedCapturedPointsForPose}
                  setLastObjectPointTimestamp={setLastObjectPointTimestamp}
                />
              </Tab>
            </Tabs>
          <div style={{height: "30px"}}></div>
        </Col>
      </Row>
    </Container>
  )
}
