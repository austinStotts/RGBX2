import * as React from 'react';

export default class ToolModal extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            isDragging: false,
            position: { x: (window.innerWidth / 2) - 150, y: (window.innerHeight / 2) - 100 },
            rel: null,
        }

        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseDown = this.onMouseDown.bind(this);

        this.modal = React.createRef();
    }

    componentDidMount () {
        document.addEventListener('keydown', this.handleKeyDown)
    }

    componentWillUnmount () {
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('nousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    }

    handleKeyDown (event) {
        if(event.key == 'Escape') {
            this.props.onCancel();
        }
        if(event.key == 'Enter') {
            this.props.onConfirm();
        }
    }

    onMouseDown (event) {
        if(event.button != 0) return;
        let modal = this.modal.current;
        this.setState({
            isDragging: true,
            rel: {
                x: event.pageX - modal.offsetLeft,
                y: event.pageY - modal.offsetTop,
            }
        });

        event.stopPropagation();
        event.preventDefault();

        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
    }

    onMouseMove (event) {
        if(!this.state.isDragging) return;
        this.setState({
            position: {
                x: event.pageX - this.state.rel.x,
                y: event.pageY - this.state.rel.y
            }
        });
        event.stopPropagation();
        event.preventDefault();
    }

    onMouseUp (event) {
        this.setState({ isDragging: false });
        event.stopPropagation();
        event.preventDefault();

        document.removeEventListener('nousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    }

    render () {
        let { title, children, onConfirm, onCancel } = this.props;

        return (
            <div className='modal-backdrop'>
                <div
                    className='tool-modal'
                    ref={this.modal}
                    style={{ left: this.state.position.x + 'px', top: this.state.position.y + 'px' }}
                >
                    <div className='modal-header' onMouseDown={this.onMouseDown}>
                        <span className='modal-title'>{title}</span>
                        <button onClick={onCancel} className='close-button'>X</button>
                    </div>
                    <div className='modal-content'>
                        {children}
                    </div>
                    <div className='modal-footer'>
                        <button onClick={onConfirm} className='btn-confirm'>confirm</button>
                    </div>
                </div>
            </div>
        )
    }
}