import * as React from 'react';
import ToolModal from './ToolModal';

export default function NewModal (props) {
    let { cancel, confirm } = props;

    let currentWidth = 256;
    let currentHeight = 256;

    let handleChange = (e, key) => {
        let value = Number(e.target.value);
        console.log(value)
        if(key == 'width') {
            currentWidth = value;
            return
        }

        if(key == 'height') {
            currentHeight = value;
            return
        }
    }

    let submit = (e) => {
        confirm({width: currentWidth, height: currentHeight});
        cancel(false);
    }

    return (
        <ToolModal title={'New'} onConfirm={submit} onCancel={(e) => { cancel(false) }}>
            <textarea onChange={(event) => {handleChange(event, 'width')}} placeholder='width in pixels'></textarea>
            <textarea onChange={(event) => {handleChange(event, 'height')}} placeholder='width in pixels'></textarea>
        </ToolModal>
    )
}