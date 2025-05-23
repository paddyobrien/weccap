import numpy as np
from helpers import locate_objects 

errors = [
    0.004770214334712364,
    0.005127315787831321,
    0.0030091494700172916
]
object_points = np.array([
    [
        0.8942238779914304,
        2.7251886254281326,
        2.1006745003841627
    ],
    [
        1.0208386601037822,
        2.6844313433828164,
        2.1045057726273995
    ],
    [
        0.8654353439829416,
        2.653146199900489,
        2.1254365743526398
    ]
])

objects = locate_objects(object_points, errors)
print(objects)