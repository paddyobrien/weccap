import os
import uuid
import numpy as np
import cv2 as cv
from settings import intrinsic_matrices, distortion_coefs
from pseyepy import Camera, cam_count, Stream
from Singleton import Singleton
from KalmanFilter import KalmanFilter
from helpers import (
    find_point_correspondance_and_object_points,
    locate_objects,
    make_square,
    camera_poses_to_projection_matrices,
    undistort_image_points,
    camera_intrinsics_to_serializable,
    camera_distortion_to_serializable
)
from flags import ADVANCED_BA

DEFAULT_FPS = 125

# This enum is also defined in modes.ts in the front end, keep them in sync
class Modes():
    Initializing = -1,
    CamerasNotFound = 0
    CamerasFound = 1
    SaveImage = 2
    ImageProcessing = 3
    PointCapture = 4
    Triangulation = 5
    ObjectDetection = 6

readable_modes = {
    Modes.Initializing: "Initializing",
    Modes.CamerasNotFound: "Cameras not found",
    Modes.SaveImage: "Save image",
    Modes.ImageProcessing: "Processing images",
    Modes.PointCapture: "Capturing points",
    Modes.Triangulation: "Triangulating",
    Modes.ObjectDetection: "Detecting objects"
}

Transitions = {
    Modes.SaveImage: [Modes.CamerasFound],
    Modes.CamerasFound: [Modes.ImageProcessing, Modes.SaveImage],
    Modes.ImageProcessing: [Modes.CamerasFound, Modes.PointCapture],
    Modes.PointCapture: [Modes.ImageProcessing, Modes.Triangulation],
    Modes.Triangulation: [Modes.PointCapture, Modes.ObjectDetection],
    Modes.ObjectDetection: [Modes.Triangulation],
}
@Singleton
class MocapSystem:
    def __init__(self):
        self.camera_poses = None
        self.cameras = None
        self.stream = None
        self.output_file = None
        self.intrinsic_matrices = intrinsic_matrices
        self.distortion_coefs = distortion_coefs
        self.projection_matrices = None
        self.optimal_matrices = None
        self.to_world_coords_matrix = None
        self.capture_mode = Modes.Initializing
        self.num_cameras = 0

        self.contour_threshold = 0.4

        self.kalman_filter = KalmanFilter(1)
        self.socketio = None
        self.initialize_cameras(DEFAULT_FPS)
        self.kernel = np.array(
                [
                    [-2, -1, -1, -1, -2],
                    [-1,  1,  3,  1, -1],
                    [-1,  3,  4,  3, -1],
                    [-1,  1,  3,  1, -1],
                    [-2, -1, -1, -1, -2],
                ]
            )    

    def initialize_cameras(self, target_fps):
        print("\nInitializing cameras")
        try:
            self.cameras = Camera(
                fps=target_fps, resolution=Camera.RES_SMALL, colour=True, gain=1, exposure=50
            )
            self.capture_mode = Modes.ImageProcessing
        except:
            self.capture_mode = Modes.CamerasNotFound

        if self.capture_mode >= Modes.CamerasFound:
            self.num_cameras = cam_count()
            print(f"{self.num_cameras} cameras found")
            if ADVANCED_BA == True:
                self._calculate_optimal_matrices()
        else:
            print(f"Failed to find cameras, please check connections")

    def end(self):
        self.cameras.end()

    def start_recording(self, name, record_video):
        print("starting record")
        self.output_file = open(f"data/{name}.csv", "w")
        if record_video:
            self.stream = Stream(self.cameras, file_name=f'videos/{name}.avi', display=True)

    def stop_recording(self):
        if self.stream:
            self.stream.end()
            self.stream = None
        self.output_file.close()
        self.output_file = None

    def set_socketio(self, socketio):
        self.socketio = socketio
        self.socketio.emit("num-cams", self.num_cameras)

    def state(self):
        return {
            "mode": self.capture_mode, 
            "camera_poses": self.camera_poses,
            "to_world_coords_matrix": self.to_world_coords_matrix,
            "intrinsic_matrices": camera_intrinsics_to_serializable(self.intrinsic_matrices),
            "distortion_coefs": camera_distortion_to_serializable(self.distortion_coefs),
            "exposure": self.cameras.exposure if self.cameras else 0,
            "gain": self.cameras.gain if self.cameras else 0
        }

    def set_camera_intrinsics(self, intrinsic_matrices, distortion_coefs):
        self.intrinsic_matrices = intrinsic_matrices
        self.distortion_coefs = distortion_coefs
        self.projection_matrices = camera_poses_to_projection_matrices(self.camera_poses, self.intrinsic_matrices)

    def set_camera_poses(self, poses):
        self.camera_poses = poses
        self.projection_matrices = camera_poses_to_projection_matrices(self.camera_poses, self.intrinsic_matrices)

    def edit_settings(self, exposure, gain, sharpness, contrast):
        self.cameras.exposure = [exposure] * self.num_cameras
        self.cameras.gain = [gain] * self.num_cameras
        self.cameras.sharpness = [sharpness] * self.num_cameras
        self.cameras.contrast = [contrast] * self.num_cameras

    def _camera_read(self):
        frames, timestamps = self.cameras.read(squeeze=False)
        image_points = []
        object_points = []
        errors = []
        objects = []
        filtered_objects = []

        if self.capture_mode == Modes.SaveImage:
            self._capture_image(frames)
            self.change_mode(Modes.CamerasFound)

        if self.capture_mode >= Modes.ImageProcessing:
            frames = self._image_processing(frames)
        
        if self.capture_mode >= Modes.PointCapture:
            image_points = self._point_capture(frames)

        if self.capture_mode >= Modes.Triangulation:
            object_points, errors, frames = self._triangulation(frames, image_points)

        if self.capture_mode >= Modes.ObjectDetection:
            objects, filtered_objects = self._object_detection(object_points, errors)

        average_time = np.mean(timestamps)
        self._emit_data(average_time, image_points, object_points, errors, objects, filtered_objects)
        return frames

    def get_frames(self, camera=None):
        if self.capture_mode >= Modes.CamerasFound:
            frames = self._camera_read()
            if camera == None:
                return np.hstack(frames)
            return frames[camera]
        else:
            raise RuntimeError("Cannot get frames mode is {self.capture_mode}, should be greater than {Modes.CameraFound}")

    def _capture_image(self, frames):
        for i in range(0, self.num_cameras):
            print(f"Storing image to {os.getcwd()}")
            cv.imwrite(f"./images/camera_{i}_{uuid.uuid4()}.png", frames[i])

    def _image_processing(self, frames):
        for i in range(0, self.num_cameras):
            frames[i] = np.copy(frames[i])
            # frames[i] = np.rot90(frames[i], k=0)
            
            frames[i] = cv.undistort(frames[i], self.intrinsic_matrices[i], self.distortion_coefs[i])
            # many of these things were also done in _find_dot
            # frames[i] = cv.medianBlur(frames[i],9)
            # frames[i] = cv.GaussianBlur(frames[i],(9,9),0)
            # frames[i] = cv.filter2D(frames[i], -1, self.kernel)
            # frames[i] = cv.cvtColor(frames[i], cv.COLOR_RGB2BGR)
        return frames

    def _point_capture(self, frames):
        image_points = []
        for i in range(0, self.num_cameras):
            frames[i], single_camera_image_points = self._find_dot(frames[i])
            image_points.append(single_camera_image_points)
        return image_points

    def _find_dot(self, img):
        # img = cv.GaussianBlur(img,(5,5),0)
        grey = cv.cvtColor(img, cv.COLOR_RGB2GRAY)
        grey = cv.threshold(grey, 255 * self.contour_threshold, 255, cv.THRESH_BINARY)[1]
        contours, _ = cv.findContours(grey, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE)
        img = cv.drawContours(img, contours, -1, (0, 255, 0), 1)

        image_points = []
        for contour in contours:
            moments = cv.moments(contour)
            if moments["m00"] != 0:
                center_x = moments["m10"] / moments["m00"]
                center_y = moments["m01"] / moments["m00"]
                center_x_int = int(center_x)
                center_y_int = int(center_y)
                cv.putText(
                    img,
                    f"({center_x_int}, {center_y_int})",
                    (center_x_int, center_y_int - 15),
                    cv.FONT_HERSHEY_SIMPLEX,
                    0.3,
                    (100, 255, 100),
                    1,
                )
                cv.circle(img, (center_x_int, center_y_int), 1, (100, 255, 100), -1)
                image_points.append([center_x, center_y])

        if len(image_points) == 0:
            image_points = [[None, None]]

        return img, image_points

    def _triangulation(self, frames, image_points):
        errors, object_points, frames = (
            find_point_correspondance_and_object_points(
                image_points, self.camera_poses, self.intrinsic_matrices, self.projection_matrices, frames
            )
        )
        # convert to world coordinates
        for i, object_point in enumerate(object_points):
            object_point_homogeneous = np.concatenate((object_point, [1]))
            world_point_homogeneous = (
                np.array(self.to_world_coords_matrix) @ object_point_homogeneous
            )
            object_points[i] = world_point_homogeneous[:3]
        return object_points, errors, frames

    def _object_detection(self, object_points, errors):
        objects = locate_objects(object_points, errors)
        filtered_objects = self.kalman_filter.predict_location(objects)

        if len(filtered_objects) != 0:
            for filtered_object in filtered_objects:
                filtered_object["heading"] = round(
                    filtered_object["heading"], 4
                )

        for filtered_object in filtered_objects:
            filtered_object["vel"] = filtered_object["vel"].tolist()
            filtered_object["pos"] = filtered_object["pos"].tolist()
        return objects, filtered_objects

    def _emit_data(self, time, image_points, object_points, errors, objects, filtered_objects):
        if self.output_file:
            self._write_to_file(time, object_points)
        if self.capture_mode == Modes.PointCapture:
            self.socketio.emit("image-points", [x[0] for x in image_points])
        elif self.capture_mode >= Modes.Triangulation:
            self.socketio.emit(
                "object-points",
                {
                    "object_points": object_points.tolist(),
                    "time_ms": time, 
                    "image_points": image_points,
                    "errors": errors.tolist(),
                    "objects": [
                        {
                            k: (v.tolist() if isinstance(v, np.ndarray) else v)
                            for (k, v) in object.items()
                        }
                        for object in objects
                    ],
                    "filtered_objects": filtered_objects,
                },
            )

    def _calculate_optimal_matrices(self):
        self.optimal_matrices = []
        dimensions = (320, 240)
        for i in range(0, self.num_cameras):
            opt, _ = cv.getOptimalNewCameraMatrix(self.intrinsic_matrices[i], self.distortion_coefs[i], dimensions, 1, dimensions)
            self.optimal_matrices.append(opt)

    def _write_to_file(self, time, object_points):
        coords = object_points.flatten().tolist()
        self.output_file.write(f"{time},{",".join(str(x) for x in coords)}\n")

    def change_mode(self, target_mode):
        valid_source_modes = Transitions[target_mode]
        if self.capture_mode in valid_source_modes:
            self.capture_mode = target_mode
            self.socketio.emit("mode-change", self.capture_mode)
            return
        else:
            self.socketio.emit("mode-change-failure", "Mode change failed, cannot go from \"{readable_modes[self.capture_mode]}\" to \"{readable_modes[self.target_mode]}\"" )