import * as React from 'react';
import rgbx from './rgbx';
import testimg from './cat.jpg';
export default class App extends React.Component {
    constructor (props) {
        super(props);
        this.canvasWrapper = React.createRef();
        this.canvas = React.createRef();
        // this.canvas = null;
        this.state = {
            currentTool: 'lasso',
            isDrawing: false,
            matrix: null,
            width: 0,
            height: 0,
            selectionMask: null,
            startPoint: null,
            previousPoint: null,
            tempSelectionRect: null,
        }

        this.invert = this.invert.bind(this);
        this.zoomIn = this.zoomIn.bind(this);
        this.zoomOut = this.zoomOut.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.drawLine = this.drawLine.bind(this);
        this.finalizeRectangleSelection = this.finalizeRectangleSelection.bind(this);
        this.changeTool = this.changeTool.bind(this);
    }

    componentDidMount () {

        let img = new Image();
        img.src = testimg;
        img.onload = () => {

            this.canvas.current.width = img.width;
            this.canvas.current.height = img.height;
            
            let ctx = this.canvas.current.getContext('2d');
            ctx.drawImage(img, 0, 0);

            let data = ctx.getImageData(0, 0, this.canvas.current.width, this.canvas.current.height);
            let buffer = data.data;
            let matrix = rgbx.bufferToMatrix(buffer, this.canvas.current.width, this.canvas.current.height);
            this.setState({ matrix, width: img.width, height: img.height });

            // this.setState({ data, canvas, ctx });
        }
    }

    componentDidUpdate () {
        let ctx = this.canvas.current.getContext('2d');

        let newMatrix = this.state.matrix;
        let newWidth = newMatrix[0].length;
        let newHeight = newMatrix.length;

        this.canvas.current.width = newWidth;
        this.canvas.current.height = newHeight;

        let imageBuffer = rgbx.matrixToBuffer(newMatrix);
        let imageData = new ImageData(imageBuffer, newWidth, newHeight);
        ctx.putImageData(imageData, 0, 0);

        let { isDrawing, currentTool, tempSelectionRect, selectionMask } = this.state;
        // console.log(tempSelectionRect)
        if(tempSelectionRect && isDrawing && currentTool == 'rectangle') {
            ctx.strokeStyle = 'rgba(255, 0, 0, 255)';
            ctx.lineWidth = 2;
            ctx.strokeRect(tempSelectionRect.x, tempSelectionRect.y, tempSelectionRect.width, tempSelectionRect.height);
        } else if(selectionMask) {
            ctx.fillStyle = 'rgba(255, 0, 255, 0.3)';
            for(let y = 0; y < selectionMask.length; y++) {
                for(let x = 0; x < selectionMask[y].length; x++) {
                    if(selectionMask[y][x]) {
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
        }
    }

    invert () {
        let newMatrix = rgbx.invert(this.state.matrix, this.state.selectionMask);
        this.setState({ matrix: newMatrix });
    }

    zoomIn () {
        let newMatrix = rgbx.resize(this.state.matrix, 2.0);
        this.setState({ matrix: newMatrix, width: newMatrix[0].length, height: newMatrix.length });
    }

    zoomOut () {
        let newMatrix = rgbx.resize(this.state.matrix, 0.5);
        this.setState({ matrix: newMatrix, width: newMatrix[0].length, height: newMatrix.length });
    }

    drawLine (start, end, callback) {
        let { x: x0, y: y0 } = start;
        let { x: x1, y: y1 } = end;

        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        let newMask = rgbx.cloneMatrix(this.state.selectionMask);

        while(true) {
            if(newMask[y0] && newMask[y0][x0] != undefined) {
                newMask[y0][x0] = true;
            }

            if((x0 === x1) && (y0 === y1)) break;

            let e2= 2 * err;
            if(e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if(e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
        this.setState({ selectionMask: newMask }, callback);
    }

    finalizeRectangleSelection (endPoint) {
        let { startPoint, width, height } = this.state;
        let rect = {
            x: Math.min(startPoint.x, endPoint.x),
            y: Math.min(startPoint.y, endPoint.y),
            width: Math.abs(startPoint.x - endPoint.x),
            height: Math.abs(startPoint.y - endPoint.y),
        }

        let newMask = rgbx.createMask(width, height);
        for (let y = rect.y; y < rect.y + rect.height; y++) {
            for (let x = rect.x; x < rect.x + rect.width; x++) {
                if (newMask[y] && newMask[y][x] != undefined) {
                    newMask[y][x] = true;
                }
            }
        }

        this.setState({ selectionMask: newMask });
    }

    fillSelectionMask () {
        let mask = this.state.selectionMask;
        if(!mask) return;

        let newMask = rgbx.cloneMatrix(mask);
        let height = newMask.length;
        let width = newMask[0].length;

        for(let y = 0; y < height; y++) {
            let minX = -1, maxX = -1;
            for(let x = 0; x < width; x++) {
                if(newMask[y][x]) {
                    if(minX == -1) minX = x;
                    maxX = x;
                }
            }
            if(minX !== -1) {
                for(let x = minX; x <= maxX; x++) {
                    newMask[y][x] = true;
                }
            }
        }
        this.setState({ selectionMask: newMask })
    }

    handleMouseDown (event) {
        let { offsetX, offsetY } = event.nativeEvent;
        let startPoint = { x: Math.floor(offsetX), y: Math.floor(offsetY) };

        this.setState({ 
            isDrawing: true,
            startPoint: startPoint,
            previousPoint: startPoint,
            selectionMask: null,
            tempSelectionRect: null,
        })

        if(this.state.currentTool == 'lasso') {
            let newMask = rgbx.createMask(this.state.width, this.state.height);
            if(newMask[startPoint.y]?.[startPoint.x] != undefined) {
                newMask[startPoint.y][startPoint.x] = true;
                this.setState({ selectionMask: newMask })
            }
        }
    }

    handleMouseUp (event) {
        if(!this.state.isDrawing) return;

        let { currentTool, startPoint, previousPoint } = this.state;

        this.setState({ isDrawing: false, tempSelectionRect: null });

        if (currentTool == 'rectangle') {
            let { offsetX, offsetY } = event.nativeEvent;
            let endPoint = { x: Math.floor(offsetX), y: Math.floor(offsetY) };
            this.finalizeRectangleSelection(endPoint);
        } else if (currentTool == 'lasso') {
            this.drawLine(previousPoint, startPoint, () => {
                this.fillSelectionMask();
            });
        }
    }

    handleMouseMove (event) {
        if(!this.state.isDrawing) return;

        let { currentTool, startPoint, previousPoint } = this.state;
        let { offsetX, offsetY } = event.nativeEvent;
        let currentPoint = { x: Math.floor(offsetX), y: Math.floor(offsetY) }


        if(currentTool == 'lasso') {
            if(previousPoint) {
                this.drawLine(previousPoint, currentPoint);
            }

            this.setState({ previousPoint: currentPoint });
        } else if (currentTool == 'rectangle') {
            let rect = {
                x: Math.min(startPoint.x, currentPoint.x),
                y: Math.min(startPoint.y, currentPoint.y),
                width: Math.abs(startPoint.x - currentPoint.x),
                height: Math.abs(startPoint.y - currentPoint.y),
            }

            this.setState({ tempSelectionRect: rect });
        }

        // let x = Math.min(startPoint.x, offsetX);
        // let y = Math.min(startPoint.y, offsetY);
        // let width = Math.abs(startPoint.x - offsetX);
        // let height = Math.abs(startPoint.y - offsetY);

        // this.setState({ selection: { x, y, width, height } })
    }

    changeTool (newTool) {
        this.setState({ currentTool: newTool });
    }

    render() {
        return (
            <div>
                <div id='canvas-wrapper' ref={this.canvasWrapper}>
                    <canvas
                        ref={this.canvas}
                        onMouseDown={this.handleMouseDown}
                        onMouseUp={this.handleMouseUp}
                        onMouseLeave={this.handleMouseUp}
                        onMouseMove={this.handleMouseMove}
                    >
                    </canvas>
                </div>
                <button onClick={this.invert}>invert</button>
                <div>
                    <button onClick={this.zoomIn}>zoom in</button>
                    <button onClick={this.zoomOut}>zoom out</button>
                </div>
                <div>
                    <button onClick={()=>{this.changeTool('rectangle')}}>rectangle</button>
                    <button onClick={()=>{this.changeTool('lasso')}}>lasso</button>
                </div>
            </div>
        )
    }

}