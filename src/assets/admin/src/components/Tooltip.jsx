import { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

/**
 * Generic tooltip component.
 *
 * Wraps any trigger element and shows a floating bubble on hover.
 * Renders via a portal so it is never clipped by overflow:hidden
 * ancestors (common in wp-admin metaboxes).
 *
 * @param {object}          props
 * @param {React.ReactNode} props.children  The trigger element(s).
 * @param {React.ReactNode} props.content   Text or JSX to show inside the bubble.
 * @param {'top'|'bottom'|'left'|'right'} [props.position='top']
 */
const Tooltip = ( { children, content, position = 'top' } ) => {
    const [ visible, setVisible ] = useState( false );
    const [ coords, setCoords ]   = useState( { top: 0, left: 0 } );
    const triggerRef              = useRef( null );
    const bubbleRef               = useRef( null );

    const recalcPosition = useCallback( () => {
        if ( ! triggerRef.current || ! bubbleRef.current ) {
            return;
        }

        const trigger = triggerRef.current.getBoundingClientRect();
        const bubble  = bubbleRef.current.getBoundingClientRect();
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;
        const gap     = 6;

        let top  = 0;
        let left = 0;

        switch ( position ) {
            case 'bottom':
                top  = trigger.bottom + scrollY + gap;
                left = trigger.left + scrollX + trigger.width / 2 - bubble.width / 2;
                break;
            case 'left':
                top  = trigger.top + scrollY + trigger.height / 2 - bubble.height / 2;
                left = trigger.left + scrollX - bubble.width - gap;
                break;
            case 'right':
                top  = trigger.top + scrollY + trigger.height / 2 - bubble.height / 2;
                left = trigger.right + scrollX + gap;
                break;
            case 'top':
            default:
                top  = trigger.top + scrollY - bubble.height - gap;
                left = trigger.left + scrollX + trigger.width / 2 - bubble.width / 2;
                break;
        }

        const viewportWidth = document.documentElement.clientWidth;
        if ( left < 8 ) {
            left = 8;
        } else if ( left + bubble.width > viewportWidth - 8 ) {
            left = viewportWidth - bubble.width - 8;
        }

        setCoords( { top, left } );
    }, [ position ] );

    // Re-measure after the bubble is painted so we have real dimensions.
    useEffect( () => {
        if ( visible ) {
            recalcPosition();
        }
    }, [ visible, recalcPosition ] );

    const bubble = visible && (
        <div
            ref={ bubbleRef }
            className={ `fg-tooltip fg-tooltip--${ position }` }
            style={ { top: coords.top, left: coords.left } }
            role="tooltip"
        >
            { content }
        </div>
    );

    return (
        <>
            <span
                ref={ triggerRef }
                className="fg-tooltip-trigger"
                onMouseEnter={ () => setVisible( true ) }
                onMouseLeave={ () => setVisible( false ) }
            >
                { children }
            </span>
            { ReactDOM.createPortal( bubble, document.body ) }
        </>
    );
};

export default Tooltip;
