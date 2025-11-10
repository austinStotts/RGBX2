import * as React from 'react';
import ToolModal from './ToolModal';

export default function ResizeModal (props) {
    let { cancel, confirm, initialPosition, onPositionChange, isActive, zIndex, onActivate, isTopModal, onCloseAll, modalType } = props;

    let currentScale = '2';

    let handleChange = (e) => {
        let value = e.target.value;
        currentScale = value;
    }

    let submit = (e) => {
        confirm(currentScale);
        cancel(false);
    }

    return (
        <ToolModal
            title={'Resize'}
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
            <input autoFocus onChange={handleChange} placeholder='scale' className='resize-modal-input'></input>
        </ToolModal>
    )
}