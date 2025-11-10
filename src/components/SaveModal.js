import * as React from 'react';
import ToolModal from './ToolModal';

export default function SaveModal (props) {
    let { cancel, confirm, initialPosition, onPositionChange, isActive, zIndex, onActivate, isTopModal, onCloseAll, modalType } = props;

    let currentSelection = 'png';

    let handleChange = (e) => {
        let value = e.target.value;
        currentSelection = value;
    }

    let submit = (e) => {
        confirm(currentSelection);
        cancel(false);
    }

    return (
        <ToolModal
            title={'Save'}
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
            <select onChange={handleChange} className='modal-selection'>
                <option value={'png'}>png</option>
                <option value={'jpg'}>jpg</option>
                <option value={'array'}>array</option>
            </select>
        </ToolModal>
    )
}