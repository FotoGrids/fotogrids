import React from 'react';
import { Button } from './Button';

/**
 * Upsell row shown alongside a Pro-only control.
 *
 * @param {Object}          props
 * @param {string}          props.badge       Badge label.
 * @param {React.ReactNode} props.children    Notice text.
 * @param {string}          props.actionLabel Label for the link button.
 * @param {Function}        props.onAction    Handler for the link button.
 * @param {boolean}         props.center      Align the text with the button
 *                                            instead of the top of the row.
 *                                            Suits a single line of copy.
 * @return {React.ReactElement} The notice.
 */
const ProFeatureNotice = ({ badge, children, actionLabel, onAction, center = false }) => (
    <div
        className={`fotogrids-pro-feature-notice${
            center ? ' fotogrids-pro-feature-notice--center' : ''
        }`}
    >
        <div className="fotogrids-pro-feature-notice__content">
            <span className="fotogrids-pro-badge">{badge}</span>
            <span className="fotogrids-pro-feature-notice__text">{children}</span>
        </div>
        <Button variant="link" onClick={onAction}>
            {actionLabel}
        </Button>
    </div>
);

export default ProFeatureNotice;
