import * as React from 'react';

// Global tracker to prevent multiple modals from processing the same key event
let lastKeyEventTime = 0;

export default class ToolModal extends React.Component {
    constructor(props) {
        super(props);

        // Default to left side (220px from left to avoid toolbar)
        const defaultPosition = { x: 220, y: 100 };
        const initialPosition = props.initialPosition || defaultPosition;

        this.state = {
            isDragging: false,
            position: initialPosition,
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
        // Only respond to keyboard if this modal is the top one (has highest z-index)
        const { isTopModal } = this.props;
        if(!isTopModal) return;

        // Prevent duplicate processing of the same event by multiple modals
        const currentTime = event.timeStamp;
        if (currentTime === lastKeyEventTime) {
            return; // Already processed by another modal
        }
        lastKeyEventTime = currentTime;

        // Check if Ctrl+X to close all modals
        if((event.key == 'x' || event.key == 'X') && (event.ctrlKey || event.metaKey)) {
            event.preventDefault(); // Prevent default cut behavior
            if(this.props.onCloseAll) {
                this.props.onCloseAll();
            }
            return;
        }

        if(event.key == 'x' || event.key == 'X') {
            event.preventDefault();
            this.props.onCancel();
        }
        if(event.key == 'Enter') {
            event.preventDefault();
            this.props.onConfirm();
        }
    }

    onMouseDown (event) {
        if(event.button != 0) return;

        // Bring modal to front when clicked
        if (this.props.onActivate) {
            this.props.onActivate();
        }

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

        // Save position when user stops dragging
        if (this.props.onPositionChange) {
            this.props.onPositionChange(this.state.position);
        }

        document.removeEventListener('nousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    }

    handleModalClick = (event) => {
        // Bring modal to front and activate tool when clicked anywhere on modal
        if (this.props.onActivate) {
            this.props.onActivate();
        }
    }

    render () {
        let { title, children, onConfirm, onCancel, isTopModal, zIndex, modalType } = this.props;

        // Determine header class based on whether this is the top modal (active)
        let headerClass = 'modal-header';
        if (!isTopModal) {
            // Inactive modal - always grey
            headerClass += ' modal-header-inactive';
        } else {
            // Active modal - use category color
            if (modalType === 'tool') {
                headerClass += ' modal-header-tool';
            } else if (modalType === 'utility') {
                headerClass += ' modal-header-utility';
            } else if (modalType === 'selection') {
                headerClass += ' modal-header-selection';
            }
        }

        const modalZIndex = zIndex !== undefined ? zIndex : 101;

        return (
            <div
                className='tool-modal'
                ref={this.modal}
                style={{
                    left: this.state.position.x + 'px',
                    top: this.state.position.y + 'px',
                    zIndex: modalZIndex
                }}
                onClick={this.handleModalClick}
            >
                <div className={headerClass} onMouseDown={this.onMouseDown}>
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
        )
    }
}