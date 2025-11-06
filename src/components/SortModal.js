import * as React from 'react';
import ToolModal from './ToolModal';

export default function SortModal (props) {
    let { cancel, confirm } = props;

    let currentAxis = 'x';
    let currentCriterion = 'brightness';
    let currentDirection = 'ascending'

    let handleChange = (e, key) => {
        let value = e.target.value;

        if(key == 'axis') {
            currentAxis = value;
        } else if (key == 'criterion') {
            currentCriterion = value;
        } else if (key == 'direction') {
            currentDirection = value;
        }
    }

    let submit = (e) => {
        confirm({ axis: currentAxis, criterion: currentCriterion, direction: currentDirection });
        cancel(false);
    }

    return (
        <ToolModal title={'Sort'} onConfirm={submit} onCancel={(e) => { cancel(false) }}>
            <select onChange={(event)=>{handleChange(event, 'axis')}} className='modal-selection' name={'axis'}>
                <option value={'x'}>x</option>
                <option value={'y'}>y</option>
            </select>
            <select onChange={(event)=>{handleChange(event, 'criterion')}} className='modal-selection' name={'criterion'}>
                <option value={'brightness'}>brightness</option>
                <option value={'red'}>red</option>
                <option value={'green'}>green</option>
                <option value={'blue'}>blue</option>
                <option value={'hue'}>hue</option>
            </select>
            <select onChange={(event)=>{handleChange(event, 'direction')}} className='modal-selection' name={'direction'}>
                <option value={'ascending'}>ascending</option>
                <option value={'decending'}>decending</option>
            </select>
            <div className='modal-tip'>this is a complex tool that may take several moments to complete</div>
        </ToolModal>
    )
}