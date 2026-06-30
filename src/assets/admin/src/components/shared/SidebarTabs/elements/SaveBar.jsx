import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../Button';

const { __ } = wp.i18n;

/**
 * SaveBar - a sticky bottom bar showing save state and actions.
 *
 * Presentational only: the parent owns dirty-tracking and the save call.
 * Drives a status dot + message and a primary save button, with an optional
 * discard action and extra action slot.
 *
 * Moved from shared/settings/ to shared/ - this is a general-purpose UI
 * primitive that can be used in settings pages, tool UIs, or any context
 * with dirty-state tracking.
 *
 * @param {Object}          props
 * @param {boolean}         props.dirty             Whether there are unsaved changes.
 * @param {boolean}         [props.saving]          Save in progress (disables the button).
 * @param {string}          [props.status]          'saved' | 'error' | null - transient feedback.
 * @param {Function}        props.onSave            Save handler.
 * @param {Function}        [props.onDiscard]       Discard handler. Hidden if omitted.
 * @param {string}          [props.savedHint]       Sub-text shown when clean, e.g. "just now".
 * @param {string}          [props.saveLabel]       Primary button label.
 * @param {React.ReactNode} [props.extraAction]     Optional secondary action.
 */
const SaveBar = ({
    dirty,
    saving = false,
    status = null,
    onSave,
    onDiscard,
    savedHint,
    saveLabel,
    extraAction,
}) => {
    // A sentinel sits directly after the bar. While the bar is pinned to the
    // bottom of the viewport the sentinel is scrolled out of view (not
    // intersecting); once the user reaches the end of the content the sentinel
    // comes into view and the bar settles into its natural position. We mirror
    // that into an `fg-is-sticky` class on the bar.
    const sentinelRef = useRef(null);
    const [isStuck, setIsStuck] = useState(false);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || typeof IntersectionObserver === 'undefined') {
            return undefined;
        }

        const observer = new IntersectionObserver(
            ([entry]) => setIsStuck(!entry.isIntersecting),
            { threshold: 0 }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, []);

    let dotClass = 'fotogrids-save-bar__dot';
    let message;

    if (status === 'error') {
        dotClass += ' fotogrids-save-bar__dot--error';
        message = __('Save failed', 'fotogrids');
    } else if (dirty) {
        dotClass += ' fotogrids-save-bar__dot--dirty';
        message = __('Unsaved changes', 'fotogrids');
    } else {
        dotClass += ' fotogrids-save-bar__dot--clean';
        message = __('All changes saved', 'fotogrids');
    }

    return (
        <>
        <div className={`fotogrids-save-bar${isStuck ? ' fg-is-sticky' : ''}`}>
            <span className={dotClass} aria-hidden="true" />
            <span className="fotogrids-save-bar__message">
                {message}
                {!dirty && status !== 'error' && savedHint && (
                    <span className="fotogrids-save-bar__hint">{` - ${savedHint}`}</span>
                )}
            </span>

            {dirty && onDiscard && (
                <Button
                    variant="secondary"
                    style="ghost"
                    size="xs"
                    onClick={onDiscard}
                    disabled={saving}
                >
                    {__('Discard', 'fotogrids')}
                </Button>
            )}

            {extraAction}

            <Button
                variant="primary"
                size="xs"
                onClick={onSave}
                disabled={saving || !dirty}
                busy={saving}
            >
                {saving
                    ? __('Saving…', 'fotogrids')
                    : (saveLabel || __('Save changes', 'fotogrids'))}
            </Button>
        </div>
        <div ref={sentinelRef} className="fotogrids-save-bar__sentinel" aria-hidden="true" />
        </>
    );
};

export default SaveBar;
