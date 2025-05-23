from helpers import (
    camera_poses_to_serializable,
    calculate_reprojection_errors,
    bundle_adjustment,
    triangulate_points,
)

import cv2 as cv
import numpy as np
import json

points = [
    [[55, 185], [62, 80]],
    [[80, 249], [74, 142]],
    [[227, 214], [299, 121]],
    [[154, 132], [204, 58]],
    [[26, 164], [41, 81]],
    [[206, 219], [267, 84]],
    [[93, 269], [86, 164]],
    [[32, 227], [15, 108]],
    [[219, 268], [282, 180]],
    [[147, 248], [170, 142]],
    [[120, 213], [130, 70]],
    [[87, 190], [91, 52]],
    [[216, 132], [288, 47]],
    [[111, 124], [150, 49]],
    [[159, 215], [194, 104]],
]

num_cameras = 2
intrinsic_matrix = np.array([[320.0, 0, 160], [0, 320, 160], [0, 0, 1]])
image_points = np.array(points)

image_points_t = image_points.transpose((1, 0, 2))

camera_poses = [{"R": np.eye(3), "t": np.array([[0], [0], [0]], dtype=np.float32)}]
for camera_i in range(0, num_cameras - 1):
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
        camera1_image_points, camera2_image_points, cv.FM_LMEDS, 3, 0.99999
    )
    if F is None:
        print("Could not compute fundamental matrix")
        exit()
    E = cv.sfm.essentialFromFundamental(F, intrinsic_matrix, intrinsic_matrix)
    possible_Rs, possible_ts = cv.sfm.motionFromEssential(E)

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
            np.concatenate(
                [[camera_poses[-1]], [{"R": possible_Rs[i], "t": possible_ts[i]}]]
            ),
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

camera_poses = bundle_adjustment(image_points, camera_poses)

object_points = triangulate_points(image_points, camera_poses)
error = np.mean(
    calculate_reprojection_errors(image_points, object_points, camera_poses)
)
print(camera_poses_to_serializable(camera_poses))
print(f"Error {error}")
