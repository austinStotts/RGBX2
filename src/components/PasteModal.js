import * as React from 'react';
import ToolModal from './ToolModal';
import rgbx from '../rgbx';

export default class PasteModal extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            mirrorX: false,
            mirrorY: false,
            rotation: 0, // 0, 90, 180, 270
            scale: 1.0,
        };

        this.canvasRef = React.createRef();
    }

    componentDidMount() {
        this.drawPreview();
    }

    componentDidUpdate(prevProps, prevState) {
        // Only redraw if relevant state changed, not if props changed
        if (prevState.mirrorX !== this.state.mirrorX ||
            prevState.mirrorY !== this.state.mirrorY ||
            prevState.rotation !== this.state.rotation ||
            prevState.scale !== this.state.scale) {
            this.drawPreview();
        }
    }

    drawPreview() {
        const canvas = this.canvasRef.current;
        if (!canvas || !this.props.clipboard) return;

        const ctx = canvas.getContext('2d');
        const { clipboard } = this.props;
        const { mirrorX, mirrorY, rotation, scale } = this.state;

        // Get dimensions
        let width = clipboard.data[0].length;
        let height = clipboard.data.length;

        // Swap dimensions if rotated 90 or 270 degrees
        if (rotation === 90 || rotation === 270) {
            [width, height] = [height, width];
        }

        // Set canvas size at 33% scale
        const previewScale = 0.33;
        canvas.width = width * previewScale * scale;
        canvas.height = height * previewScale * scale;

        // Clear canvas
        ctx.fillStyle = '#CCCCCC';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();

        // Apply transformations
        ctx.scale(previewScale * scale, previewScale * scale);

        // Apply rotation
        if (rotation !== 0) {
            ctx.translate(width / 2, height / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-width / 2, -height / 2);
        }

        // Apply mirroring
        if (mirrorX || mirrorY) {
            const translateX = mirrorX ? width : 0;
            const translateY = mirrorY ? height : 0;
            const scaleX = mirrorX ? -1 : 1;
            const scaleY = mirrorY ? -1 : 1;

            ctx.translate(translateX, translateY);
            ctx.scale(scaleX, scaleY);
        }

        // Draw pixels
        for (let y = 0; y < clipboard.data.length; y++) {
            for (let x = 0; x < clipboard.data[y].length; x++) {
                if (clipboard.mask[y][x]) {
                    const pixel = clipboard.data[y][x];
                    ctx.fillStyle = `rgba(${pixel.r}, ${pixel.g}, ${pixel.b}, ${pixel.a / 255})`;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }

        ctx.restore();
    }

    handleMirrorX = () => {
        this.setState(prev => ({ mirrorX: !prev.mirrorX }), this.updateParent);
    }

    handleMirrorY = () => {
        this.setState(prev => ({ mirrorY: !prev.mirrorY }), this.updateParent);
    }

    handleRotate = () => {
        this.setState(prev => ({ rotation: (prev.rotation + 90) % 360 }), this.updateParent);
    }

    handleScaleChange = (event) => {
        const newScale = parseFloat(event.target.value);
        this.setState({ scale: newScale });

        // Debounce the update to parent for scale changes
        if (this.scaleTimeout) {
            clearTimeout(this.scaleTimeout);
        }
        this.scaleTimeout = setTimeout(() => {
            this.updateParent();
        }, 100); // Wait 100ms after user stops dragging
    }

    componentWillUnmount() {
        if (this.scaleTimeout) {
            clearTimeout(this.scaleTimeout);
        }
    }

    updateParent = () => {
        // Only send the transformation when the modal is being confirmed, not in real-time
        // Real-time updates are too expensive and cause loops
    }

    transformClipboard = () => {
        const { clipboard } = this.props;
        const { mirrorX, mirrorY, rotation, scale } = this.state;

        let data = clipboard.data;
        let mask = clipboard.mask;
        let bounds = clipboard.bounds;

        // Apply mirror X
        if (mirrorX) {
            data = data.map(row => [...row].reverse());
            mask = mask.map(row => [...row].reverse());
        }

        // Apply mirror Y
        if (mirrorY) {
            data = [...data].reverse();
            mask = [...mask].reverse();
        }

        // Apply rotation
        if (rotation !== 0) {
            const rotations = rotation / 90;
            for (let i = 0; i < rotations; i++) {
                // Rotate 90 degrees clockwise
                const newData = [];
                const newMask = [];
                const height = data.length;
                const width = data[0].length;

                for (let x = 0; x < width; x++) {
                    const newRow = [];
                    const newMaskRow = [];
                    for (let y = height - 1; y >= 0; y--) {
                        newRow.push(data[y][x]);
                        newMaskRow.push(mask[y][x]);
                    }
                    newData.push(newRow);
                    newMask.push(newMaskRow);
                }
                data = newData;
                mask = newMask;
            }
        }

        // Apply scale (simple nearest neighbor)
        if (scale !== 1.0) {
            const oldHeight = data.length;
            const oldWidth = data[0].length;
            const newHeight = Math.round(oldHeight * scale);
            const newWidth = Math.round(oldWidth * scale);

            const scaledData = [];
            const scaledMask = [];

            for (let y = 0; y < newHeight; y++) {
                const scaledRow = [];
                const scaledMaskRow = [];
                for (let x = 0; x < newWidth; x++) {
                    const srcX = Math.floor(x / scale);
                    const srcY = Math.floor(y / scale);
                    scaledRow.push(data[srcY][srcX]);
                    scaledMaskRow.push(mask[srcY][srcX]);
                }
                scaledData.push(scaledRow);
                scaledMask.push(scaledMaskRow);
            }
            data = scaledData;
            mask = scaledMask;

            // Update bounds
            bounds = {
                ...bounds,
                width: newWidth,
                height: newHeight
            };
        }

        return { data, mask, bounds };
    }

    handleConfirm = () => {
        // Apply transformations when confirming
        const transformedClipboard = this.transformClipboard();
        const { mirrorX, mirrorY, rotation, scale } = this.state;

        this.props.onConfirm({
            clipboard: transformedClipboard,
            mirrorX,
            mirrorY,
            rotation,
            scale
        });

        // Close the modal but keep pasting mode active
        this.props.onCancel(false, true); // Second param = keepPasting
    }

    render() {
        const { onCancel, initialPosition, onPositionChange, isActive, zIndex, onActivate, isTopModal, onCloseAll, modalType } = this.props;
        const { mirrorX, mirrorY, rotation, scale } = this.state;

        return (
            <ToolModal
                title={'Paste'}
                onConfirm={this.handleConfirm}
                onCancel={() => onCancel(false)}
                initialPosition={initialPosition}
                onPositionChange={onPositionChange}
                isActive={isActive}
                zIndex={zIndex}
                onActivate={onActivate}
                isTopModal={isTopModal}
                onCloseAll={onCloseAll}
                modalType={modalType}
            >
                <div className='paste-controls'>
                    <button onClick={this.handleMirrorX} className='paste-btn'>
                        Mirror X {mirrorX && '✓'}
                    </button>
                    <button onClick={this.handleMirrorY} className='paste-btn'>
                        Mirror Y {mirrorY && '✓'}
                    </button>
                    <button onClick={this.handleRotate} className='paste-btn'>
                        Rotate ({rotation}°)
                    </button>
                </div>

                <div className='modal-slider-container'>
                    <label className='modal-label'>
                        Scale: <span className='modal-value'>{scale.toFixed(2)}x</span>
                    </label>
                    <input
                        type='range'
                        min='0.1'
                        max='5'
                        step='0.1'
                        value={scale}
                        onChange={this.handleScaleChange}
                        className='modal-slider'
                    />
                </div>

                <div className='paste-preview'>
                    <canvas ref={this.canvasRef} className='paste-preview-canvas'></canvas>
                </div>
            </ToolModal>
        );
    }
}
