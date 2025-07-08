import numpy as np

intrinsic_cam1 = np.array([
    [274.3007,   0.        , 168.9204],
    [  0.        , 274.2703, 107.6927],
    [  0.        ,   0.        ,   1.        ]
])
dist_cam1 = np.array(
    [-0.0972,    0.1248,-0.0005,   -0.0009,0]
)
intrinsic_cam2 = np.array([
    [276.6698,   0.        , 164.4203],
    [  0.        , 276.7238, 116.5915],
    [  0.        ,   0.        ,   1.        ]
])
dist_cam2 = np.array([-0.1201,0.1941,-0.0010,0.0018 ,0])

intrinsic_cam3 = np.array([
    [273.3291,         0,  159.3416],
    [ 0,        273.5450,  128.3456],
    [ 0,         0,         1.0000]
])
dist_cam3 = np.array([-0.1133, 0.2085, 0.0011, -0.0013, 0])

intrinsic_cam4 = np.array([
    [274.8981,   0.        , 146.5635],
    [  0.        , 274.9277, 115.1022],
    [  0.        ,   0.        ,   1.        ]
])
dist_cam4 = np.array([-0.1265,0.1176,    0.0005,    0.0009,0])
intrinsic_matrices = [intrinsic_cam1, intrinsic_cam2, intrinsic_cam3,  intrinsic_cam4]
distortion_coefs = [dist_cam1, dist_cam2, dist_cam3,  dist_cam4]
