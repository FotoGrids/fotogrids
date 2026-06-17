/**
 * SearchBar - shared, FotoGrids-branded search input.
 *
 * Designed as a drop-in replacement for @wordpress/components SearchControl:
 * same prop surface (value, onChange, placeholder, label, help,
 * hideLabelFromVision, onClose, size), with FotoGrids styling and a few
 * extras (`width`, `onKeyDown`, `autoFocus`, native pass-throughs).
 *
 * Visual structure:
 *
 *   ┌─ .fotogrids-search-bar (wrapper) ────────────────────┐
 *   │  [label?]                                            │
 *   │  ┌─ .fotogrids-search-bar__field ─────────────────┐  │
 *   │  │ [search icon] [<input>]              [clear×]  │  │
 *   │  └────────────────────────────────────────────────┘  │
 *   │  [help?]                                             │
 *   └──────────────────────────────────────────────────────┘
 *
 * Props
 * ─────
 * value                string                   Controlled value (defaults to '').
 * onChange             fn(value)                Called on every keystroke.
 * onClose              fn()                     Optional. When provided, the
 *                                               clear button calls this instead
 *                                               of onChange(''). Use for
 *                                               "close the search field"
 *                                               semantics.
 * placeholder          string                   Default 'Search'.
 * label                string|node              Accessible label. Visually
 *                                               hidden by default.
 * hideLabelFromVision  boolean                  Default true.
 * help                 string|node              Optional helper text below.
 * size                 'default' | 'compact'    Default 'default'.
 * width                number|string            Fixed width (numbers => px).
 * disabled             boolean                  Disables the input.
 * autoFocus            boolean                  Focus on mount.
 * id                   string                   Native input id.
 * name                 string                   Native input name.
 * ariaLabel            string                   Used when no visible `label`.
 * onKeyDown            fn(event)                Pass-through for Enter/Esc/etc.
 * className            string                   Extra classes on the wrapper.
 *
 * Any extra props (data-*, ref, etc.) are forwarded to the native <input>.
 */

import React, { useCallback, useEffect, useId, useRef } from 'react';
import Icon from './Icon';

const SIZES = new Set(['default', 'compact']);

const SearchBar = ({
    value = '',
    onChange,
    onClose,
    placeholder,
    label,
    hideLabelFromVision = true,
    help,
    size = 'default',
    width = null,
    disabled = false,
    autoFocus = false,
    id,
    name,
    ariaLabel,
    onKeyDown,
    className = '',
    ...rest
}) => {
    const generatedId = useId();
    const inputId = id || `fg-search-${ generatedId }`;
    const helpId = help ? `${ inputId }-help` : undefined;
    const inputRef = useRef(null);
    const { __ } = (window.wp && window.wp.i18n) || { __: (s) => s };

    const resolvedSize = SIZES.has(size) ? size : 'default';
    const resolvedPlaceholder = placeholder !== undefined
        ? placeholder
        : __('Search', 'fotogrids');

    useEffect(() => {
        if (autoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [autoFocus]);

    const handleChange = useCallback((event) => {
        if (typeof onChange === 'function') onChange(event.target.value);
    }, [onChange]);

    const handleClear = useCallback(() => {
        if (typeof onClose === 'function') {
            onClose();
        } else if (typeof onChange === 'function') {
            onChange('');
        }
        if (inputRef.current) inputRef.current.focus();
    }, [onChange, onClose]);

    const hasValue = value !== '' && value != null;

    const wrapperStyle = width != null
        ? { width: typeof width === 'number' ? `${ width }px` : width }
        : undefined;

    const classes = [
        'fotogrids-search-bar',
        `fotogrids-search-bar--size-${ resolvedSize }`,
        disabled && 'fotogrids-search-bar--disabled',
        hasValue && 'fotogrids-search-bar--has-value',
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={ classes } style={ wrapperStyle }>
            { label && (
                <label
                    htmlFor={ inputId }
                    className={
                        hideLabelFromVision
                            ? 'fotogrids-search-bar__label fotogrids-search-bar__label--visually-hidden'
                            : 'fotogrids-search-bar__label'
                    }
                >
                    { label }
                </label>
            ) }

            <div className="fotogrids-search-bar__field">
                <Icon
                    name={ resolvedSize === 'compact' ? 'search_sm' : 'search_md' }
                    className="fotogrids-search-bar__icon"
                />

                <input
                    ref={ inputRef }
                    id={ inputId }
                    name={ name }
                    type="search"
                    role="searchbox"
                    className="fotogrids-search-bar__input"
                    value={ value }
                    onChange={ handleChange }
                    onKeyDown={ onKeyDown }
                    placeholder={ resolvedPlaceholder }
                    disabled={ disabled }
                    aria-label={ !label ? ariaLabel : undefined }
                    aria-describedby={ helpId }
                    autoComplete="off"
                    spellCheck="false"
                    { ...rest }
                />

                { hasValue && !disabled && (
                    <button
                        type="button"
                        className="fotogrids-search-bar__clear"
                        onClick={ handleClear }
                        aria-label={ __('Clear search', 'fotogrids') }
                        tabIndex={ -1 }
                    >
                        <Icon name="x" />
                    </button>
                ) }
            </div>

            { help && (
                <p id={ helpId } className="fotogrids-search-bar__help">
                    { help }
                </p>
            ) }
        </div>
    );
};

export default SearchBar;
