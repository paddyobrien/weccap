import numpy as np
from helpers import triangulate_points, undistort_image_points, calculate_reprojection_errors, bundle_adjustment, bundle_adjustment2, camera_poses_to_projection_matrices
from settings import intrinsic_matrices, distortion_coefs
import cv2 as cv

poses = [{"R":[[1,0,0],[0,1,0],[0,0,1]],"t":[0,0,0]},{"R":[[-0.019481010588984604,0.5862511379900401,-0.8098951126113891],[-0.6014000756404223,0.6402462493929415,0.4779149392496175],[0.7987104852486451,0.49638124797745353,0.3400988347675123]],"t":[0.20326571755116052,-0.12386223289119369,0.16594667723137488]},{"R":[[-0.9982896781772183,-0.04977323662642176,0.030665018515512007],[0.013789737146191416,0.309254207941227,0.9508794234917926],[-0.05681163256117021,0.9496759762078721,-0.30803892387060444]],"t":[-0.004147480187948488,-0.2389287127814336,0.3409623152189905]},{"R":[[0.10059491378569024,-0.6499412307584526,0.753297457768601],[0.6643576500391776,0.6074864699239377,0.4354183065671148],[-0.7406143234875159,0.4566580618138043,0.49290347779822835]],"t":[-0.2154090400696536,-0.13084284431588816,0.13810896221792715]}]

image_points = [[[173,136],[111,171],[148,219],[184,171]],[[184,169],[118,193],[133,248],[179,215]],[[193,222],[233,146],[138,116],[50,167]],[[157,140],[107,193],[169,229],[184,164]],[[179,127],[90,170],[139,246],[207,180]],[[245,229],[208,140],[96,148],[64,240]],[[295,226],[228,99],[73,107],[14,241]],[[182,235],[252,146],[147,103],[34,152]],[[173,229],[236,163],[151,122],[55,161]],[[159,147],[128,182],[165,202],[164,159]],[[117,112],[81,210],[225,219],[192,114]],[[182,158],[171,148],[142,151],[121,157]],[[152,259],[194,249],[167,209],[103,215]]]

projection_matrices = camera_poses_to_projection_matrices(poses, intrinsic_matrices)
new_poses = bundle_adjustment(image_points, poses, intrinsic_matrices)
projection_matrices = camera_poses_to_projection_matrices(new_poses, intrinsic_matrices)
object_points = triangulate_points(image_points, projection_matrices)
old_error = np.mean(
    calculate_reprojection_errors(image_points, object_points, new_poses, intrinsic_matrices)
)


parsed_poses, parsed_intrinsics, parsed_distortion_coefs = bundle_adjustment2(image_points, intrinsic_matrices, distortion_coefs, poses)
projection_matrices = camera_poses_to_projection_matrices(parsed_poses, parsed_intrinsics)
optimal_matrices = []
dimensions = (320, 240)
for i in range(0, 4):
    opt, _ = cv.getOptimalNewCameraMatrix(parsed_intrinsics[i], parsed_distortion_coefs[i], dimensions, 1, dimensions)
    optimal_matrices.append(opt)
fixed_image_points = []
for i in range(0, len(image_points)):
    fixed_image_points = fixed_image_points + undistort_image_points(
            [image_points[i]],
            optimal_matrices,
            parsed_intrinsics,
            parsed_distortion_coefs
        )

object_points = triangulate_points(fixed_image_points, projection_matrices)

error = np.mean(
    calculate_reprojection_errors(fixed_image_points, object_points, parsed_poses, parsed_intrinsics)
)
print(poses)
print('---')
print(parsed_poses)
print('----')
print(intrinsic_matrices)
print('----')
print(parsed_intrinsics)
print('----')
print(distortion_coefs)
print('----')
print(parsed_distortion_coefs)
print("Error")
print(error)
print(old_error)

parsed_poses, parsed_intrinsics, parsed_distortion_coefs = bundle_adjustment2(image_points, parsed_intrinsics, parsed_distortion_coefs, parsed_poses)
projection_matrices = camera_poses_to_projection_matrices(parsed_poses, parsed_intrinsics)
object_points = triangulate_points(image_points, projection_matrices)

error = np.mean(
    calculate_reprojection_errors(image_points, object_points, parsed_poses, parsed_intrinsics)
)
print(error)