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
 *   loading  - bool; shows skeleton when true
 *   href     - optional link URL (wraps the whole card in an anchor)
 */
import React from 'react';
import Icon from './Icon';

const StatCard = ( { icon, iconName, value, label, accent = 'blue', invert = false, loading = false, href } ) => {
    const baseClass = 'fg-stat-card';
    const wrapperClass = [
        baseClass,
        `${baseClass}--${accent}`,
        invert && `${baseClass}--invert`,
    ].filter( Boolean ).join( ' ' );

    const isLink = !! href && ! loading;
    const Tag = isLink ? 'a' : 'div';
    const wrapperProps = isLink ? { href } : {};

    const valueNode = loading ? (
        <span className={`${baseClass}__skeleton`} aria-hidden="true" />
    ) : (
        <span className={`${baseClass}__value`}>{ value }</span>
    );

    return (
        <Tag className={ wrapperClass } { ...wrapperProps }>
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
        </Tag>
    );
};

export default StatCard;
