import * as React from 'react';
import rgbx from './rgbx';
import { WebGLSortRenderer } from './webGLRenderer';
import testimg from './cat.jpg';
export default class App extends React.Component {
    constructor (props) {
        super(props);
        this.canvasWrapper = React.createRef();
        this.canvas = React.createRef();
        this.renderer = null;
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
            scale: 1,
            offset: { x: 0, y: 0 },
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
        this.handleScroll = this.handleScroll.bind(this);
        this.drawCanvas = this.drawCanvas.bind(this);
        this.drawSelectionOverlays = this.drawSelectionOverlays.bind(this);
        this.getMousePosition = this.getMousePosition.bind(this);
        this.handleKeypress = this.handleKeypress.bind(this);
        this.sort = this.sort.bind(this);
    }

    componentDidMount () {

        let webGLCanvas = document.createElement('canvas');
        this.renderer = new WebGLSortRenderer(webGLCanvas);

        window.addEventListener('keydown', this.handleKeypress)

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

        this.drawCanvas();
        // let ctx = this.canvas.current.getContext('2d');

        // let newMatrix = this.state.matrix;
        // let newWidth = newMatrix[0].length;
        // let newHeight = newMatrix.length;

        // this.canvas.current.width = newWidth;
        // this.canvas.current.height = newHeight;

        // let imageBuffer = rgbx.matrixToBuffer(newMatrix);
        // let imageData = new ImageData(imageBuffer, newWidth, newHeight);
        // ctx.putImageData(imageData, 0, 0);

        // let { isDrawing, currentTool, tempSelectionRect, selectionMask } = this.state;
        // // console.log(tempSelectionRect)
        // if(tempSelectionRect && isDrawing && currentTool == 'rectangle') {
        //     ctx.strokeStyle = 'rgba(255, 0, 0, 255)';
        //     ctx.lineWidth = 2;
        //     ctx.strokeRect(tempSelectionRect.x, tempSelectionRect.y, tempSelectionRect.width, tempSelectionRect.height);
        // } else if(selectionMask) {
        //     ctx.fillStyle = 'rgba(255, 0, 255, 0.3)';
        //     for(let y = 0; y < selectionMask.length; y++) {
        //         for(let x = 0; x < selectionMask[y].length; x++) {
        //             if(selectionMask[y][x]) {
        //                 ctx.fillRect(x, y, 1, 1);
        //             }
        //         }
        //     }
        // }
    }

    componentWillUnmount () {
        window.removeEventListener(keydown, this.handleKeypress);
    }

    handleKeypress (event) {
        if(event.code == 'Space') {
            event.preventDefault();
            this.resetView();
        }
    }

    resetView () {
        let mainCanvas = this.canvas.current;
        if(!mainCanvas) return;

        let { width, height } = this.state;

        let centeredOffsetX = (mainCanvas.width - width);
        let centeredOffsetY = (mainCanvas.height - height);

        this.setState({
            scale: 1,
            offset: { x: centeredOffsetX, y: centeredOffsetY }
        })
    }

    invert () {
        let newMatrix = rgbx.invert(this.state.matrix, this.state.selectionMask);
        this.setState({ matrix: newMatrix });
    }

    sort () {
        let newMatrix = rgbx.sortPixels(this.state.matrix, this.state.selectionMask, 'ascending', this.renderer);
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

    getMousePosition (event) {
        let { scale, offset } = this.state;
        let imageX = (event.nativeEvent.offsetX - offset.x) / scale;
        let imageY = (event.nativeEvent.offsetY - offset.y) / scale;
        return { x: Math.floor(imageX), y: Math.floor(imageY) };
    }

    drawCanvas () {
        let { matrix, scale, offset } = this.state;
        let mainCanvas = this.canvas.current;
        if(!mainCanvas || !matrix || matrix.length == 0) return;

        let mainCTX = mainCanvas.getContext('2d');

        let hiddenCanvas = document.createElement('canvas');
        let hiddenCTX = hiddenCanvas.getContext('2d');
        hiddenCanvas.width = this.state.width;
        hiddenCanvas.height = this.state.height;

        let imageBuffer = rgbx.matrixToBuffer(matrix);
        let imageData = new ImageData(imageBuffer, this.state.width, this.state.height);
        hiddenCTX.putImageData(imageData, 0, 0);

        mainCTX.fillStyle = '#CCCCCC';
        mainCTX.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

        mainCTX.drawImage(
            hiddenCanvas,
            offset.x,
            offset.y,
            this.state.width * scale,
            this.state.height * scale,
        );

        this.drawSelectionOverlays(mainCTX);
    }

    drawSelectionOverlays (ctx) {
        let { scale, offset, selectionMask, isDrawing, currentTool, tempSelectionRect } = this.state;
        if(!selectionMask && !tempSelectionRect) return;

        ctx.save();

        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);

        if(!isDrawing && currentTool == 'rectangle' && tempSelectionRect) {
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.9)';
            ctx.lineWidth = 1 / scale;
            ctx.strokeRect(tempSelectionRect.x, tempSelectionRect.y, tempSelectionRect.width, tempSelectionRect.height);
        } else if(selectionMask) {
            ctx.fillStyle = 'rgba(0, 150, 255, 0.3)';
            for(let y = 0; y < selectionMask.length; y++) {
                for(let x = 0; x < selectionMask[y].length; x++) {
                    if(selectionMask[y][x]) {
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            }
        }

        ctx.restore()
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

        if(event.button == 1) {
            event.preventDefault();
            this.setState({
                isPanning: true,
                previousPoint: { x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY }
            });
            return;
        }

        let pos = this.getMousePosition(event);

        // let { offsetX, offsetY } = event.nativeEvent;
        // let startPoint = { x: Math.floor(offsetX), y: Math.floor(offsetY) };

        this.setState({ 
            isDrawing: true,
            startPoint: pos,
            previousPoint: pos,
            selectionMask: null,
            tempSelectionRect: null,
        })

        if(this.state.currentTool == 'lasso') {
            let newMask = rgbx.createMask(this.state.width, this.state.height);
            if(newMask[pos.y]?.[pos.x] != undefined) {
                newMask[pos.y][pos.x] = true;
                this.setState({ selectionMask: newMask })
            }
        }
    }

    handleMouseUp (event) {
        if(this.state.isPanning) {
            this.setState({ isPanning: false });
            return;
        }

        if(!this.state.isDrawing) return;
        let pos = this.getMousePosition(event);

        let { currentTool, startPoint, previousPoint } = this.state;

        this.setState({ isDrawing: false, tempSelectionRect: null });

        if (currentTool == 'rectangle') {
            // let { offsetX, offsetY } = event.nativeEvent;
            // let endPoint = { x: Math.floor(offsetX), y: Math.floor(offsetY) };
            this.finalizeRectangleSelection(pos);
        } else if (currentTool == 'lasso') {
            this.drawLine(previousPoint, startPoint, () => {
                this.fillSelectionMask();
            });
        }
    }

    handleMouseMove (event) {
        if(this.state.isPanning) {
            let { previousPoint, offset } = this.state;
            let { offsetX, offsetY } = event.nativeEvent;
            let dx = offsetX - previousPoint.x;
            let dy = offsetY - previousPoint.y;

            this.setState({
                offset: { x: offset.x + dx, y: offset.y + dy },
                previousPoint: { x: offsetX, y: offsetY },
            });
            return;
        }

        if(!this.state.isDrawing) return;
        let pos = this.getMousePosition(event);

        let { currentTool, startPoint, previousPoint } = this.state;
        // let { offsetX, offsetY } = event.nativeEvent;
        // let currentPoint = { x: Math.floor(offsetX), y: Math.floor(offsetY) }


        if(currentTool == 'lasso') {
            if(previousPoint) {
                this.drawLine(previousPoint, pos);
            }

            this.setState({ previousPoint: pos });
        } else if (currentTool == 'rectangle') {
            let rect = {
                x: Math.min(startPoint.x, pos.x),
                y: Math.min(startPoint.y, pos.y),
                width: Math.abs(startPoint.x - pos.x),
                height: Math.abs(startPoint.y - pos.y),
            }

            this.setState({ tempSelectionRect: rect });
        }
    }

    handleScroll (event) {
        // event.preventDefault();

        let { offsetX, offsetY } = event.nativeEvent;
        let { scale, offset } = this.state;

        let zoomSensitivity = 0.1;
        let direction = event.deltaY < 0 ? 1 : -1;
        let newScale = Math.max(0.1, Math.min(scale + direction * zoomSensitivity, 10))

        let worldX = (offsetX - offset.x) / scale;
        let worldY = (offsetY - offset.y) / scale;

        let newOffsetX = offsetX - worldX * newScale;
        let newOffsetY = offsetY - worldY * newScale;

        this.setState({
            scale: newScale,
            offset: { x: newOffsetX, y: newOffsetY }
        })
    }

    changeTool (newTool) {
        this.setState({ currentTool: newTool }, () => {
            this.canvas.current.classList.value = 'canvas';
            switch (newTool) {
                case 'rectangle':
                    this.canvas.current.classList.add('rectangle-cursor');
                case 'lasso':
                    this.canvas.current.classList.add('lasso-cursor');
            }   

        });

    }

    render() {
        return (
            <div className='main-wrapper'>
                <div className='tools-wrapper'>
                    <div className='utility-wrapper'>
                        <button className='tool' onClick={this.zoomIn}>zoom in</button>
                        <button className='tool' onClick={this.zoomOut}>zoom out</button>
                        <button className='tool' onClick={()=>{this.changeTool('rectangle')}}>rectangle</button>
                        <button className='tool' onClick={()=>{this.changeTool('lasso')}}>lasso</button>
                    </div>
                    <div className='style-wrapper'>
                        <button className='tool' onClick={this.invert}>invert</button>
                        <button className='tool' onClick={this.sort}>sort</button>
                    </div>
                </div>
                <div id='canvas-wrapper' className='canvas-wrapper' ref={this.canvasWrapper}>
                    <canvas
                        className='canvas'
                        ref={this.canvas}
                        onMouseDown={this.handleMouseDown}
                        onMouseUp={this.handleMouseUp}
                        onMouseLeave={this.handleMouseUp}
                        onMouseMove={this.handleMouseMove}
                        onWheel={this.handleScroll}
                    >
                    </canvas>
                </div>
                
                <div>
                    
                </div>
            </div>
        )
    }

}