import { __, sprintf } from '@wordpress/i18n';

const bars = new Set();

/**
 * Track a mounted save bar so confirmLeave() can see its unsaved changes.
 *
 * @param {Object}                 bar
 * @param {() => boolean}          bar.isDirty    Whether there are unsaved changes.
 * @param {() => boolean}          bar.isSaving   Whether a save is in flight.
 * @param {() => Promise<void>}    bar.whenIdle   Resolves once no save is in flight.
 * @param {() => boolean}          bar.canAutosave Whether the change can be saved without asking.
 * @param {() => Promise<boolean>} bar.save       Saves; resolves false when the save failed.
 * @param {() => void}             bar.discard    Drops the unsaved changes.
 * @return {() => void} Stops tracking the bar.
 */
export const registerSaveBar = (bar) => {
	bars.add(bar);
	return () => bars.delete(bar);
};

/**
 * Whether any mounted save bar holds unsaved or still-saving changes.
 *
 * @return {boolean} True when leaving now could lose a change.
 */
export const hasUnsavedChanges = () =>
	[...bars].some((bar) => bar.isDirty() || bar.isSaving());

/**
 * Ask whether to save, discard or stay.
 *
 * @param {string} message Dialog text.
 * @return {Promise<'save'|'discard'|'stay'>} The user's choice.
 */
const ask = async (message) => {
	const modal = window.FotoGridsAdmin?.modal;

	if (!modal?.confirm) {
		// eslint-disable-next-line no-alert -- fallback when the admin modal API has not loaded.
		return window.confirm(message) ? 'save' : 'stay';
	}

	let closedBy = null;
	const confirmed = await modal.confirm({
		title: __('Unsaved changes', 'fotogrids'),
		message,
		confirmLabel: __('Save changes', 'fotogrids'),
		cancelLabel: __('Discard changes', 'fotogrids'),
		variant: 'warning',
		onClose: (reason) => {
			closedBy = reason;
		},
	});

	if (confirmed) {
		return 'save';
	}

	// Esc, the close button and a click outside keep the user here.
	return 'cancel' === closedBy ? 'discard' : 'stay';
};

/**
 * Settle every unsaved change before the user leaves the current view.
 *
 * Waits for a save in flight, saves straight away when Autosave is on, and
 * otherwise asks whether to save, discard or stay.
 *
 * @param {string} [label] Name of the view being left, e.g. "Sharing".
 * @return {Promise<boolean>} False when the user stays or a save failed.
 */
export const confirmLeave = async (label = '') => {
	for (const bar of [...bars]) {
		if (bar.isSaving()) {
			await bar.whenIdle();
		}

		if (!bar.isDirty()) {
			continue;
		}

		if (bar.canAutosave()) {
			if (!(await bar.save())) {
				return false;
			}
			continue;
		}

		const message = label
			? sprintf(
					/* translators: %s: Name of the settings tab or subtab being left. */
					__(
						'You have unsaved changes on %s. Save them before you leave?',
						'fotogrids'
					),
					label
				)
			: __(
					'You have unsaved changes. Save them before you leave?',
					'fotogrids'
				);
		const choice = await ask(message);

		if ('stay' === choice) {
			return false;
		}

		if ('save' === choice) {
			if (!(await bar.save())) {
				return false;
			}
			continue;
		}

		bar.discard();
	}

	return true;
};
