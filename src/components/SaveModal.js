import * as React from 'react';
import ToolModal from './ToolModal';

export default function SaveModal (props) {
    let { cancel, confirm } = props;

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
        <ToolModal title={'Save'} onConfirm={submit} onCancel={(e) => { cancel(false) }}>
            <select onChange={handleChange} className='modal-selection'>
                <option value={'png'}>png</option>
                <option value={'jpg'}>jpg</option>
                <option value={'array'}>array</option>
            </select>
        </ToolModal>
    )
}