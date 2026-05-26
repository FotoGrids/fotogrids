/**
 * Shared StatCard component.
 *
 * Used in both the Stats page and Dashboard OverviewStats.
 *
 * Props:
 *   icon     - SVG HTML string (dangerouslySetInnerHTML), optional
 *   value    - The primary numeric/text value to display
 *   label    - Card label text
 *   accent   - 'blue' | 'red' | 'yellow' | 'grey' (default 'blue')
 *   loading  - bool; shows skeleton when true
 *   href     - optional link URL (wraps value in an anchor)
 */
import React from 'react';

const StatCard = ( { icon, value, label, accent = 'blue', loading = false, href } ) => {
    const cls = `fg-stat-card fg-stat-card--${accent}`;

    const valueNode = loading ? (
        <span className="fg-stat-card__skeleton" aria-hidden="true" />
    ) : href ? (
        <a className="fg-stat-card__value" href={ href }>{ value }</a>
    ) : (
        <span className="fg-stat-card__value">{ value }</span>
    );

    return (
        <div className={ cls }>
            { icon && (
                <div
                    className="fg-stat-card__icon"
                    dangerouslySetInnerHTML={ { __html: icon } }
                    aria-hidden="true"
                />
            ) }
            <div className="fg-stat-card__body">
                { valueNode }
                <div className="fg-stat-card__label">{ label }</div>
            </div>
        </div>
    );
};

export default StatCard;
