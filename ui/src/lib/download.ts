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

function saveAs(blob, name) {
    const link = document.createElement('a');
    link.style.display = 'none';
    document.body.appendChild(link);
    const objectURL = URL.createObjectURL(blob);

    link.href = objectURL;
    link.href = URL.createObjectURL(blob);
    link.download = `${name}.zip`;
    link.click();
}

export function createZipFile(captureName, times, objectPoints, errors, imagePoints) {
    const zip = new JSZip();
    zip.file(`${captureName}/object_points.csv`, createCSV(objectPoints, times));
    zip.file(`${captureName}/object_errors.csv`, createCSV(errors, times));
    zip.file(`${captureName}/image_points.jsonl`, createJSONL(imagePoints, times));
    zip.generateAsync({type:"blob"}).then(function (blob) { 
        saveAs(blob, captureName);
    })

}
