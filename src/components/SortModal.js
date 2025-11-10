import * as React from 'react';
import ToolModal from './ToolModal';

export default function SortModal (props) {
    let { cancel, confirm, initialPosition, onPositionChange, isActive, zIndex, onActivate, isTopModal, onCloseAll, modalType } = props;

    const [edgeThreshold, setEdgeThreshold] = React.useState(0.5);
    const [smoothing, setSmoothing] = React.useState(0.2);

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
        } else if (key == 'edgeThreshold') {
            setEdgeThreshold(parseFloat(value));
        } else if (key == 'smoothing') {
            setSmoothing(parseFloat(value));
        }
    }

    let submit = (e) => {
        confirm({
            axis: currentAxis,
            criterion: currentCriterion,
            direction: currentDirection,
            edgeThreshold: edgeThreshold,
            smoothing: smoothing
        });
        cancel(false);
    }

    return (
        <ToolModal
            title={'Sort'}
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
            <div className='modal-slider-container'>
                <label className='modal-label'>
                    Edge Threshold: <span className='modal-value'>{edgeThreshold.toFixed(2)}</span>
                </label>
                <input
                    type='range'
                    min='0'
                    max='1'
                    step='0.05'
                    defaultValue='0.5'
                    onChange={(event)=>{handleChange(event, 'edgeThreshold')}}
                    className='modal-slider'
                    name={'edgeThreshold'}
                />
            </div>
            <div className='modal-slider-container'>
                <label className='modal-label'>
                    Smoothing: <span className='modal-value'>{smoothing.toFixed(2)}</span>
                </label>
                <input
                    type='range'
                    min='0'
                    max='1'
                    step='0.05'
                    defaultValue='0.2'
                    onChange={(event)=>{handleChange(event, 'smoothing')}}
                    className='modal-slider'
                    name={'smoothing'}
                />
            </div>
            <div className='modal-tip'>this is a complex tool that may take several moments to complete</div>
        </ToolModal>
    )
}