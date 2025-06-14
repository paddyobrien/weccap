import numpy as np

# Tele camera intrinsics
# These should be moved to a config file that gets supplied at run time along with pose etc

intrinsic_cam1 = np.array([
    [394.342648876422,	0,	173.510520582010],
    [0,	395.004596733472,	97.7887276199817],
    [0,	0,	1]
])
dist_cam1 = np.array(
    [-1.91999111e-01,  1.09874020e+00, -8.54582436e-03, 2.31582822e-03, -2.35064845e+00]
)
intrinsic_cam2 = np.array([
    [400.7332728 ,   0.        , 164.65403644],
    [  0        , 402.4286515 ,  99.00909403],
    [  0        ,   0        ,   1.        ]
])
dist_cam2 = np.array([[-0.09168564, -0.04109043, -0.01413367,  0.00530096,  1.53628006]])

intrinsic_cam3 = np.array([
    [398.73728759,   0.        , 163.54267472],
    [  0        , 400.55758471, 113.21053611],
    [  0        ,   0.        ,   1        ]
])
dist_cam3 = np.array([-0.09153369,  0.07341498, -0.01170632,  0.00190466, -0.03124566])

intrinsic_cam4 = np.array([
    [400.56560589,   0.        , 178.71692749],
    [  0.        , 401.89252404, 119.11271669],
    [  0.        ,   0.        ,   1.        ]
])
dist_cam4 = np.array([-1.54607707e-01,  1.48172924e+00, -3.55744281e-03, 5.11533754e-03, -7.11575958e+00])
intrinsic_matrices = [intrinsic_cam1, intrinsic_cam2, intrinsic_cam3, intrinsic_cam4]
distortion_coefs = [dist_cam1, dist_cam2, dist_cam3, dist_cam4]