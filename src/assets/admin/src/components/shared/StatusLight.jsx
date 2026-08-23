import React from 'react';

/**
 * StatusLight - a coloured dot with a label and a short state word.
 *
 * Reports a read-only environment or connection state (green / red / muted)
 * next to the name of whatever is being reported on.
 *
 * @param {Object} props
 * @param {string} props.label        Name of the thing being reported (e.g. a PHP constant).
 * @param {string} props.stateLabel   Short state word rendered beside the dot (e.g. "On").
 * @param {string} [props.state]      "on" | "off" | "muted". Defaults to "muted".
 */
const StatusLight = ({ label, stateLabel, state = 'muted' }) => (
    <span className={`fotogrids-status-light fotogrids-status-light--${state}`}>
        <span className="fotogrids-status-light__label">{label}</span>
        <span className="fotogrids-status-light__state">
            <span className="fotogrids-status-light__dot" aria-hidden="true" />
            {stateLabel}
        </span>
    </span>
);

export default StatusLight;
