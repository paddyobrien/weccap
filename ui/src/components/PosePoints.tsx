import React, { useEffect, useRef } from 'react'

function numberOfAngles(point: Array<Array<number>>){
    let notNull = 0;
    point.forEach((cam) => {
        if (cam[0] != null) {
            notNull++;
        }
    })
    return notNull;
}

const WIDTH = 320;

export default function PosePoints({numCams, points}:{numCams: number, points: Array<Array<Array<number>>>}){
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current!;
    if (numCams > 0) {
        const context = canvas.getContext('2d')!;
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.fillStyle =  "#FFFFFF";
        context.fillRect(WIDTH, 0, 1, canvas.height)
        context.fillRect(WIDTH * 2, 0, 1, canvas.height)
        context.fillRect(WIDTH * 3, 0, 1, canvas.height)
        points.forEach((point) => {
            let angles = numberOfAngles(point);
            if (angles == numCams) {
                context.fillStyle =  "#00FF00";
            } else if (angles == numCams-1) {
                context.fillStyle = "#0000FF";
            } else {
                context.fillStyle = "#FF0000";
            }
            let offset = 0
            point.forEach((coords) => {
                if (coords[0] !== null) {
                    context.fillRect(coords[0] + offset - 1, coords[1] - 1, 4, 4);
                }
                offset += WIDTH;
            })
        });
    }
  }, [points, numCams])
  
  return <canvas style={{position: "absolute", left: 10, zIndex: 100}} ref={canvasRef} width={numCams * WIDTH} height={WIDTH}/>
}