import React, { useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '../../Button';
import { registerSaveBar } from './unsaved-changes';

/**
 * SaveBar - a sticky bottom bar showing save state and actions.
 *
 * The parent owns dirty-tracking and the save call. Drives a status dot +
 * message and a primary save button, with an optional discard action and
 * extra action slot. While mounted, the bar's unsaved changes are seen by
 * confirmLeave() and the browser warns before the page is left with them.
 *
 * Moved from shared/settings/ to shared/ - this is a general-purpose UI
 * primitive that can be used in settings pages, tool UIs, or any context
 * with dirty-state tracking.
 *
 * @param {Object}          props
 * @param {boolean}         props.dirty             Whether there are unsaved changes.
 * @param {boolean}         [props.saving]          Save in progress (disables the button).
 * @param {string}          [props.status]          'saved' | 'error' | null - transient feedback.
 * @param {() => unknown}   props.onSave            Save handler. Resolves false when the save failed.
 * @param {boolean}         [props.disabled]        Blocks saving while the form is invalid; Discard stays available.
 * @param {() => void}      [props.onDiscard]       Discard handler. Hidden if omitted.
 * @param {string}          [props.savedHint]       Sub-text shown when clean, e.g. "just now".
 * @param {string}          [props.saveLabel]       Primary button label.
 * @param {React.ReactNode} [props.extraAction]     Optional secondary action.
 * @param {unknown}         [props.watch]           The value being edited. When Autosave is on
 *                                                  the save is debounced from the last change to
 *                                                  this, so a half-typed field is never written.
 *                                                  Omit it and the debounce runs from the moment
 *                                                  the form first went dirty instead.
 */

// Milliseconds of quiet before an autosave fires. Matches the gallery
// editor's debounce so both surfaces feel the same.
const AUTOSAVE_DELAY = 2000;

// `fotogridsAdmin.autosave` is a string on page load - wp_localize_script casts
// every scalar - and a real boolean once a toggle has written the AJAX response
// back. Anything else is ambiguous, and off is the safe answer.
const autosaveIsOn = () => {
	const raw = window.fotogridsAdmin?.autosave;
	return true === raw || '1' === raw;
};

/**
 * Whether Autosave is on, following the Advanced tab's announcements.
 *
 * @return {boolean} True while Autosave is on.
 */
export const useAutosaveEnabled = () => {
	const [autosave, setAutosave] = useState(autosaveIsOn);

	// The Advanced tab announces the option changing, so the other tabs pick it
	// up without a reload.
	useEffect(() => {
		const handleAutosaveChanged = (e) =>
			setAutosave(
				typeof e.detail?.enabled === 'boolean'
					? e.detail.enabled
					: autosaveIsOn()
			);

		document.addEventListener(
			'fotogrids:autosave_changed',
			handleAutosaveChanged
		);
		return () =>
			document.removeEventListener(
				'fotogrids:autosave_changed',
				handleAutosaveChanged
			);
	}, []);

	return autosave;
};

const SaveBar = ({
	dirty,
	saving = false,
	status = null,
	onSave,
	disabled = false,
	onDiscard,
	savedHint,
	saveLabel,
	extraAction,
	watch,
}) => {
	const autosave = useAutosaveEnabled();

	// Held in a ref so a new onSave identity on each render does not restart
	// the debounce.
	const onSaveRef = useRef(onSave);
	onSaveRef.current = onSave;

	const watchToken = watch === undefined ? null : JSON.stringify(watch);

	const state = useRef({});
	state.current = { dirty, saving, disabled, autosave, onDiscard };
	const idleWaiters = useRef([]);

	useEffect(() => {
		if (!saving) {
			idleWaiters.current.splice(0).forEach((resolve) => resolve());
		}
	}, [saving]);

	useEffect(
		() =>
			registerSaveBar({
				isDirty: () => !!state.current.dirty,
				isSaving: () => !!state.current.saving,
				whenIdle: () =>
					state.current.saving
						? new Promise((resolve) =>
								idleWaiters.current.push(resolve)
							)
						: Promise.resolve(),
				canAutosave: () =>
					state.current.autosave && !state.current.disabled,
				save: async () =>
					!state.current.disabled &&
					false !== (await onSaveRef.current?.()),
				discard: () => state.current.onDiscard?.(),
			}),
		[]
	);

	useEffect(() => {
		if (!dirty && !saving) {
			return undefined;
		}

		const handleBeforeUnload = (e) => {
			const current = state.current;
			if (
				current.autosave &&
				current.dirty &&
				!current.saving &&
				!current.disabled
			) {
				onSaveRef.current?.();
			}
			e.preventDefault();
			e.returnValue = '';
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () =>
			window.removeEventListener('beforeunload', handleBeforeUnload);
	}, [dirty, saving]);

	useEffect(() => {
		// `status === 'error'` stops a failed save retrying on a loop. Editing
		// again clears the status, which re-arms this.
		if (!autosave || !dirty || saving || disabled || 'error' === status) {
			return undefined;
		}

		const timer = setTimeout(() => onSaveRef.current?.(), AUTOSAVE_DELAY);
		return () => clearTimeout(timer);
	}, [autosave, dirty, saving, disabled, status, watchToken]);

	// A sentinel sits directly after the bar. While the bar is pinned to the
	// bottom of the viewport the sentinel is scrolled out of view (not
	// intersecting); once the user reaches the end of the content the sentinel
	// comes into view and the bar settles into its natural position; that
	// state is mirrored into an `fg-is-sticky` class on the bar.
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
			<div
				className={`fotogrids-save-bar${isStuck ? ' fg-is-sticky' : ''}`}
			>
				<span className={dotClass} aria-hidden="true" />
				<span className="fotogrids-save-bar__message">
					{message}
					{!dirty && status !== 'error' && savedHint && (
						<span className="fotogrids-save-bar__hint">{` - ${savedHint}`}</span>
					)}
				</span>

				{dirty && onDiscard && !autosave && (
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
					disabled={saving || !dirty || disabled}
					busy={saving}
				>
					{saving
						? __('Saving…', 'fotogrids')
						: saveLabel || __('Save changes', 'fotogrids')}
				</Button>
			</div>
			<div
				ref={sentinelRef}
				className="fotogrids-save-bar__sentinel"
				aria-hidden="true"
			/>
		</>
	);
};

export default SaveBar;
