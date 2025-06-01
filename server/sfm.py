from typing import List, Tuple
import numpy as np
import cv2 as cv

def essential_from_fundamental(F: np.ndarray, K1: np.ndarray, K2: np.ndarray) -> np.ndarray:
    """
    Calculate the essential matrix from the fundamental matrix (F) and camera matrices (K1, K2).
    Adapted and modified from OpenCV's essentialFromFundamental function in the opencv_sfm module
    """

    assert F.shape == (3, 3), "F must be a 3x3 matrix"
    assert K1.shape == (3, 3), "K1 must be a 3x3 matrix"
    assert K2.shape == (3, 3), "K2 must be a 3x3 matrix"

    E = np.dot(np.dot(K2.T, F), K1)
    return E

def fundamental_from_projections(P1: np.ndarray, P2: np.ndarray) -> np.ndarray:
    """
    Calculate the fundamental matrix from the projection matrices (P1, P2).
    
    Adapted and modified from OpenCV's fundamentalFromProjections function in the opencv_sfm module
    """

    assert P1.shape == (3, 4), "P1 must be a 3x4 matrix"
    assert P2.shape == (3, 4), "P2 must be a 3x4 matrix"

    F = np.zeros((3, 3))

    X = np.array([
        np.vstack((P1[1, :], P1[2, :])),
        np.vstack((P1[2, :], P1[0, :])),
        np.vstack((P1[0, :], P1[1, :]))
    ])

    Y = np.array([
        np.vstack((P2[1, :], P2[2, :])),
        np.vstack((P2[2, :], P2[0, :])),
        np.vstack((P2[0, :], P2[1, :]))
    ])

    for i in range(3):
        for j in range(3):
            XY = np.vstack((X[j], Y[i]))
            F[i, j] = np.linalg.det(XY)

    return F

def motion_from_essential(E: np.ndarray) -> Tuple[List[np.ndarray], List[np.ndarray]]:
    """
    Calculate the possible rotations and translations from the essential matrix (E).
    Adapted and modified from OpenCV's motionFromEssential function in the opencv_sfm module
    """
    assert E.shape == (3, 3), "Essential matrix must be 3x3."

    _, R1, R2, t = cv.decomposeEssentialMat(E)

    rotations_matrices = [R1, R1, R2, R2]
    translations = [t, -t, t, -t]

    return rotations_matrices, translations

