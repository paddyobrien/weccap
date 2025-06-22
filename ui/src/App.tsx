"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import { socket } from './lib/socket';
import { defaultCameraPose, defaultWorldMatrix, defaultIntrinsics, defaultDistC } from './defaultCameraPose';
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
import Playback from './components/Playback';

export const LS_POSE_KEY = "CAMERA_POSE";
export const LS_WORLD_KEY = "WORLD_MATRIX";
export const LS_INTRINSIC_KEY = "CAMERA_INTRINSICS";
export const LS_DISTC_KEY = "DISTC";

export default function App() {
  const [mocapMode, setMocapMode] = useState(Modes.ImageProcessing);
  const [hasCameraPose, setHasCameraPose] = useState(false);
  const [hasToWorldCoordsMatrix, setHasToWorldMatrix] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [parsedCapturedPointsForPose, setParsedCapturedPointsForPose] = useState<Array<Array<Array<number>>>>([]);
  const [reprojectedPoints, setReprojectedPoints] = useState<Array<Array<Array<number>>>>([])

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

  const [intrinsicMatrices, setIntrinsicMatrices] = useState<Array<object>>(() => {
    const saved = localStorage.getItem(LS_INTRINSIC_KEY)
    if (saved) {
      return JSON.parse(saved);
    }
    return defaultIntrinsics
  });

  const [distortionCoefs, setDistortionCoefs] = useState<Array<object>>(() => {
    const saved = localStorage.getItem(LS_DISTC_KEY)
    if (saved) {
      return JSON.parse(saved);
    }
    return defaultDistC
  });

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
      setIntrinsicMatrices(data["intrinsic_matrices"])
      setDistortionCoefs(data["distortion_coefs"])
      if (data["reprojected"]) {
        setReprojectedPoints(data["reprojected"])
      }
    })

    return () => {
      socket.off("camera-pose")
    }
  }, [])

  // TODO - Update camera settings here, requires pulling camera settings up to this level
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
    if (!data.intrinsic_matrices) {
      socket.emit("set-intrinsic-matrices", {intrinsicMatrices})
    } else {
      setIntrinsicMatrices(data.intrinsic_matrices)
    }
    if (!data.distortion_coefs) {
      socket.emit("set-distortion-coefs", {distortionCoefs})
    } else {
      setDistortionCoefs(data.distortion_coefs)
    }
  }, [cameraPoses, toWorldCoordsMatrix, intrinsicMatrices, distortionCoefs]);

  return (
    <Container fluid>
      <Logo />
      <ConnectionManager updateState={stateUpdater} />
      <ModeControlBar mocapMode={mocapMode} setMocapMode={setMocapMode} />
      <Row>
        <Col>
            <Tabs
              defaultActiveKey="cameraView"
              id="top-tab-set"
            > 
              <Tab eventKey="cameraView" title="🎥 Camera Feed">
                <CameraView
                    mocapMode={mocapMode}
                    parsedCapturedPointsForPose={parsedCapturedPointsForPose}
                    reprojectedPoints={reprojectedPoints}
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
              id="bottom-tab-set"
            > 
              <Tab eventKey="capture" title="⏺ Capture">
                  <Capture
                    cameraPoses={cameraPoses}
                    intrinsicMatrices={intrinsicMatrices}
                    distortionCoefs={distortionCoefs} 
                    toWorldCoordsMatrix={toWorldCoordsMatrix}
                    mocapMode={mocapMode}
                    objectPoints={objectPoints}
                    objectPointErrors={objectPointErrors}
                    lastObjectPointTimestamp={lastObjectPointTimestamp}
                    isRecording={isRecording}
                    setIsRecording={setIsRecording}
                  />
              </Tab>
              <Tab eventKey="configure" title="⚙️ Configure">
                <Configure 
                  mocapMode={mocapMode}
                  cameraPoses={cameraPoses}
                  toWorldCoordsMatrix={toWorldCoordsMatrix}
                  intrinsicMatrices={intrinsicMatrices}
                  distortionCoefs={distortionCoefs}
                  objectPoints={objectPoints}
                  lastObjectPointTimestamp={lastObjectPointTimestamp}
                  setCameraPoses={setCameraPoses}
                  setToWorldCoordsMatrix={setToWorldCoordsMatrix}
                  setIntrinsicMatrices={setIntrinsicMatrices}
                  setDistortionCoefs={setDistortionCoefs}
                  setParsedCapturedPointsForPose={setParsedCapturedPointsForPose}
                  setReprojectedPoints={setReprojectedPoints}
                  setLastObjectPointTimestamp={setLastObjectPointTimestamp}
                />
              </Tab>
              <Tab eventKey="replay" title="▶️ Playback">
                <Playback 
                  isRecording={isRecording}
                  cameraPoses={cameraPoses}
                />
              </Tab>
            </Tabs>
          <div style={{height: "30px"}}></div>
        </Col>
      </Row>
    </Container>
  )
}
