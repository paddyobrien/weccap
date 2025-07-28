import numpy as np
import json
from scipy import linalg, optimize
import cv2 as cv
from scipy.spatial.transform import Rotation
import copy
from sfm import fundamental_from_projections 

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

def calculate_reprojection_errors(image_points, object_points, camera_poses, intrinsic_matrices):
    errors = np.array([])
    for image_points_i, object_point in zip(image_points, object_points):
        error = calculate_reprojection_error(image_points_i, object_point, camera_poses, intrinsic_matrices)
        if error is None:
            continue
        errors = np.concatenate([errors, [error]])

    return errors


def calculate_reprojection_error(image_points, object_point, camera_poses, intrinsic_matrices):
    image_points = np.array(image_points)
    none_indicies = np.where(np.all(image_points == None, axis=1))[0]
    image_points = np.delete(image_points, none_indicies, axis=0)
    camera_poses = np.delete(camera_poses, none_indicies, axis=0)

    if len(image_points) <= 1:
        return None

    image_points_t = image_points.transpose((0, 1))

    errors = np.array([])
    for i in range(0, len(image_points)):
        camera_pose = camera_poses[i]
        if np.all(image_points[i] == None, axis=0):
            continue
        projected_img_points, _ = cv.projectPoints(
            np.expand_dims(object_point, axis=0).astype(np.float32),
            np.array(camera_pose["R"], dtype=np.float64),
            np.array(camera_pose["t"], dtype=np.float64),
            intrinsic_matrices[i],
            np.array([]),
        )
        projected_img_point = projected_img_points[:, 0, :][0]
        errors = np.concatenate(
            [errors, (image_points_t[i] - projected_img_point).flatten() ** 2]
        )

    return errors.mean()


# https://www.cs.jhu.edu/~misha/ReadingSeminar/Papers/Triggs00.pdf
def bundle_adjustment(image_points, intrinsic_matrices, distortion_coefs, camera_poses):
    num_cameras = len(intrinsic_matrices)
    section_size = 6

    # function to turn params back into data structures
    def parse_params(params):
        new_poses = []
        for i in range(0, num_cameras):
            section_boundary = i * section_size
            new_poses.append(
                {
                    "R": Rotation.as_matrix(
                        Rotation.from_rotvec(params[section_boundary  : section_boundary + 3])
                    ),
                    "t": params[section_boundary + 3 : section_boundary + 3 + 3],
                }
            )

        return new_poses

    # residual function
    def residual_function(params, image_points):
        parsed_poses = parse_params(params)
        new_projection_matrices = camera_poses_to_projection_matrices(parsed_poses, intrinsic_matrices)
        object_points = triangulate_points(image_points, new_projection_matrices)
        return calculate_reprojection_errors(
            image_points, object_points, parsed_poses, intrinsic_matrices
        )

    # build initial params
    # rotation_vector, translation_vector, intrinsics, distortion_coef
    params = []
    for i in range(0, num_cameras):
        camera_pose = camera_poses[i]
        rot_vec = Rotation.as_rotvec(Rotation.from_matrix(camera_pose["R"])).flatten()
        trans_vec = np.array(camera_pose["t"]).flatten()
        section = rot_vec.tolist() + trans_vec.tolist()
        params = params + section
    dimensions = (320, 240)
    optimal_matrices = []
    for i in range(0, num_cameras):
        opt, _ = cv.getOptimalNewCameraMatrix(intrinsic_matrices[i], distortion_coefs[i], dimensions, 1, dimensions)
        optimal_matrices.append(opt)

    res = optimize.least_squares(
        residual_function,
        params,
        max_nfev=1000,
        jac='3-point',
        x_scale='jac',
        verbose=2,
        method='dogbox',
        loss="linear",
        ftol=1e-15,
        xtol=None,
        f_scale=1,
        args=[image_points]
    )
    return parse_params(res.x)
    

def triangulate_point(image_points, projection_matrices):
    image_points = np.array(image_points)
    Ps = np.array(projection_matrices)
    none_indicies = np.where(np.all(image_points == None, axis=1))[0]
    image_points = np.delete(image_points, none_indicies, axis=0)
    Ps = np.delete(Ps, none_indicies, axis=0)

    if len(image_points) <= 1:
        return [None, None, None]

    object_point = DLT(Ps, image_points)

    return object_point

def triangulate_points(image_points, projection_matrices):
    object_points = []
    for image_points_i in image_points:
        object_point = triangulate_point(image_points_i, projection_matrices)
        object_points.append(object_point)

    return np.array(object_points)

# https://temugeb.github.io/computer_vision/2021/02/06/direct-linear-transorms.html
def DLT(Ps, image_points):
    A = []

    for P, image_point in zip(Ps, image_points):
        A.append(image_point[1] * P[2, :] - P[1, :])
        A.append(P[0, :] - image_point[0] * P[2, :])

    A = np.array(A).reshape((len(Ps) * 2, 4))
    B = A.transpose() @ A

    _, _, Vh = linalg.svd(B, full_matrices=False)

    object_point = Vh[3, 0:3] / Vh[3, 3]

    return object_point

def find_point_correspondance_and_object_points(image_points, camera_poses, intrinsic_matrices, projection_matrices, frames=None):
    for image_points_i in image_points:
        try:
            image_points_i.remove([None, None])
        except:
            pass
    # use whatever camera has the most points visible as the root to reduce chances of losing a point
    # root_camera_index = max(range(len(image_points)), key=lambda i: len(image_points[i]))
    root_camera_index = 0
    # [object_points, possible image_point groups, image_point from camera]
    correspondances = [[[i]] for i in image_points[root_camera_index]]

    Ps = projection_matrices

    root_image_points = [{"camera": root_camera_index, "point": point} for point in image_points[root_camera_index]]
    num_cams = len(camera_poses)
    for offset in range(num_cams - 1):
        i = (root_camera_index + 1 + offset) % num_cams
        epipolar_lines = []
        for root_image_point in root_image_points:
            F = fundamental_from_projections(Ps[root_image_point["camera"]], Ps[i])
            line = cv.computeCorrespondEpilines(
                np.array([root_image_point["point"]], dtype=np.float32), 1, F
            )
            epipolar_lines.append(line[0, 0].tolist())
            if frames:
                frames[i] = drawlines(frames[i], line[0])

        not_closest_match_image_points = np.array(image_points[i])
        points = np.array(image_points[i])

        for j, [a, b, c] in enumerate(epipolar_lines):
            distances_to_line = np.array([])
            if len(points) != 0:
                distances_to_line = np.abs(
                    a * points[:, 0] + b * points[:, 1] + c
                ) / np.sqrt(a**2 + b**2)

            possible_matches = points[distances_to_line < 5].copy()

            # sort possible matches from smallest to largest
            distances_to_line = distances_to_line[distances_to_line < 5]
            possible_matches_sorter = distances_to_line.argsort()
            possible_matches = possible_matches[possible_matches_sorter]

            if len(possible_matches) == 0:
                for possible_group in correspondances[j]:
                    possible_group.append([None, None])
            else:
                not_closest_match_image_points = [
                    row
                    for row in not_closest_match_image_points.tolist()
                    if row != possible_matches.tolist()[0]
                ]
                not_closest_match_image_points = np.array(
                    not_closest_match_image_points
                )

                new_correspondances_j = []
                for possible_match in possible_matches:
                    temp = copy.deepcopy(correspondances[j])
                    for possible_group in temp:
                        possible_group.append(possible_match.tolist())
                    new_correspondances_j += temp
                correspondances[j] = new_correspondances_j

    object_points = []
    errors = []

    for image_points in correspondances:
        object_points_i = triangulate_points(image_points, Ps)

        if np.all(object_points_i == None):
            continue

        errors_i = calculate_reprojection_errors(
            image_points, object_points_i, camera_poses, intrinsic_matrices
        )

        object_points.append(object_points_i[np.argmin(errors_i)])
        errors.append(np.min(errors_i))

    return np.array(errors), np.array(object_points), frames

def locate_objects(object_points, errors):
    dist = 0.131
    dist1 = 0.089
    dist2 = 0.133

    distance_matrix = np.zeros((object_points.shape[0], object_points.shape[0]))
    already_matched_points = []
    objects = []

    for i in range(0, object_points.shape[0]):
        for j in range(0, object_points.shape[0]):
            distance_matrix[i, j] = np.sqrt(
                np.sum((object_points[i] - object_points[j]) ** 2)
            )
    for i in range(0, object_points.shape[0]):
        if i in already_matched_points:
            continue
        matches = np.abs(distance_matrix[i] - dist) < 0.025
        if np.any(matches):
            best_match_i = np.argmax(matches)

            already_matched_points.append(i)
            already_matched_points.append(best_match_i)

            location = (object_points[i]+object_points[best_match_i])/2
            error = np.mean([errors[i], errors[best_match_i]])

            heading_vec = object_points[best_match_i] - object_points[i]
            heading_vec /= linalg.norm(heading_vec)
            heading = np.arctan2(heading_vec[1], heading_vec[0])

            heading = heading - np.pi if heading > np.pi/2 else heading
            heading = heading + np.pi if heading < -np.pi/2 else heading

            objects.append({
                "pos": location,
                "heading": -heading,
                "error": error,
                "droneIndex": 0
            })
        # distance_deltas = np.abs(distance_matrix[i] - dist1)
        # print(distance_deltas < 0.025)
        # num_matches = distance_deltas < 0.025
        
        # matches_index = np.where(distance_deltas < 0.025)[0]
        # print("----")
        # if np.sum(num_matches) >= 2:
        #     for possible_pair in cartesian_product(matches_index, matches_index):
        #         pair_distance = np.sqrt(
        #             np.sum(
        #                 (
        #                     object_points[possible_pair[0]]
        #                     - object_points[possible_pair[1]]
        #                 )
        #                 ** 2
        #             )
        #         )
        #         print(pair_distance)

        #         # if the pair isnt the correct distance apart
        #         if np.abs(pair_distance - dist2) > 0.025:
        #             continue

        #         best_match_1_i = possible_pair[0]
        #         best_match_2_i = possible_pair[1]

        #         already_matched_points.append(i)
        #         already_matched_points.append(best_match_1_i)
        #         already_matched_points.append(best_match_2_i)

        #         location = (
        #             object_points[best_match_1_i] + object_points[best_match_2_i]
        #         ) / 2
        #         error = np.mean(
        #             [errors[i], errors[best_match_1_i], errors[best_match_2_i]]
        #         )

        #         heading_vec = (
        #             object_points[best_match_1_i] - object_points[best_match_2_i]
        #         )
        #         heading_vec /= linalg.norm(heading_vec)
        #         heading = np.arctan2(heading_vec[1], heading_vec[0])

        #         heading = heading - np.pi if heading > np.pi / 2 else heading
        #         heading = heading + np.pi if heading < -np.pi / 2 else heading

        #         # determine drone index based on which side third light is on
        #         drone_index = 0 if (object_points[i] - location)[1] > 0 else 1

        #         objects.append(
        #             {
        #                 "pos": location,
        #                 "heading": -heading,
        #                 "error": error,
        #                 "droneIndex": drone_index,
        #             }
        #         )

        #         break

    return objects

def drawlines(img1, lines):
    _, c, _ = img1.shape
    color = (255,255,255)
    for r in lines:
        if np.isnan(r[1]) or np.isnan(r[2]):
            continue
        x0, y0 = map(int, [0, -r[2] / r[1]])
        x1, y1 = map(int, [c, -(r[2] + r[0] * c) / r[1]])
        img1 = cv.line(img1, (x0, y0), (x1, y1), color, 1)
    return img1

# TODO - Camera poses probably deserve their own type that can be marshalled at the api boundary
def camera_poses_to_serializable(camera_poses):
    for i in range(0, len(camera_poses)):
        camera_poses[i] = {k: v.tolist() for (k, v) in camera_poses[i].items()}

    return camera_poses

def camera_pose_to_internal(serialized_camera_poses):
    for i in range(0, len(serialized_camera_poses)):
        serialized_camera_poses[i] = {k: np.array(v) for (k, v) in serialized_camera_poses[i].items()}

    return serialized_camera_poses

def camera_intrinsics_to_serializable(intrinsics):
    new_intrinsics = []
    for i in range(0, len(intrinsics)):
        new_intrinsics += [intrinsics[i].tolist()]

    return new_intrinsics

def camera_distortion_to_serializable(distortion):
    new_distortion = []
    for i in range(0, len(distortion)):
        new_distortion += [distortion[i].tolist()]

    return new_distortion    

def undistort_image_points(image_points, optimal_matrices, intrinsic_matrices, distortion_coefs):
    fixed = copy.deepcopy(image_points)
    for i, image_point_set in enumerate(image_points):
        for j in range(0, len(image_point_set)):
            wrapped_point = np.array(image_point_set[j], np.float32)
            undistorted = cv.undistortPoints(wrapped_point, intrinsic_matrices[j], np.array([distortion_coefs[j]]), np.eye(3), optimal_matrices[j])
            fixed[i][j] = undistorted[0][0]
    return fixed
# Opportunity for performance improvements here. This doesn't change
# for a given capture but is recalculated fairly deep down the run loop
def camera_poses_to_projection_matrices(camera_poses, intrinsic_matrices):
    Ps = []
    for i, camera_pose in enumerate(camera_poses):
        RT = np.c_[camera_pose["R"], camera_pose["t"]]
        P = intrinsic_matrices[i] @ RT
        Ps.append(P)
    return Ps

def make_square(img):
    x, y, _ = img.shape
    size = max(x, y)
    new_img = np.zeros((size, size, 3), dtype=np.uint8)
    ax, ay = (size - img.shape[1]) // 2, (size - img.shape[0]) // 2
    new_img[ay : img.shape[0] + ay, ax : ax + img.shape[1]] = img

    # Pad the new_img array with edge pixel values
    # Apply feathering effect
    feather_pixels = 8
    for i in range(feather_pixels):
        alpha = (i + 1) / feather_pixels
        new_img[ay - i - 1, :] = img[0, :] * (1 - alpha)  # Top edge
        new_img[ay + img.shape[0] + i, :] = img[-1, :] * (1 - alpha)  # Bottom edge

    return new_img

def align_plane_to_axis(world_points, to_world_matrix, axis='z'):
    """
    Calculates a new to-world matrix that aligns a plane, defined by a set of points, to a specified world axis.

    Args:
        world_points (np.ndarray): A NumPy array of shape (N, 3) representing N points in WORLD space that lie on a plane.
        to_world_matrix (np.ndarray): The original 4x4 'to-world' matrix that was used to transform the points into world space.
        axis (str): The world axis to align the plane's normal to. Can be 'x', 'y', or 'z'.

    Returns:
        np.ndarray: A new 4x4 'to-world' matrix that, if applied to the original local points, would align them correctly.
    """
    # --- 1. Find the normal of the plane in world coordinates ---
    centroid = np.mean(world_points, axis=0)
    centered_points = world_points - centroid
    
    try:
        _, _, vh = np.linalg.svd(centered_points)
        plane_normal = vh[2, :]
        plane_normal /= np.linalg.norm(plane_normal)
    except np.linalg.LinAlgError:
        # If SVD fails, return the original matrix
        return to_world_matrix

    # --- 2. Define the target axis vector ---
    if axis.lower() == 'x':
        target_axis = np.array([1.0, 0.0, 0.0])
    elif axis.lower() == 'y':
        target_axis = np.array([0.0, 1.0, 0.0])
    else: # Default to 'z'
        target_axis = np.array([0.0, 0.0, 1.0])

    # Ensure the normal points in a consistent direction relative to the target.
    if np.dot(plane_normal, target_axis) < 0:
        plane_normal *= -1

    # --- 3. Calculate the rotation matrix to align the plane's normal with the target axis ---
    rotation_axis = np.cross(plane_normal, target_axis)
    rotation_axis_norm = np.linalg.norm(rotation_axis)
    
    if np.isclose(rotation_axis_norm, 0):
        # Normal is already aligned with the target axis
        rotation_matrix = np.identity(3)
    elif np.isclose(rotation_axis_norm, 1.0) and np.isclose(np.dot(plane_normal, target_axis), -1.0):
        # Normal is anti-parallel to the target axis (180-degree rotation)
        # We need a special case for 180-degree rotation to find a perpendicular axis
        if not np.isclose(abs(plane_normal[2]), 1.0): # if not aligned with Z
            perp_axis = np.array([0, 0, 1])
        else: # if aligned with Z, use Y
            perp_axis = np.array([0, 1, 0])
        rotation_axis = np.cross(plane_normal, perp_axis)
        rotation_axis /= np.linalg.norm(rotation_axis)
        angle = np.pi
        K = np.array([[0, -rotation_axis[2], rotation_axis[1]],
                      [rotation_axis[2], 0, -rotation_axis[0]],
                      [-rotation_axis[1], rotation_axis[0], 0]])
        rotation_matrix = np.identity(3) + np.sin(angle) * K + (1 - np.cos(angle)) * (K @ K)
    else:
        rotation_axis /= rotation_axis_norm
        cos_angle = np.dot(plane_normal, target_axis)
        angle = np.arccos(np.clip(cos_angle, -1.0, 1.0))

        K = np.array([[0, -rotation_axis[2], rotation_axis[1]],
                      [rotation_axis[2], 0, -rotation_axis[0]],
                      [-rotation_axis[1], rotation_axis[0], 0]])
        rotation_matrix = np.identity(3) + np.sin(angle) * K + (1 - np.cos(angle)) * (K @ K)

    # --- 4. Construct the new 'to-world' matrix ---
    # The new transformation is the alignment rotation applied AFTER the original transformation.
    # M_new = R_align * M_orig
    alignment_matrix_4x4 = np.identity(4)
    alignment_matrix_4x4[:3, :3] = rotation_matrix
    
    # The translation of the original matrix should be preserved relative to the alignment.
    # We apply the alignment rotation to the original translation vector.
    final_to_world_matrix = alignment_matrix_4x4 @ to_world_matrix
    
    return final_to_world_matrix