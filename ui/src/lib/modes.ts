
// This enum is also defined in cameras.py in the back end, keep them in sync
export enum Modes {
    Initializing = -1,
    CamerasNotFound = 0,
    CamerasFound = 1,
    SaveImage = 2,
    ImageProcessing = 3,
    PointCapture = 4,
    Triangulation = 5,
    ObjectDetection = 6,
}