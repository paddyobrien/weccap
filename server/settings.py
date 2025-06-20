import numpy as np

# Wide angle camera intrinsics
# These should be moved to a config file that gets supplied at run time along with pose etc

intrinsic_cam1 = np.array([
    [269.60149458,   0.        , 161.17399446],
    [  0.        , 268.76832498, 110.62351558],
    [  0.        ,   0.        ,   1.        ]
])
dist_cam1 = np.array(
    [-0.11594409,  0.20672174,  0.00050569,  0.00236076, -0.17231847]
)
intrinsic_cam2 = np.array([
    [270.77185267,   0.        , 161.92508832],
    [  0.        , 271.05980616, 119.70350716],
    [  0.        ,   0.        ,   1.        ]
])
dist_cam2 = np.array([-7.84220964e-02, -3.24701252e-01, -1.63485420e-03, 4.38231036e-03,  1.79162712e+00])

intrinsic_cam3 = np.array([
    [276.85860439,   0.        , 161.15361457],
    [  0.        , 277.00776249, 119.91361077],
    [  0.        ,   0.        ,   1.        ]
])
dist_cam3 = np.array([-1.52580854e-01,  4.44500655e-01, -1.04290286e-03, 3.19758041e-04, -6.29002678e-01])

intrinsic_cam4 = np.array([
    [277.20367403,   0.        , 163.71637634],
    [  0.        , 277.36269868, 121.88418794],
    [  0.        ,   0.        ,   1.        ]
])
dist_cam4 = np.array([-0.1097657 ,  0.04591435, -0.00058153,  0.00035238,  0.14757552])
intrinsic_matrices = [intrinsic_cam1, intrinsic_cam2, intrinsic_cam3, intrinsic_cam4]
distortion_coefs = [dist_cam1, dist_cam2, dist_cam3, dist_cam4]