import React from 'react';

const { __ } = wp.i18n;

/**
 * Reusable stat card for Library tab headers.
 *
 * Props:
 *   label   - card heading (string)
 *   value   - primary metric (string | number | node); pass '-' while loading
 *   sub     - optional secondary line (string | node)
 *   variant - undefined | 'positive' | 'warning'
 */
const LibraryStatCard = ({ label, value, sub, variant }) => {
    const baseClass = 'fg-lib-stat-card';
    const hasNumericValue = (typeof value === 'number' && Number.isFinite(value))
        || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)));
    const cls = [
        baseClass,
        variant ? `${baseClass}--${variant}` : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={cls}>
            {hasNumericValue && (
                <div className={`${baseClass}__value ${baseClass}__value--big`}>{value}</div>
            )}
            <div className={`${baseClass}__content`}>
                <div className={`${baseClass}__value`}>{value}</div>
                <div className={`${baseClass}__inner`}>
                    <div className={`${baseClass}__label`}>{label}</div>
                    {sub != null && <div className={`${baseClass}__sub`}>{sub}</div>}
                </div>
            </div>
        </div>
    );
};

export default LibraryStatCard;
