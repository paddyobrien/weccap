import JSZip from "JSZip"

function createCSV(data: [][], times: []) {
    const lines = data.map((row, idx) => {
        return `${times[idx]},${row.join(",")}`
    })
    
    return new Blob([lines.join("\n")], { type: 'text/plain' });
}

function createJSONL(data: [][], times: []) {
    const lines = [
        JSON.stringify(times),
        JSON.stringify(data)
    ]
    return new Blob([lines.join("\n")], { type: 'text/plain' });
}

function createJSON(data: any) {
    return new Blob([JSON.stringify(data)], { type: 'text/plain' });
}

function saveAs(blob, name) {
    const link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link);
    const objectURL = URL.createObjectURL(blob);

    link.href = objectURL;
    link.href = URL.createObjectURL(blob);
    link.download = `${name}.zip`;
    link.click();
    document.body.removeChild(link)
}

export function createZipFile(captureName, times, objectPoints, errors, imagePoints, cameraPoses, intrinsicMatrices, distortionCoefs, toWorldCoordsMatrix, setPercentageComplete, setCurrentFile) {
    const zip = new JSZip();
    zip.file(`${captureName}/camera_poses.json`, createJSON(cameraPoses));
    zip.file(`${captureName}/world_matrix.json`, createJSON(toWorldCoordsMatrix));
    zip.file(`${captureName}/intrinsics.json`, createJSON(intrinsicMatrices));
    zip.file(`${captureName}/distortion_coefs.json`, createJSON(distortionCoefs));
    zip.file(`${captureName}/object_points.csv`, createCSV(objectPoints, times));
    zip.file(`${captureName}/object_errors.csv`, createCSV(errors, times));
    zip.file(`${captureName}/image_points.jsonl`, createJSONL(imagePoints, times));
    zip.generateAsync({type:"blob"}, (p) => {setPercentageComplete(p.percent);setCurrentFile(p.currentFile)}).then(function (blob) { 
        setCurrentFile("")
        setPercentageComplete(0)
        saveAs(blob, captureName);
    })

}
