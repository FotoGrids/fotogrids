import React from 'react';

const { __ } = wp.i18n;

/**
 * BreakpointPreview - three device frames (mobile / tablet / desktop) labelled
 * with the ranges implied by the two breakpoint values.
 *
 * @param {Object} props
 * @param {number} props.mobile  Mobile breakpoint (px).
 * @param {number} props.tablet  Tablet breakpoint (px).
 */
const BreakpointPreview = ({ mobile, tablet }) => {
    const m = Number(mobile) || 0;
    const t = Number(tablet) || 0;

    const devices = [
        {
            key: 'desktop',
            label: __('Desktop', 'fotogrids'),
            range: `> ${t}`,
        },
        {
            key: 'tablet',
            label: __('Tablet', 'fotogrids'),
            range: `${m + 1} – ${t}`,
        },
        {
            key: 'mobile',
            label: __('Mobile', 'fotogrids'),
            range: `< ${m}`,
        },
    ];

    return (
        <div className="fotogrids-breakpoint-preview">
            {devices.map((d) => (
                <div
                    key={d.key}
                    className={`fotogrids-breakpoint-preview__device fotogrids-breakpoint-preview__device--${d.key}`}
                >
                    <div className="fotogrids-breakpoint-preview__screen" />
                    <div className="fotogrids-breakpoint-preview__device-content">
                        <div className="fotogrids-breakpoint-preview__label">{d.label}</div>
                        <div className="fotogrids-breakpoint-preview__range">{d.range}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default BreakpointPreview;
