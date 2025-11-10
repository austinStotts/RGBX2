import * as React from 'react';
import rgbx from './rgbx';
import { WebGLSortRenderer } from './webGLRenderer';
// import testimg from './debug.png';
import testimg from './cat.jpg';
import ToolModal from './components/ToolModal';
import SaveModal from './components/SaveModal';
import SortModal from './components/SortModal';
import ResizeModal from './components/ResizeModal';
import NewModal from './components/newModal';
import MagicWandModal from './components/MagicWandModal';
import BrushModal from './components/BrushModal';
import PasteModal from './components/PasteModal';


export default class App extends React.Component {
    constructor (props) {
        super(props);
        this.canvasWrapper = React.createRef();
        this.canvas = React.createRef();
        this.dialog = React.createRef();
        this.resizeInput = React.createRef();
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
            resizeScale: 1,
            tempResizeScale: 1,
            isResizeModalOpen: false,
            isSortModalOpen: false,
            isSaveModalOpen: false,
            isNewModalOpen: false,
            isMagicWandModalOpen: false,
            isBrushModalOpen: false,
            isPasteModalOpen: false,
            sortOptions: {
                axis: 'x',
                criterion: 'brightness',
                direction: 'ascending',
            },
            clipboard: null,
            clipboardCanvas: null, // Cache the rendered clipboard canvas
            isPasting: false,
            cursor: { x: 0, y: 0 },
            tolerance: 32,
            contiguous: true,
            brushSettings: {
                type: 'pencil',
                size: 1,
                color: '#000000'
            },
            history: [],
            historyIndex: -1,
            modalPositions: {
                sort: null,
                resize: null,
                save: null,
                new: null,
                magicWand: null,
                brush: null,
                paste: null,
            },
            modalZIndices: {
                sort: 101,
                resize: 101,
                save: 101,
                new: 101,
                magicWand: 101,
                brush: 101,
                paste: 101,
            },
            highestZIndex: 101,
        }

        this.invert = this.invert.bind(this);
        this.resize = this.resize.bind(this);
        this.manageResizeModal = this.manageResizeModal.bind(this);
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
        this.manageSortModal = this.manageSortModal.bind(this);
        this.save = this.save.bind(this);
        this.manageSaveModal = this.manageSaveModal.bind(this);
        this.newCanvas = this.newCanvas.bind(this);
        this.manageNewModal = this.manageNewModal.bind(this);
        this.open = this.open.bind(this);
        this.openDialog = this.openDialog.bind(this);
        this.copy = this.copy.bind(this);
        this.paste = this.paste.bind(this);
        this.drawMaskOverlay = this.drawMaskOverlay.bind(this);
        this.saveToHistory = this.saveToHistory.bind(this);
        this.undo = this.undo.bind(this);
        this.redo = this.redo.bind(this);
        this.manageMagicWandModal = this.manageMagicWandModal.bind(this);
        this.updateMagicWandSettings = this.updateMagicWandSettings.bind(this);
        this.manageBrushModal = this.manageBrushModal.bind(this);
        this.updateBrushSettings = this.updateBrushSettings.bind(this);
        this.bringModalToFront = this.bringModalToFront.bind(this);
        this.closeAllModals = this.closeAllModals.bind(this);
        this.managePasteModal = this.managePasteModal.bind(this);
        this.applyPasteTransformations = this.applyPasteTransformations.bind(this);
    }

    componentDidMount () {

        setInterval(() => {
            this.drawCanvas()
        }, 33)

        // Set canvas to fixed size based on container
        this.resizeCanvas();
        window.addEventListener('resize', this.resizeCanvas.bind(this));

        let webGLCanvas = document.createElement('canvas');
        this.renderer = new WebGLSortRenderer(webGLCanvas);

        window.addEventListener('keydown', this.handleKeypress)

        let img = new Image();
        img.src = testimg;
        img.onload = () => {

            let hiddenCanvas = document.createElement('canvas');
            let ctx = hiddenCanvas.getContext('2d');
            hiddenCanvas.width = img.width;
            hiddenCanvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            let data = ctx.getImageData(0, 0, img.width, img.height);
            let buffer = data.data;
            let matrix = rgbx.bufferToMatrix(buffer, img.width, img.height);

            // Initialize history with the first loaded image
            this.setState({
                matrix,
                width: img.width,
                height: img.height,
                history: [rgbx.cloneMatrix(matrix)],
                historyIndex: 0
            }, () => {
                // Auto-fit image to canvas after loading
                this.fitImageToCanvas();
            });

            // this.setState({ data, canvas, ctx });
        }
    }

    resizeCanvas () {
        if (!this.canvasWrapper.current || !this.canvas.current) return;

        const wrapper = this.canvasWrapper.current;
        const canvas = this.canvas.current;

        // Set canvas to fill the wrapper
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
    }

    fitImageToCanvas () {
        const { width, height } = this.state;
        const canvas = this.canvas.current;
        if (!canvas || !width || !height) return;

        // Calculate scale to fit image in canvas with some padding
        const padding = 40;
        const scaleX = (canvas.width - padding) / width;
        const scaleY = (canvas.height - padding) / height;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%

        // Center the image
        const offsetX = (canvas.width - width * scale) / 2;
        const offsetY = (canvas.height - height * scale) / 2;

        this.setState({
            scale,
            offset: { x: offsetX, y: offsetY }
        });
    }

    componentDidUpdate () {
        // this.drawCanvas();
    }

    componentWillUnmount () {
        window.removeEventListener(keydown, this.handleKeypress);
    }

    manageSaveModal (newState) {
        if(newState) {
            this.bringModalToFront('save');
            this.setState({ isSaveModalOpen: true });
        } else {
            this.setState({ isSaveModalOpen: false });
        }
    }

    save (fileType) {
        if(fileType == 'png') {
            let data = this.canvas.current.toDataURL('image/png');
            window.electron.saveCanvas(data, 'png');
        } else if(fileType == 'jpg') {
            let data = this.canvas.current.toDataURL('image/jpeg');
            window.electron.saveCanvas(data, 'jpg');
        } else {
            let data = this.canvas.current.toDataURL('image/jpeg');
            window.electron.saveCanvas(data, 'jpg');
        }
    }

    open (data) {
        if(data) {
            console.log(data);
            let img = new Image();
            img.onload = () => {

                let hiddenCanvas = document.createElement('canvas');
                let hiddenCTX = hiddenCanvas.getContext('2d');
                hiddenCanvas.width = img.width;
                hiddenCanvas.height = img.height;
                hiddenCTX.drawImage(img, 0, 0);

                let hiddenData = hiddenCTX.getImageData(0, 0, img.width, img.height);
                let buffer = hiddenData.data;
                let matrix = rgbx.bufferToMatrix(buffer, img.width, img.height);

                // Reset history when opening a new file
                this.setState({
                    matrix,
                    width: img.width,
                    height: img.height,
                    history: [rgbx.cloneMatrix(matrix)],
                    historyIndex: 0
                }, () => {
                    // Auto-fit the newly opened image
                    this.fitImageToCanvas();
                });
            }

            img.src = `data:${data.mimeType};base64,${data.data}`;
        } else {
            console.log('error rendering that file')
        }
    }

    async openDialog () {
        console.log('opening from index');
        this.open(await window.electron.openDialog());
    }

    handleKeypress (event) {
        if(event.code == 'Space') {
            event.preventDefault();
            this.resetView();
        }
    }

    resetView () {
        this.fitImageToCanvas();
    }

    invert () {
        this.saveToHistory();
        if(!this.state.selectionMask) {
            let newMatrix = rgbx.invert(this.state.matrix, this.state.matrix);
            this.setState({ matrix: newMatrix });
        } else {
            let newMatrix = rgbx.invert(this.state.matrix, this.state.selectionMask);
            this.setState({ matrix: newMatrix });
        }
    }

    manageSortModal (newState) {
        if(newState) {
            this.bringModalToFront('sort');
            this.setState({ isSortModalOpen: true });
        } else {
            this.setState({ isSortModalOpen: false });
        }
    }

    sort (options = { axis: 'x', criterion: 'brightness', direction: 'ascending' }) {
        this.saveToHistory();
        let { axis, criterion, direction } = options;
        if(!this.state.selectionMask) {
            let newMatrix = rgbx.sortPixels(this.state.matrix, this.state.matrix, axis, criterion, direction, this.renderer);
            this.setState({ matrix: newMatrix });
        } else {
            let newMatrix = rgbx.sortPixels(this.state.matrix, this.state.selectionMask, axis, criterion, direction, this.renderer);
            this.setState({ matrix: newMatrix });
        }
    }

    manageResizeModal (newState) {
        if(newState) {
            this.bringModalToFront('resize');
            this.setState({ isResizeModalOpen: true });
        } else {
            this.setState({ isResizeModalOpen: false });
        }
    }

    resize (scale) {
        this.saveToHistory();
        let newMatrix = rgbx.resize(this.state.matrix, Number(scale))
        this.setState({ matrix: newMatrix, width: newMatrix[0].length, height: newMatrix.length });
    }

    manageNewModal (newState) {
        if(newState) {
            this.bringModalToFront('new');
            this.setState({ isNewModalOpen: true });
        } else {
            this.setState({ isNewModalOpen: false });
        }
    }

    newCanvas (options) {
        let w = options.width;
        let h = options.height;
        let fill = {r: 30, g: 30, b: 255, a: 255}
        let newMatrix = Array(h).fill(null).map(() => Array(w).fill(fill));

        // Reset history when creating a new canvas
        this.setState({
            matrix: newMatrix,
            width: w,
            height: h,
            history: [rgbx.cloneMatrix(newMatrix)],
            historyIndex: 0
        }, () => {
            // Auto-fit the new canvas
            this.fitImageToCanvas();
        })
    }

    manageMagicWandModal (newState) {
        if(newState) {
            this.bringModalToFront('magicWand');
            this.setState({ isMagicWandModalOpen: true });
        } else {
            this.setState({ isMagicWandModalOpen: false });
        }
    }

    updateMagicWandSettings (settings) {
        this.setState({
            tolerance: settings.tolerance,
            contiguous: settings.contiguous
        });
    }

    saveModalPosition (modalName, position) {
        this.setState(prevState => ({
            modalPositions: {
                ...prevState.modalPositions,
                [modalName]: position
            }
        }));
    }

    bringModalToFront (modalName) {
        this.setState(prevState => {
            const newZIndex = prevState.highestZIndex + 1;
            return {
                modalZIndices: {
                    ...prevState.modalZIndices,
                    [modalName]: newZIndex
                },
                highestZIndex: newZIndex
            };
        });
    }

    closeAllModals () {
        // Close all modals and reset to neutral state
        this.setState({
            isSaveModalOpen: false,
            isResizeModalOpen: false,
            isSortModalOpen: false,
            isNewModalOpen: false,
            isMagicWandModalOpen: false,
            isBrushModalOpen: false,
            isPasteModalOpen: false,
            currentTool: 'lasso', // Reset to default tool
        });
    }

    getTopModalName () {
        // Find which modal has the highest z-index
        const { modalZIndices, isSaveModalOpen, isResizeModalOpen, isSortModalOpen,
                isNewModalOpen, isMagicWandModalOpen, isBrushModalOpen, isPasteModalOpen } = this.state;

        let topModal = null;
        let highestZ = -1;

        const openModals = {
            save: isSaveModalOpen,
            resize: isResizeModalOpen,
            sort: isSortModalOpen,
            new: isNewModalOpen,
            magicWand: isMagicWandModalOpen,
            brush: isBrushModalOpen,
            paste: isPasteModalOpen,
        };

        Object.keys(openModals).forEach(modalName => {
            if (openModals[modalName] && modalZIndices[modalName] > highestZ) {
                highestZ = modalZIndices[modalName];
                topModal = modalName;
            }
        });

        return topModal;
    }

    manageBrushModal (newState) {
        if(newState) {
            this.bringModalToFront('brush');
            this.setState({ isBrushModalOpen: true });
        } else {
            this.setState({ isBrushModalOpen: false });
        }
    }

    updateBrushSettings (settings) {
        this.setState({
            brushSettings: settings
        });
    }

    managePasteModal (newState, keepPasting = false) {
        if(newState) {
            this.bringModalToFront('paste');
            this.setState({ isPasteModalOpen: true });
        } else {
            // When closing modal
            if (keepPasting) {
                // Modal confirmed - keep pasting mode active
                this.setState({ isPasteModalOpen: false });
            } else {
                // Modal cancelled - disable pasting mode
                this.setState({
                    isPasteModalOpen: false,
                    isPasting: false,
                    currentTool: 'lasso'
                });
            }
        }
    }

    applyPasteTransformations (transformData) {
        // Apply transformations from modal confirmation
        const { clipboard, mirrorX, mirrorY, rotation, scale } = transformData;

        // Pre-render the clipboard to a canvas for performance
        const clipboardCanvas = this.renderClipboardToCanvas(clipboard);

        // Store the transformed clipboard and keep pasting mode active
        this.setState({
            clipboard: clipboard,
            clipboardCanvas: clipboardCanvas,
            isPasting: true, // Ensure pasting stays active
            pasteTransformations: { mirrorX, mirrorY, rotation, scale }
        });
    }

    renderClipboardToCanvas(clipboard) {
        if (!clipboard || !clipboard.data) return null;

        // Create a canvas with the clipboard data pre-rendered
        let tempCanvas = document.createElement('canvas');
        tempCanvas.width = clipboard.data[0].length;
        tempCanvas.height = clipboard.data.length;
        let tempCtx = tempCanvas.getContext('2d');

        // Draw only the masked pixels
        let tempImageData = tempCtx.createImageData(tempCanvas.width, tempCanvas.height);
        let tempBuffer = tempImageData.data;

        for (let row = 0; row < clipboard.data.length; row++) {
            for (let col = 0; col < clipboard.data[row].length; col++) {
                let index = (row * tempCanvas.width + col) * 4;
                let pixel = clipboard.data[row][col];

                if (pixel && clipboard.mask[row][col]) {
                    // Masked pixel - draw it
                    tempBuffer[index] = pixel.r;
                    tempBuffer[index + 1] = pixel.g;
                    tempBuffer[index + 2] = pixel.b;
                    tempBuffer[index + 3] = pixel.a;
                } else {
                    // Unmasked pixel - make it transparent
                    tempBuffer[index] = 0;
                    tempBuffer[index + 1] = 0;
                    tempBuffer[index + 2] = 0;
                    tempBuffer[index + 3] = 0;
                }
            }
        }

        tempCtx.putImageData(tempImageData, 0, 0);
        return tempCanvas;
    }

    drawBrush (x, y) {
        const { brushSettings, matrix, width, height, selectionMask } = this.state;
        if (!matrix) return;

        // Convert hex color to RGB
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16),
                a: 255
            } : { r: 0, g: 0, b: 0, a: 255 };
        };

        const color = hexToRgb(brushSettings.color);
        const size = brushSettings.size;
        const radius = Math.floor(size / 2);

        // Clone the matrix to avoid direct mutation
        let newMatrix = rgbx.cloneMatrix(matrix);

        // Draw a circle for the brush
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                // Check if point is within circle
                if (dx * dx + dy * dy <= radius * radius) {
                    const px = x + dx;
                    const py = y + dy;

                    // Check bounds
                    if (px >= 0 && px < width && py >= 0 && py < height) {
                        // If there's a selection mask, only draw on selected pixels
                        if (selectionMask) {
                            if (selectionMask[py] && selectionMask[py][px]) {
                                newMatrix[py][px] = { ...color };
                            }
                        } else {
                            // No mask, draw everywhere
                            newMatrix[py][px] = { ...color };
                        }
                    }
                }
            }
        }

        this.setState({ matrix: newMatrix });
    }

    copy () {
        if(!this.state.selectionMask) {
            this.setState({ clipboard: null, clipboardCanvas: null })
            return
        }
        const clipboard = rgbx.extractMaskedRegion(this.state.matrix, this.state.selectionMask);
        // Pre-render the clipboard immediately after copying
        const clipboardCanvas = this.renderClipboardToCanvas(clipboard);
        this.setState({ clipboard, clipboardCanvas });
    }

    paste () {
        // Open paste modal and enable pasting mode if there's clipboard data
        if(this.state.clipboard) {
            // Enable pasting mode immediately so preview shows
            this.setState({ isPasting: true });
            this.managePasteModal(true);
        }
    }

    pasteMouseDown (x, y) {
        let newMatrix = rgbx.pasteMaskedRegion(this.state.matrix, this.state.clipboard, x, y);
        this.saveToHistory();
        this.setState({
            matrix: newMatrix,
            isPasting: false,
            currentTool: 'lasso' // Reset to default tool after pasting
        });
    }

    saveToHistory () {
        const { matrix, history, historyIndex } = this.state;

        // Clone the current matrix to save it
        const matrixSnapshot = rgbx.cloneMatrix(matrix);

        // Remove any "future" history if we're not at the end
        const newHistory = history.slice(0, historyIndex + 1);

        // Add current state to history
        newHistory.push(matrixSnapshot);

        // Limit history to 50 states to prevent memory issues
        const maxHistory = 50;
        if (newHistory.length > maxHistory) {
            newHistory.shift();
            this.setState({
                history: newHistory,
                historyIndex: newHistory.length - 1
            });
        } else {
            this.setState({
                history: newHistory,
                historyIndex: newHistory.length - 1
            });
        }
    }

    undo () {
        const { history, historyIndex } = this.state;

        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const previousMatrix = rgbx.cloneMatrix(history[newIndex]);

            this.setState({
                matrix: previousMatrix,
                historyIndex: newIndex,
                width: previousMatrix[0].length,
                height: previousMatrix.length
            });
        }
    }

    redo () {
        const { history, historyIndex } = this.state;

        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            const nextMatrix = rgbx.cloneMatrix(history[newIndex]);

            this.setState({
                matrix: nextMatrix,
                historyIndex: newIndex,
                width: nextMatrix[0].length,
                height: nextMatrix.length
            });
        }
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
        
        if(this.state.isPasting && this.state.clipboardCanvas) {
            let { cursor, clipboardCanvas } = this.state;

            // Draw the pre-rendered clipboard canvas at cursor position
            mainCTX.drawImage(
                clipboardCanvas,
                offset.x + cursor.x * scale,
                offset.y + cursor.y * scale,
                clipboardCanvas.width * scale,
                clipboardCanvas.height * scale
            );
        }
        this.drawMaskOverlay()
    }

    // drawSelectionOverlays is not currently being used
    // it was replaced by drawMaskOverlays
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

        ctx.restore();
    }

    drawMaskOverlay () {
        const canvas = this.canvas.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const maskMatrix = this.state.selectionMask;
        let { scale, offset } = this.state;

        if (!maskMatrix || maskMatrix.length === 0) return;

        const height = maskMatrix.length;
        const width = maskMatrix[0].length;

        // Draw semi-transparent fill (orange)
        ctx.save();
        ctx.translate(offset.x, offset.y);
        ctx.scale(scale, scale);
        ctx.fillStyle = 'rgba(255, 152, 0, 0.2)'; // Orange fill

        for (let y = 0; y < height; y++) {
            let runStart = null;
            for (let x = 0; x < width; x++) {
            if (maskMatrix[y][x]) {
                if (runStart === null) runStart = x;
            } else {
                if (runStart !== null) {
                ctx.fillRect(runStart, y, x - runStart, 1);
                runStart = null;
                }
            }
            }
            if (runStart !== null) {
            ctx.fillRect(runStart, y, width - runStart, 1);
            }
        }

        // Draw border around mask edges (orange)
        ctx.strokeStyle = 'rgba(255, 152, 0, 0.8)'; // Orange border
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]); // Dashed line
        ctx.lineDashOffset = -performance.now() / 50; // Animate
        
        // Find and draw edges
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
            if (maskMatrix[y][x]) {
                // Check if this is an edge pixel
                const isEdge = 
                (y === 0 || !maskMatrix[y-1][x]) || // Top edge
                (y === height-1 || !maskMatrix[y+1][x]) || // Bottom edge
                (x === 0 || !maskMatrix[y][x-1]) || // Left edge
                (x === width-1 || !maskMatrix[y][x+1]); // Right edge
                
                if (isEdge) {
                    ctx.strokeRect(x + 0.5, y + 0.5, 1, 1);
                }
            }
            }
        }
        
        ctx.restore();
    }

    drawLine (start, end, callback) {
        let { x: x0, y: y0 } = start;
        let { x: x1, y: y1 } = end;

        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        let sx = (x0 < x1) ? 1 : -1;
        let sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;

        let newMask = rgbx.cloneMask(this.state.selectionMask);

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
        let { startPoint, width, height, selectionMask, isAdditiveSelection } = this.state;
        let rect = {
            x: Math.min(startPoint.x, endPoint.x),
            y: Math.min(startPoint.y, endPoint.y),
            width: Math.abs(startPoint.x - endPoint.x),
            height: Math.abs(startPoint.y - endPoint.y),
        }

        let newMask;
        if (isAdditiveSelection && selectionMask) {
            // Add to existing mask
            newMask = rgbx.cloneMask(selectionMask);
        } else {
            // Create new mask
            newMask = rgbx.createMask(width, height);
        }

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

        let newMask = rgbx.cloneMask(mask);
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

        if(event.button == 2) {
            event.preventDefault();
            this.setState({
                isDrawing: false,
                startPoint: null,
                previousPoint: null,
                selectionMask: null,
                tempSelectionRect: null,
            })
            return
        }

        if(event.button == 1) {
            event.preventDefault();
            this.setState({
                isPanning: true,
                previousPoint: { x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY }
            });
            return;
        }

        let pos = this.getMousePosition(event);

        // Allow pasting anywhere, even outside bounds
        if(this.state.isPasting) {
            this.pasteMouseDown(pos.x, pos.y);
            return;
        }

        // Check if click is within image bounds for selection tools
        if (pos.x < 0 || pos.y < 0 || pos.x >= this.state.width || pos.y >= this.state.height) {
            // Click is outside image bounds, ignore it for selection tools
            return;
        }

        // For drawing tools (pencil, etc.), preserve the mask. For selection tools, clear it unless Ctrl is held.
        const isDrawingTool = this.state.currentTool === 'pencil';
        const isCtrlHeld = event.ctrlKey || event.metaKey; // Support both Ctrl (Windows/Linux) and Cmd (Mac)
        const shouldPreserveMask = isDrawingTool || isCtrlHeld;

        this.setState({
            isDrawing: true,
            startPoint: pos,
            previousPoint: pos,
            selectionMask: shouldPreserveMask ? this.state.selectionMask : null,
            tempSelectionRect: null,
            isAdditiveSelection: isCtrlHeld, // Track if Ctrl was held for rectangle selection
        })

        if(this.state.currentTool == 'lasso') {
            let newMask;
            if (isCtrlHeld && this.state.selectionMask) {
                // Add to existing mask
                newMask = rgbx.cloneMask(this.state.selectionMask);
            } else {
                // Create new mask
                newMask = rgbx.createMask(this.state.width, this.state.height);
            }

            if(newMask[pos.y]?.[pos.x] != undefined) {
                newMask[pos.y][pos.x] = true;
                this.setState({ selectionMask: newMask })
            }
        }

        if (this.state.currentTool == 'magicwand') {
            const newSelectionMask = rgbx.createMagicWandMask(
                this.state.matrix,
                pos.x,
                pos.y,
                this.state.tolerance,
                this.state.contiguous
            );

            // If Ctrl is held and there's an existing mask, merge them
            if (isCtrlHeld && this.state.selectionMask) {
                const combinedMask = rgbx.cloneMask(this.state.selectionMask);
                for (let y = 0; y < newSelectionMask.length; y++) {
                    for (let x = 0; x < newSelectionMask[y].length; x++) {
                        if (newSelectionMask[y][x]) {
                            combinedMask[y][x] = true;
                        }
                    }
                }
                this.setState({ selectionMask: combinedMask });
            } else {
                this.setState({ selectionMask: newSelectionMask });
            }
        }

        if (this.state.currentTool == 'pencil') {
            this.drawBrush(pos.x, pos.y);
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

        if (currentTool == 'pencil') {
            // Save to history after finishing brush stroke
            this.saveToHistory();
        } else if (currentTool == 'rectangle') {
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
        let pos = this.getMousePosition(event);
        this.setState({ cursor: pos })

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

        let { currentTool, startPoint, previousPoint } = this.state;

        if(currentTool == 'pencil') {
            // Continue drawing while dragging
            if(pos.x >= 0 && pos.y >= 0 && pos.x < this.state.width && pos.y < this.state.height) {
                this.drawBrush(pos.x, pos.y);
            }
        }

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
                case 'magicwand':
                    this.canvas.current.classList.add('wand-cursor');
            }   

        });

    }

    render() {
        const topModalName = this.getTopModalName();

        return (
            <div className='main-wrapper'>
                <div className='tools-wrapper'>
                    <div className='utility-wrapper'>
                        <button className='tool' onClick={this.undo} disabled={this.state.historyIndex <= 0}>undo</button>
                        <button className='tool' onClick={this.redo} disabled={this.state.historyIndex >= this.state.history.length - 1}>redo</button>
                        <button className='tool' onClick={(e) => { this.manageNewModal(true) }}>new</button>
                        <button className='tool' onClick={(e) => { this.openDialog() }}>open</button>
                        <button className='tool' onClick={(e) => { this.manageResizeModal(true) }}>resize</button>
                        <button className='tool' onClick={(e) => { this.manageSaveModal(true) }}>save</button>
                        <button className='tool' onClick={()=>{this.changeTool('rectangle')}}>rectangle</button>
                        <button className='tool' onClick={()=>{this.changeTool('lasso')}}>lasso</button>
                        <button className='tool' onClick={(e) => {
                            this.changeTool('magicwand');
                            this.manageMagicWandModal(true);
                        }}>magic wand</button>
                        <button className='tool' onClick={(e) => {
                            this.changeTool('pencil');
                            this.manageBrushModal(true);
                        }}>pencil</button>
                    </div>
                    <div className='style-wrapper'>
                        <button className='tool' onClick={this.invert}>invert</button>
                        <button className='tool' onClick={(e) => { this.manageSortModal(true) }}>sort</button>
                        <button className='tool' onClick={(e) => { this.copy() }}>copy</button>
                        <button className='tool' onClick={(e) => { this.paste() }}>paste</button>
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
                    <div className='details-wrapper'>
                        <div className='detail-item'><span className='detail-label'>file </span><span className='detail-value'>{`${testimg}`}</span></div>
                        <div className='detail-item'><span className='detail-label'>width </span><span className='detail-value'>{`${this.state.width}`}</span></div>
                        <div className='detail-item'><span className='detail-label'>height </span><span className='detail-value'>{`${this.state.height}`}</span></div>
                    </div>
                </div>
                {this.state.isSaveModalOpen ?
                (<SaveModal
                    cancel={this.manageSaveModal}
                    confirm={this.save}
                    initialPosition={this.state.modalPositions.save}
                    onPositionChange={(pos) => this.saveModalPosition('save', pos)}
                    isActive={true}
                    zIndex={this.state.modalZIndices.save}
                    onActivate={() => this.bringModalToFront('save')}
                    isTopModal={topModalName === 'save'}
                    onCloseAll={this.closeAllModals}
                    modalType="utility"
                />) : <span/>}
                {this.state.isResizeModalOpen ?
                (<ResizeModal
                    cancel={this.manageResizeModal}
                    confirm={this.resize}
                    initialPosition={this.state.modalPositions.resize}
                    onPositionChange={(pos) => this.saveModalPosition('resize', pos)}
                    isActive={true}
                    zIndex={this.state.modalZIndices.resize}
                    onActivate={() => this.bringModalToFront('resize')}
                    isTopModal={topModalName === 'resize'}
                    onCloseAll={this.closeAllModals}
                    modalType="utility"
                />) : <span/>}
                {this.state.isSortModalOpen ?
                (<SortModal
                    cancel={this.manageSortModal}
                    confirm={this.sort}
                    initialPosition={this.state.modalPositions.sort}
                    onPositionChange={(pos) => this.saveModalPosition('sort', pos)}
                    isActive={true}
                    zIndex={this.state.modalZIndices.sort}
                    onActivate={() => this.bringModalToFront('sort')}
                    isTopModal={topModalName === 'sort'}
                    onCloseAll={this.closeAllModals}
                    modalType="tool"
                />) : <span/>}
                {this.state.isNewModalOpen ?
                (<NewModal
                    cancel={this.manageNewModal}
                    confirm={this.newCanvas}
                    initialPosition={this.state.modalPositions.new}
                    onPositionChange={(pos) => this.saveModalPosition('new', pos)}
                    isActive={true}
                    zIndex={this.state.modalZIndices.new}
                    onActivate={() => this.bringModalToFront('new')}
                    isTopModal={topModalName === 'new'}
                    onCloseAll={this.closeAllModals}
                    modalType="utility"
                />) : <span/>}
                {this.state.isMagicWandModalOpen ?
                (<MagicWandModal
                    cancel={this.manageMagicWandModal}
                    confirm={(settings) => {
                        this.updateMagicWandSettings(settings);
                    }}
                    initialTolerance={this.state.tolerance}
                    initialContiguous={this.state.contiguous}
                    initialPosition={this.state.modalPositions.magicWand}
                    onPositionChange={(pos) => this.saveModalPosition('magicWand', pos)}
                    isActive={this.state.currentTool === 'magicwand'}
                    zIndex={this.state.modalZIndices.magicWand}
                    onActivate={() => {
                        this.bringModalToFront('magicWand');
                        this.changeTool('magicwand');
                    }}
                    isTopModal={topModalName === 'magicWand'}
                    onCloseAll={this.closeAllModals}
                    modalType="selection"
                />) : <span/>}
                {this.state.isBrushModalOpen ?
                (<BrushModal
                    cancel={this.manageBrushModal}
                    confirm={(settings) => {
                        this.updateBrushSettings(settings);
                    }}
                    initialBrushSettings={this.state.brushSettings}
                    initialPosition={this.state.modalPositions.brush}
                    onPositionChange={(pos) => this.saveModalPosition('brush', pos)}
                    isActive={this.state.currentTool === 'pencil'}
                    zIndex={this.state.modalZIndices.brush}
                    onActivate={() => {
                        this.bringModalToFront('brush');
                        this.changeTool('pencil');
                    }}
                    isTopModal={topModalName === 'brush'}
                    onCloseAll={this.closeAllModals}
                    modalType="tool"
                />) : <span/>}
                {this.state.isPasteModalOpen ?
                (<PasteModal
                    onCancel={this.managePasteModal}
                    onConfirm={this.applyPasteTransformations}
                    clipboard={this.state.clipboard}
                    initialPosition={this.state.modalPositions.paste}
                    onPositionChange={(pos) => this.saveModalPosition('paste', pos)}
                    isActive={true}
                    zIndex={this.state.modalZIndices.paste}
                    onActivate={() => this.bringModalToFront('paste')}
                    isTopModal={topModalName === 'paste'}
                    onCloseAll={this.closeAllModals}
                    modalType="utility"
                />) : <span/>}
            </div>
        )
    }
}




















