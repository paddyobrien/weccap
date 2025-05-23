from scipy.spatial.transform import Rotation
import numpy as np
import json
import math

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

# Generate an extrinsic matrix based on the geometry of the motion capture
# assumes a square arrangement on a single plane

side = 0.31
depth = 0.27
half_side = side/2
y_angle = 45
x_angle = math.degrees(math.atan(depth/half_side)) * -1

def create_rotation(x_angle, y_angle):
    r = Rotation.from_euler("xyz", [x_angle, y_angle, 0], degrees=True)
    return r.as_matrix()


pose = [
    {
        "R": create_rotation(x_angle, y_angle),
        "t": [-half_side, -side, -half_side]
    },
    {
        "R": create_rotation(x_angle, -y_angle),
        "t": [half_side, -side, -half_side]
    },
    {
        "R": create_rotation(x_angle, y_angle - 180),
        "t": [half_side, -side, half_side]
    },
    {
        "R": create_rotation(x_angle, -y_angle - 180),
        "t": [-half_side, -side, half_side]
    },
]

print(json.dumps(pose, cls=NumpyEncoder))
