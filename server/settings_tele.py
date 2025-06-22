import numpy as np

# Tele camera intrinsics
# These should be moved to a config file that gets supplied at run time along with pose etc

intrinsic_cam1 = np.array([
    [400,	0,	160],
    [0,	400,	120],
    [0,	0,	1]
])
dist_cam1 = np.array(
    [0,0,0,0,0]
)
intrinsic_cam2 = np.array([
    [400,	0,	160],
    [0,	400,	120],
    [0,	0,	1]
])
dist_cam2 = np.array([0,0,0,0,0])

intrinsic_cam3 = np.array([
    [400,	0,	160],
    [0,	400,	120],
    [0,	0,	1]
])
dist_cam3 = np.array([0,0,0,0,0])

intrinsic_cam4 = np.array([
    [400,	0,	160],
    [0,	400,	120],
    [0,	0,	1]
])
dist_cam4 = np.array([0,0,0,0,0])
intrinsic_matrices = [intrinsic_cam1, intrinsic_cam2, intrinsic_cam3, intrinsic_cam4]
distortion_coefs = [dist_cam1, dist_cam2, dist_cam3, dist_cam4]