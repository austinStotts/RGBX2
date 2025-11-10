import * as React from 'react';
import ToolModal from './ToolModal';

export default function MagicWandModal (props) {
    let { cancel, confirm, initialTolerance, initialContiguous, initialPosition, onPositionChange, isActive, zIndex, onActivate, isTopModal, onCloseAll, modalType } = props;

    const [tolerance, setTolerance] = React.useState(initialTolerance || 32);
    const [contiguous, setContiguous] = React.useState(initialContiguous !== undefined ? initialContiguous : true);

    // Send updates in real-time as settings change
    const updateSettings = (newTolerance, newContiguous) => {
        confirm({
            tolerance: newTolerance,
            contiguous: newContiguous
        });
    };

    const handleToleranceChange = (value) => {
        setTolerance(value);
        updateSettings(value, contiguous);
    };

    const handleContiguousChange = (value) => {
        setContiguous(value);
        updateSettings(tolerance, value);
    };

    let submit = (e) => {
        // Just close the modal, settings are already updated
        cancel(false);
    }

    return (
        <ToolModal
            title={'Magic Wand'}
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
            <div className='modal-slider-container'>
                <label className='modal-label'>
                    Tolerance: <span className='modal-value'>{Math.round(tolerance)}</span>
                </label>
                <input
                    type='range'
                    min='0'
                    max='100'
                    step='1'
                    value={tolerance}
                    onChange={(event)=>{handleToleranceChange(parseFloat(event.target.value))}}
                    className='modal-slider'
                    name={'tolerance'}
                />
            </div>
            <div className='modal-checkbox-container'>
                <label className='modal-checkbox-label'>
                    <input
                        type='checkbox'
                        checked={contiguous}
                        onChange={(event)=>{handleContiguousChange(event.target.checked)}}
                        className='modal-checkbox'
                        name={'contiguous'}
                    />
                    Contiguous (only select connected pixels)
                </label>
            </div>
        </ToolModal>
    )
}
