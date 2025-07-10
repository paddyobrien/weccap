import time
import json
import cv2 as cv
import numpy as np
from scipy import linalg


from flask import Flask, Response, request
from flask_socketio import SocketIO
from flask_cors import CORS

from sfm import essential_from_fundamental, motion_from_essential
from mocap_system import MocapSystem
from helpers import (
    camera_intrinsics_to_serializable,
    camera_distortion_to_serializable,
    camera_poses_to_serializable,
    camera_pose_to_internal,
    camera_poses_to_projection_matrices,
    calculate_reprojection_errors,
    bundle_adjustment,
    triangulate_points,
    NumpyEncoder,
    undistort_image_points,
    align_plane_to_axis
)

from settings import intrinsic_matrices

app = Flask(__name__)
CORS(app, supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins="*")

# HTTP Routes
@app.route("/api/camera-stream/<random>")
def camera_stream(random):
    camera = request.args.get("camera")
    if camera is None:
        print("is none")
    else:
        camera = int(camera)
    mocapSystem = MocapSystem.instance()
    mocapSystem.set_socketio(socketio)

    def gen(mocapSystem, camera):
        last_frame_time = 0
        frame_size = 20
        i = 0

        while True:
            time_now = time.time()

            i = (i + 1) % frame_size
            if i == 0:
                fps_frame_average = (time_now - last_frame_time)/frame_size
                socketio.emit("fps", {"fps": round(1 / fps_frame_average)})
                last_frame_time = time.time()

            frames = mocapSystem.get_frames(camera)
            jpeg_frame = cv.imencode(".jpg", frames)[1].tobytes()

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpeg_frame + b"\r\n"
            )

    return Response(
        gen(mocapSystem, camera), mimetype="multipart/x-mixed-replace; boundary=frame"
    )

@app.route("/api/camera_state")
def camera_state():
    mocapSystem = MocapSystem.instance()

    return mocapSystem.state()

# Websocket Messages
@socketio.on("acquire-floor")
def acquire_floor(data):
    mocapSystem = MocapSystem.instance()
    world_points = np.array([item for sublist in data["objectPoints"] for item in sublist])   
    initial_to_world = mocapSystem.to_world_coords_matrix

    inv_initial_to_world = np.linalg.inv(initial_to_world)
    world_points_homogeneous = np.hstack([world_points, np.ones((world_points.shape[0], 1))])
    local_points_homogeneous = (inv_initial_to_world @ world_points_homogeneous.T).T
    
    aligned_to_world_matrix = align_plane_to_axis(world_points, initial_to_world, axis='z')

    print("\n--- New 'to-world' Matrix ---")
    print(aligned_to_world_matrix)

    new_world_points = (aligned_to_world_matrix @ local_points_homogeneous.T).T[:, :3]
    new_centroid = np.mean(new_world_points, axis=0)
    new_centered_points = new_world_points - new_centroid
    _, _, new_vh = np.linalg.svd(new_centered_points)
    new_plane_normal = new_vh[2, :]
    
    print("\n--- Alignment result ---")
    print(f"Normal of the plane after applying new matrix: {np.round(new_plane_normal, 5)}")
    print("This should be close to [0, 0, -1] or [0, 0, 1].")

    mocapSystem.to_world_coords_matrix = aligned_to_world_matrix 
    wrapped_points = []
    for item in new_world_points.tolist():
        wrapped_points.append([item])
    
    socketio.emit(
        "to-world-coords-matrix",
        {
            "to_world_coords_matrix": mocapSystem.to_world_coords_matrix.tolist(),
            "new_points": wrapped_points
        },
    )


@socketio.on("set-origin")
def set_origin(data):
    mocapSystem = MocapSystem.instance()
    object_point = np.array(data["objectPoint"])
    to_world_coords_matrix = mocapSystem.to_world_coords_matrix
    transform_matrix = np.eye(4)

    transform_matrix[:3, 3] = -object_point

    to_world_coords_matrix = transform_matrix @ to_world_coords_matrix
    mocapSystem.to_world_coords_matrix = to_world_coords_matrix

    socketio.emit(
        "to-world-coords-matrix",
        {"to_world_coords_matrix": mocapSystem.to_world_coords_matrix.tolist()},
    )

@socketio.on("update-camera-settings")
def change_camera_settings(data):
    mocapSystem = MocapSystem.instance()

    mocapSystem.edit_settings(data["exposure"], data["gain"], data["sharpness"], data["contrast"])

@socketio.on("update-point-capture-settings")
def change_point_settings(data):
    mocapSystem = MocapSystem.instance()
    mocapSystem.contour_threshold = data["contourThreshold"]

@socketio.on("calculate-bundle-adjustment")
def calculate_bundle_adjustment(data):
    mocapSystem = MocapSystem.instance()
    image_points = np.array(data["cameraPoints"])
    new_poses = bundle_adjustment(image_points, mocapSystem.intrinsic_matrices, mocapSystem.distortion_coefs, mocapSystem.camera_poses) 

    mocapSystem.set_camera_poses(new_poses)
    object_points = triangulate_points(image_points, mocapSystem.projection_matrices)
    error = np.mean(
        calculate_reprojection_errors(image_points, object_points, mocapSystem.camera_poses, mocapSystem.intrinsic_matrices)
    )
    print(f"New pose computed, average reprojection error: {error}")

    reprojected_points = []
    for object_point in object_points:
        reprojected_point = []
        for i, camera_pose in enumerate(mocapSystem.camera_poses):
            projected_img_points, _ = cv.projectPoints(
                np.expand_dims(object_point, axis=0).astype(np.float32),
                np.array(camera_pose["R"], dtype=np.float64),
                np.array(camera_pose["t"], dtype=np.float64),
                mocapSystem.intrinsic_matrices[i],
                np.array([]),
            )
            reprojected_point.append(projected_img_points[0][0].tolist())
        reprojected_points.append(reprojected_point)
    
    socketio.emit(
        "camera-pose", {
            "camera_poses": camera_poses_to_serializable(mocapSystem.camera_poses),
            "intrinsic_matrices": camera_intrinsics_to_serializable(mocapSystem.intrinsic_matrices),
            "distortion_coefs": camera_distortion_to_serializable(mocapSystem.distortion_coefs),
            "error": error,
            "reprojected": reprojected_points
        },
    )

@socketio.on("calculate-camera-pose")
def calculate_camera_pose(data):
    mocapSystem = MocapSystem.instance()
    image_points = np.array(data["cameraPoints"])

    image_points_t = image_points.transpose((1, 0, 2))

    camera_poses = [{"R": np.eye(3), "t": np.array([[0], [0], [0]], dtype=np.float32)}]
    for camera_i in range(0, mocapSystem.num_cameras - 1):
        camera1_image_points = image_points_t[camera_i]
        camera2_image_points = image_points_t[camera_i + 1]
        not_none_indicies = np.where(
            np.all(camera1_image_points != None, axis=1)
            & np.all(camera2_image_points != None, axis=1)
        )[0]
        camera1_image_points = np.take(
            camera1_image_points, not_none_indicies, axis=0
        ).astype(np.float32)
        camera2_image_points = np.take(
            camera2_image_points, not_none_indicies, axis=0
        ).astype(np.float32)

        F, _ = cv.findFundamentalMat(
            camera1_image_points, camera2_image_points, cv.FM_RANSAC, 3, 0.99999
        )
        if F is None:
            socketio.emit("error", "Could not compute fundamental matrix")
            return
        E = essential_from_fundamental(
            F,
            mocapSystem.intrinsic_matrices[camera_i],
            mocapSystem.intrinsic_matrices[camera_i+1]
        )
        possible_Rs, possible_ts = motion_from_essential(E)

        R = None
        t = None
        max_points_infront_of_camera = 0
        for i in range(0, 4):
            object_points = triangulate_points(
                np.hstack(
                    [
                        np.expand_dims(camera1_image_points, axis=1),
                        np.expand_dims(camera2_image_points, axis=1),
                    ]
                ),
                camera_poses_to_projection_matrices(np.concatenate(
                    [[camera_poses[-1]], [{"R": possible_Rs[i], "t": possible_ts[i]}]]
                ), [
                        intrinsic_matrices[camera_i],
                        intrinsic_matrices[camera_i+1]
                    ]),
            )
            object_points_camera_coordinate_frame = np.array(
                [possible_Rs[i].T @ object_point for object_point in object_points]
            )

            points_infront_of_camera = np.sum(object_points[:, 2] > 0) + np.sum(
                object_points_camera_coordinate_frame[:, 2] > 0
            )

            if points_infront_of_camera > max_points_infront_of_camera:
                max_points_infront_of_camera = points_infront_of_camera
                R = possible_Rs[i]
                t = possible_ts[i]

        R = R @ camera_poses[-1]["R"]
        t = camera_poses[-1]["t"] + (camera_poses[-1]["R"] @ t)

        camera_poses.append({"R": R, "t": t})

    new_poses = bundle_adjustment(image_points, mocapSystem.intrinsic_matrices, mocapSystem.distortion_coefs, camera_poses) 
    
    mocapSystem.set_camera_poses(new_poses)

    object_points = triangulate_points(image_points, mocapSystem.projection_matrices)
    error = np.mean(
        calculate_reprojection_errors(image_points, object_points, mocapSystem.camera_poses, mocapSystem.intrinsic_matrices)
    )
    print(f"New pose computed, average reprojection error: {error}")

    reprojected_points = []
    for object_point in object_points:
        reprojected_point = []
        for i, camera_pose in enumerate(mocapSystem.camera_poses):
            projected_img_points, _ = cv.projectPoints(
                np.expand_dims(object_point, axis=0).astype(np.float32),
                np.array(camera_pose["R"], dtype=np.float64),
                np.array(camera_pose["t"], dtype=np.float64),
                mocapSystem.intrinsic_matrices[i],
                np.array([]),
            )
            reprojected_point.append(projected_img_points[0][0].tolist())
        reprojected_points.append(reprojected_point)

    socketio.emit(
        "camera-pose", {
            "camera_poses": camera_poses_to_serializable(mocapSystem.camera_poses),
            "intrinsic_matrices": camera_intrinsics_to_serializable(mocapSystem.intrinsic_matrices),
            "distortion_coefs": camera_distortion_to_serializable(mocapSystem.distortion_coefs),
            "reprojected": reprojected_points,
            "error": error
        }
    )

@socketio.on("set-camera-poses")
def set_camera_poses(data):
    poses = data["cameraPoses"]
    mocapSystem = MocapSystem.instance()
    mocapSystem.set_camera_poses(poses)

@socketio.on("set-to-world-matrix")
def set_to_world_matrix(data):
    m = data["toWorldCoordsMatrix"]
    
    mocapSystem = MocapSystem.instance()
    mocapSystem.to_world_coords_matrix = np.array(m) 

@socketio.on("set-intrinsic-matrices")
def set_camera_poses(data):
    intrinsics = np.array(data["intrinsicMatrices"])
    mocapSystem = MocapSystem.instance()
    mocapSystem.set_camera_intrinsics(intrinsics, mocapSystem.distortion_coefs)

@socketio.on("set-distortion-coefs")
def set_camera_poses(data):
    distortionCoefs = np.array(data["distortionCoefs"])
    mocapSystem = MocapSystem.instance()
    mocapSystem.set_camera_intrinsics(mocapSystem.intrinsic_matrices, distortionCoefs)

@socketio.on("change-mocap-mode")
def change_mocap_mode(data):
    mocapSystem = MocapSystem.instance()
    mocapSystem.change_mode(data)

@socketio.on("determine-scale")
def determine_scale(data):
    object_points = data["objectPoints"]
    real_distance = 0.119
    mocapSystem = MocapSystem.instance()
    camera_poses = mocapSystem.camera_poses

    observed_distances = []
    for object_points_i in object_points:
        if len(object_points_i) != 2:
            continue
        object_points_i = np.array(object_points_i)

        observed_distances.append(
            np.sqrt(np.sum((object_points_i[0] - object_points_i[1]) ** 2))
        )
    if len(observed_distances) == 0:
        socketio.emit("scale-error", {"message": "Did not find valid points"})
        return    
    scale_factor = real_distance / np.mean(observed_distances)
    
    for i in range(0, len(camera_poses)):
        camera_poses[i]["t"] = (np.array(camera_poses[i]["t"]) * scale_factor).tolist()
    mocapSystem.set_camera_poses(camera_poses)
    socketio.emit("scaled", {"scale_factor": scale_factor, "camera_poses": camera_poses})

@socketio.on("start_recording")
def start_recording(data):
    name = data["name"]
    record_video = data["recordVideo"]
    mocapSystem = MocapSystem.instance()
    mocapSystem.start_recording(name, record_video)

@socketio.on("stop_recording")
def stop_recording():
    # Stop the current stream
    mocapSystem = MocapSystem.instance()
    mocapSystem.stop_recording()

# Start the server
if __name__ == "__main__":
    mocapSystem = MocapSystem.instance()
    try:
        mocapSystem.set_socketio(socketio)
        socketio.run(app, port=3001, debug=True, use_reloader=False)
        socketio.emit("started")
    finally:
        print("\nReleasing MocapSystem")
        mocapSystem.end()
        socketio.emit("stopped")
        print("\nGoodbye")
