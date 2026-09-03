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
 *   invert   - bool; adds inverted visual style when true
 *   loading  - bool; shows a spinner in place of the value when true
 *   href     - optional link URL (wraps the whole card in an anchor)
 *   delta      - optional signed percentage change against the prior period
 *   deltaTitle - optional tooltip text naming the dates compared
 *   footnote   - optional secondary figure; shares the card's trailing corner
 *                with the delta
 */
import React from 'react';
import Icon from './Icon';
import Tooltip from '../Tooltip';

const DELTA_GLYPHS = { up: '↑', down: '↓', flat: '–' };

/**
 * Three-quarter ring used while a card's value is loading.
 *
 * The dash pattern is derived from the circumference of r=9 (~56.5), so the
 * gap stays a quarter of the ring if the radius is ever changed.
 *
 * @returns {React.ReactElement} Inline SVG spinner.
 */
const CardSpinner = () => (
    <svg
        className="fg-stat-card__spinner"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
    >
        <circle cx="12" cy="12" r="9" />
    </svg>
);

const StatCard = ( {
    icon,
    iconName,
    value,
    label,
    accent = 'blue',
    invert = false,
    loading = false,
    href,
    delta = null,
    deltaTitle = '',
    footnote = '',
} ) => {
    const baseClass = 'fg-stat-card';
    const wrapperClass = [
        baseClass,
        `${baseClass}--${accent}`,
        invert && `${baseClass}--invert`,
    ].filter( Boolean ).join( ' ' );

    const isLink = !! href && ! loading;
    const Tag = isLink ? 'a' : 'div';
    const wrapperProps = isLink ? { href } : {};

    const hasDelta  = ! loading && typeof delta === 'number' && isFinite( delta );
    const direction = hasDelta && delta !== 0 ? ( delta > 0 ? 'up' : 'down' ) : 'flat';

    const valueNode = loading ? (
        <span className={`${baseClass}__value-row`}>
            <CardSpinner />
        </span>
    ) : (
        <span className={`${baseClass}__value-row`}>
            <span className={`${baseClass}__value`}>{ value }</span>
        </span>
    );

    return (
        <Tag className={ wrapperClass } { ...wrapperProps } aria-busy={ loading || undefined }>
            { iconName && (
                <Icon name={ iconName } className={`${baseClass}__icon`} />
            ) }
            { ! iconName && icon && (
                <div
                    className={`${baseClass}__icon`}
                    dangerouslySetInnerHTML={ { __html: icon } }
                    aria-hidden="true"
                />
            ) }
            <div className={`${baseClass}__body`}>
                { valueNode }
                <div className={`${baseClass}__label`}>{ label }</div>
            </div>
            { ! loading && ( footnote || hasDelta ) && (
                <span className={`${baseClass}__meta`}>
                    { hasDelta && (
                        <Tooltip content={ deltaTitle }>
                            <span className={`${baseClass}__delta ${baseClass}__delta--${ direction }`}>
                                { DELTA_GLYPHS[ direction ] }
                                { `${ Math.abs( delta ) }%` }
                            </span>
                        </Tooltip>
                    ) }
                    { footnote && (
                        <span className={`${baseClass}__footnote`}>{ footnote }</span>
                    ) }
                </span>
            ) }
        </Tag>
    );
};

export default StatCard;
