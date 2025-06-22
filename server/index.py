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
    bundle_adjustment2,
    triangulate_points,
    NumpyEncoder,
    undistort_image_points
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

@app.route("/api/bundle_adjustment", methods=["POST"])
def bundle_adjustment_post():
    data = request.json

    image_points = np.array(data["imagePoints"])
    camera_pose = camera_pose_to_internal(data["cameraPose"])
    intrinsic_matrices = data["intrinsicMatrices"]
    projection_matrices = camera_poses_to_projection_matrices(camera_pose, intrinsic_matrices)
    # camera_pose = bundle_adjustment(image_points, camera_pose, projection_matrices)

    object_points = triangulate_points(image_points, projection_matrices)
    error = np.mean(
        calculate_reprojection_errors(image_points, object_points, camera_pose)
    )
    print(error) 
    # Take an array of image points, generate a new camera pose from it
    # if the re-projection error is good enough
    # run the points through triangulation and emit new object points
    return json.dumps({
        "imagePoints": image_points,
        "cameraPose": camera_pose,
        "error": error
    }, cls=NumpyEncoder)

# Websocket Messages
@socketio.on("acquire-floor")
def acquire_floor(data):
    mocapSystem = MocapSystem.instance()
    object_points = np.array([item for sublist in data["objectPoints"] for item in sublist])
    
    # 1. Fit floor plane (SVD)
    centroid = np.mean(object_points, axis=0)
    points_centered = object_points - centroid
    U, s, Vh = np.linalg.svd(points_centered)
    a, b, c = Vh[2, :]  
    current_normal = np.array([a, b, c])
    if current_normal[2] < 0:
        current_normal *= -1  # Ensure Z points up

    # 2. Target normal: Z-up ([0,0,1])
    target_normal = np.array([0, 0, 1])

    # 3. Compute rotation (Rodrigues)
    v = np.cross(current_normal, target_normal)
    c_theta = np.dot(current_normal, target_normal)
    kmat = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    rotation = np.eye(3) + kmat + kmat @ kmat * (1 / (1 + c_theta))

    # 4. Apply rotation to existing matrix
    existing_matrix = np.array(mocapSystem.to_world_coords_matrix)
    new_matrix = existing_matrix.copy()
    new_matrix[:3, :3] = rotation @ existing_matrix[:3, :3]

    # 5. Check alignment: Compute error before/after
    old_error = np.abs(np.dot(existing_matrix[:3, 2], current_normal) - 1)  # Current misalignment
    transformed_points = (new_matrix @ np.column_stack([object_points, np.ones(len(object_points))]).T)[:3, :]
    new_error = np.max(np.abs(transformed_points[2, :]))  # New floor error

    # 6. Reverse rotation if error increases
    if new_error > old_error:
        rotation = np.eye(3) - kmat + kmat @ kmat * (1 / (1 - c_theta))  # Reverse direction
        new_matrix[:3, :3] = rotation @ existing_matrix[:3, :3]
        transformed_points = (new_matrix @ np.column_stack([object_points, np.ones(len(object_points))]).T)[:3, :]
        new_error = np.max(np.abs(transformed_points[2, :]))

    # 7. Force floor to z=0
    # new_matrix[2, 3] = -np.dot(target_normal, centroid)

    # 8. Update system
    mocapSystem.to_world_coords_matrix = new_matrix
    socketio.emit(
        "to-world-coords-matrix",
        {"to_world_coords_matrix": new_matrix.tolist()},
    )
    print(f"Alignment error: {new_error:.6f} (should be close to 0)")

@socketio.on("set-origin")
def set_origin(data):
    mocapSystem = MocapSystem.instance()
    object_point = np.array(data["objectPoint"])
    to_world_coords_matrix = np.array(data["toWorldCoordsMatrix"])
    transform_matrix = np.eye(4)

    object_point[1], object_point[2] = (
        object_point[2],
        object_point[1],
    )  # i dont fucking know why
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
    new_poses, new_intrinsics, new_distortion_coefs = bundle_adjustment2(image_points, mocapSystem.intrinsic_matrices, mocapSystem.distortion_coefs, mocapSystem.camera_poses) 

    mocapSystem.set_camera_poses(new_poses)
    mocapSystem.set_camera_intrinsics(new_intrinsics, new_distortion_coefs)

    fixed_image_points = []
    for i in range(0, len(image_points)):
        fixed_image_points = fixed_image_points + undistort_image_points(
                [image_points[i]],
                mocapSystem.optimal_matrices,
                mocapSystem.intrinsic_matrices,
                mocapSystem.distortion_coefs
            )

    object_points = triangulate_points(fixed_image_points, mocapSystem.projection_matrices)
    error = np.mean(
        calculate_reprojection_errors(image_points, object_points, mocapSystem.camera_poses, mocapSystem.intrinsic_matrices)
    )
    print(f"New pose computed, average reprojection error: {error}")
    
    socketio.emit(
        "camera-pose", {
            "camera_poses": camera_poses_to_serializable(mocapSystem.camera_poses),
            "intrinsic_matrices": camera_intrinsics_to_serializable(mocapSystem.intrinsic_matrices),
            "distortion_coefs": camera_distortion_to_serializable(mocapSystem.distortion_coefs),
            "error": error
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
                ), intrinsic_matrices),
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

    new_poses, new_intrinsics, new_distortion_coefs = bundle_adjustment2(image_points, mocapSystem.intrinsic_matrices, mocapSystem.distortion_coefs, mocapSystem.camera_poses) 
    mocapSystem.set_camera_poses(new_poses)
    mocapSystem.set_camera_intrinsics(new_intrinsics, new_distortion_coefs)

    fixed_image_points = []
    for i in range(0, len(image_points)):
        fixed_image_points = fixed_image_points + undistort_image_points(
                [image_points[i]],
                mocapSystem.optimal_matrices,
                mocapSystem.intrinsic_matrices,
                mocapSystem.distortion_coefs
            )

    object_points = triangulate_points(fixed_image_points, mocapSystem.projection_matrices)
    error = np.mean(
        calculate_reprojection_errors(image_points, object_points, camera_poses, mocapSystem.intrinsic_matrices)
    )
    print(f"New pose computed, average reprojection error: {error}")

    socketio.emit(
        "camera-pose", {
            "camera_poses": camera_poses_to_serializable(camera_poses),
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
    mocapSystem.to_world_coords_matrix= m 

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
    print(object_points)
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
    print("==")
    print(observed_distances)
    scale_factor = real_distance / np.mean(observed_distances)
    
    for i in range(0, len(camera_poses)):
        camera_poses[i]["t"] = (np.array(camera_poses[i]["t"]) * scale_factor).tolist()
    mocapSystem.set_camera_poses(camera_poses)
    socketio.emit("scaled", {"scale_factor": scale_factor, "camera_poses": camera_poses})

@socketio.on("start_recording")
def start_recording(data):
    name = data["name"]
    mocapSystem = MocapSystem.instance()
    mocapSystem.start_recording(name)

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
