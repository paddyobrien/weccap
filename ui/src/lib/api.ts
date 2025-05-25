export async function bundleAdjustment(imagePoints, cameraPose) {
    const response = await fetch("http://localhost:3001/api/bundle_adjustment", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({imagePoints, cameraPose})
    });
    const json = await response.json();
    return json
}