import React from 'react';
import Icon from '../Icon';

const VARIANTS = new Set([
    'primary',
    'secondary',
    'tertiary',
    'danger',
    'success',
    'warning',
    'accent',
    'ghost',
    'outline',
    'link',
]);

const SIZES = new Set(['sm', 'md', 'lg', 'xl']);

const Button = ({
    variant = 'secondary',
    size = 'md',
    style,
    icon,
    iconRight,
    iconOnly = false,
    busy = false,
    fullWidth = false,
    disabled = false,
    href,
    target,
    rel,
    type = 'button',
    onClick,
    className = '',
    children,
    ariaLabel,
    ...rest
}) => {
    const resolvedVariant = VARIANTS.has(variant) ? variant : 'secondary';
    const resolvedSize = SIZES.has(size) ? size : 'md';

    // 'ghost' and 'outline' are styles applied alongside a colour variant. The
    // component accepts them as `style` props so consumers don't have to write
    // two separate class modifiers.
    const isGhost = style === 'ghost';
    const isOutline = style === 'outline';

    const colourVariant = (resolvedVariant === 'ghost' || resolvedVariant === 'outline')
        ? 'primary'
        : resolvedVariant;
    const usingGhost = isGhost || resolvedVariant === 'ghost';
    const usingOutline = isOutline || resolvedVariant === 'outline';

    const classes = [
        'fg-button',
        `fg-button--variant-${ colourVariant }`,
        `fg-button--size-${ resolvedSize }`,
        usingGhost && 'fg-button--ghost',
        usingOutline && 'fg-button--outline',
        iconOnly && 'fg-button--icon-only',
        busy && 'fg-button--busy',
        fullWidth && 'fg-button--full-width',
        disabled && 'fg-button--disabled',
        className,
    ].filter(Boolean).join(' ');

    const content = (
        <>
            { icon && <Icon name={ icon } className="fg-button__icon" /> }
            { ! iconOnly && children !== undefined && (
                <span className="fg-button__label">{ children }</span>
            ) }
            { iconRight && <Icon name={ iconRight } className="fg-button__icon" /> }
        </>
    );

    if (iconOnly && ! ariaLabel && process.env.NODE_ENV !== 'production') {
        console.warn('[Button] iconOnly buttons require an `ariaLabel` prop.');
    }

    if (href) {
        return (
            <a
                className={ classes }
                href={ disabled || busy ? undefined : href }
                target={ target }
                rel={ rel || (target === '_blank' ? 'noopener noreferrer' : undefined) }
                onClick={ disabled || busy ? undefined : onClick }
                aria-disabled={ disabled || busy || undefined }
                aria-label={ ariaLabel }
                aria-busy={ busy || undefined }
                { ...rest }
            >
                { content }
            </a>
        );
    }

    return (
        <button
            className={ classes }
            type={ type }
            disabled={ disabled || busy }
            onClick={ onClick }
            aria-label={ ariaLabel }
            aria-busy={ busy || undefined }
            { ...rest }
        >
            { content }
        </button>
    );
};

export default Button;
