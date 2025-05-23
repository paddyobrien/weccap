from scipy.spatial.transform import Rotation
import numpy as np
import json


# convert the camera pose rotation matrix into to a euler rotation
# which is vaguely human readable and therefore useful for sanity checking values
pose = [{"R":[[1,0,0],[0,1,0],[0,0,1]],"t":[0,0,0]},{"R":[[0.1336878425448369,0.5768396979487742,-0.8058433617186863],[-0.6560370555190509,0.6609802031655355,0.36430832108138966],[0.7427940108412293,0.4799595127649978,0.4667932342748611]],"t":[2.1568866496633623,-1.1172496162568326,1.5563865595763733]},{"R":[[-0.985445243268722,-0.03470853989653071,-0.16641210826529607],[-0.16757278691493932,0.36294423528862846,0.9166192465556859],[0.028583799688110367,0.9311642171652668,-0.36347787699719275]],"t":[0.4361478810912285,-2.500638283908064,3.949710888263557]},{"R":[[-0.09974230566641201,-0.5740253356503455,0.8127400485344967],[0.4587398641860521,0.6982947736468677,0.5494926260688421],[-0.8829548173416975,0.4276439209540784,0.19367877375724857]],"t":[-2.4309752026628018,-1.7721315196970113,2.3499929584939023]}]
human = []

def humanize(mat):
    r = Rotation.from_matrix(mat)
    return r.as_euler("xyz", degrees=True)

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

for i, p in enumerate(pose):
    human.append({
        "R": humanize(p["R"]),
        "t": p["t"]
    })

print(json.dumps(human, indent=2, cls=NumpyEncoder))