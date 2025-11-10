import * as React from 'react';
import ToolModal from './ToolModal';

export default function BrushModal (props) {
    let { cancel, confirm, initialBrushSettings, initialPosition, onPositionChange, isActive, zIndex, onActivate, isTopModal, onCloseAll, modalType } = props;

    const [brushType, setBrushType] = React.useState(initialBrushSettings?.type || 'pencil');
    const [brushSize, setBrushSize] = React.useState(initialBrushSettings?.size || 1);
    const [brushColor, setBrushColor] = React.useState(initialBrushSettings?.color || '#000000');

    // Send updates in real-time as settings change
    const updateSettings = (newType, newSize, newColor) => {
        confirm({
            type: newType,
            size: newSize,
            color: newColor
        });
    };

    const handleTypeChange = (value) => {
        setBrushType(value);
        updateSettings(value, brushSize, brushColor);
    };

    const handleSizeChange = (value) => {
        setBrushSize(value);
        updateSettings(brushType, value, brushColor);
    };

    const handleColorChange = (value) => {
        setBrushColor(value);
        updateSettings(brushType, brushSize, value);
    };

    let submit = (e) => {
        // Just close the modal, settings are already updated
        cancel(false);
    }

    // Convert hex color to RGB object
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    };

    const rgbPreview = hexToRgb(brushColor);

    return (
        <ToolModal
            title={'Brush'}
            onConfirm={submit}
            onCancel={(e) => { cancel(false) }}
            initialPosition={initialPosition}
            onPositionChange={onPositionChange}
            isActive={isActive}
            zIndex={zIndex}
            onActivate={onActivate}
            isTopModal={isTopModal}
            onCloseAll={onCloseAll}
            modalType={modalType}
        >
            <div className='modal-section'>
                <label className='modal-label'>Brush Type</label>
                <select
                    onChange={(event) => handleTypeChange(event.target.value)}
                    className='modal-selection'
                    value={brushType}
                    name={'brushType'}
                >
                    <option value={'pencil'}>Pencil</option>
                    {/* Future brush types can be added here */}
                    {/* <option value={'airbrush'}>Airbrush</option> */}
                    {/* <option value={'eraser'}>Eraser</option> */}
                </select>
            </div>

            <div className='modal-slider-container'>
                <label className='modal-label'>
                    Size: <span className='modal-value'>{brushSize}px</span>
                </label>
                <input
                    type='range'
                    min='1'
                    max='50'
                    step='1'
                    value={brushSize}
                    onChange={(event) => handleSizeChange(parseInt(event.target.value))}
                    className='modal-slider'
                    name={'brushSize'}
                />
            </div>

            <div className='modal-color-container'>
                <label className='modal-label'>Color</label>
                <div className='color-picker-wrapper'>
                    <input
                        type='color'
                        value={brushColor}
                        onChange={(event) => handleColorChange(event.target.value)}
                        className='modal-color-picker'
                        name={'brushColor'}
                    />
                    <div className='color-preview' style={{backgroundColor: brushColor}}></div>
                    {rgbPreview && (
                        <div className='color-values'>
                            RGB: {rgbPreview.r}, {rgbPreview.g}, {rgbPreview.b}
                        </div>
                    )}
                </div>
            </div>
        </ToolModal>
    )
}
