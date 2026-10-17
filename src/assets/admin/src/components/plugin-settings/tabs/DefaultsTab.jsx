import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { Panel, SaveBar } from '../../shared/settings';
import ErrorBoundary from '../../shared/ErrorBoundary';
import { toPostType } from '../../../utils/post-types';

const ENDPOINT = '/fotogrids/v1/admin/collection-defaults';

// What each subtab has saved since the page loaded.
const savedSinceLoad = { gallery: {}, album: {} };

/**
 * Decode a stored default into the shape the settings panel reads, the way
 * Settings_Localizer decodes it on page load.
 *
 * @param {unknown} value        Stored value.
 * @param {unknown} defaultValue The setting's default.
 * @return {unknown} The panel value.
 */
export const toPanelValue = (value, defaultValue) => {
	if ('boolean' === typeof defaultValue || 'string' !== typeof value) {
		return value;
	}

	try {
		const decoded = JSON.parse(value);
		return null === decoded ? value : decoded;
	} catch (e) {
		return value;
	}
};

/**
 * The settings-panel payload for one collection type.
 *
 * @param {Object} payload That type's localized payload.
 * @param {Object} saved   Values saved since the page loaded.
 * @return {Object} The payload with the saved values applied.
 */
export const panelPayload = (payload, saved = {}) => {
	const settings = { ...(payload.settings || {}) };

	Object.keys(saved).forEach((key) => {
		if (Object.prototype.hasOwnProperty.call(settings, key)) {
			settings[key] = toPanelValue(saved[key], payload.defaults?.[key]);
		}
	});

	return { ...payload, settings };
};

/**
 * Gallery or Album defaults, saved per collection type.
 *
 * @param {Object} props
 * @param {string} props.type - 'gallery' or 'album'
 */
const DefaultsTab = ({ type = 'gallery' }) => {
	const containerRef = useRef(null);
	const rootRef = useRef(null);

	// The settings panel is a separate React tree rendered by the plain
	// collection-settings script, so it reports changes by event rather than by
	// prop. Collect them here and let the save bar own the write; the endpoint
	// merges, so sending only what changed is enough.
	const [pending, setPending] = useState({});
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState(null);

	const pendingRef = useRef(pending);
	pendingRef.current = pending;

	useEffect(() => {
		const handleSettingChanged = (e) => {
			if ('defaults' !== e.detail?.scope || !e.detail?.key) {
				return;
			}
			setStatus(null);
			setPending((prev) => ({ ...prev, [e.detail.key]: e.detail.value }));
		};

		document.addEventListener(
			'fotogrids:setting_changed',
			handleSettingChanged
		);
		return () =>
			document.removeEventListener(
				'fotogrids:setting_changed',
				handleSettingChanged
			);
	}, []);

	const handleSave = useCallback(async () => {
		const payload = pendingRef.current;
		if (0 === Object.keys(payload).length) {
			return true;
		}

		setSaving(true);
		setStatus(null);
		try {
			const response = await apiFetch({
				path: ENDPOINT,
				method: 'POST',
				data: { type, defaults: payload },
			});
			const stored = response?.defaults || {};
			Object.keys(payload).forEach((key) => {
				savedSinceLoad[type][key] =
					Object.prototype.hasOwnProperty.call(stored, key)
						? stored[key]
						: payload[key];
			});
			// Drop only what was sent - the user may have edited on since.
			setPending((prev) => {
				const next = { ...prev };
				Object.keys(payload).forEach((key) => {
					if (next[key] === payload[key]) {
						delete next[key];
					}
				});
				return next;
			});
			setStatus('saved');
			setTimeout(() => setStatus(null), 3000);
			return true;
		} catch (err) {
			setStatus('error');
			return false;
		} finally {
			setSaving(false);
		}
	}, [type]);

	useEffect(() => {
		if (!containerRef.current) {
			return;
		}

		const container = containerRef.current;
		const typeLabel = type === 'gallery' ? 'gallery' : 'album';
		const byKind = window.fotogridsDefaultsByKind?.[typeLabel];

		// Written before the panel mounts and left alone while it is mounted.
		if (window.fotogridsSettings) {
			Object.assign(
				window.fotogridsSettings,
				byKind
					? panelPayload(byKind, savedSinceLoad[typeLabel])
					: {
							postType: toPostType(typeLabel),
							collectionKind: typeLabel,
						}
			);
		}

		const initializeApp = () => {
			if (
				!window.FotoGridsCollectionSettings ||
				!window.FotoGridsCollectionSettings.CollectionSettings
			) {
				return false;
			}

			if (rootRef.current) {
				return true;
			}

			try {
				const root = createRoot(container);
				rootRef.current = root;
				const CollectionSettings =
					window.FotoGridsCollectionSettings.CollectionSettings;
				root.render(
					React.createElement(
						ErrorBoundary,
						{ label: `${typeLabel}-defaults` },
						React.createElement(CollectionSettings)
					)
				);
				return true;
			} catch (error) {
				console.error(
					`FotoGrids: Error initializing ${typeLabel} defaults:`,
					error
				);
				return false;
			}
		};

		if (initializeApp()) {
			return;
		}

		const checkInterval = setInterval(() => {
			if (initializeApp()) {
				clearInterval(checkInterval);
			}
		}, 100);

		return () => {
			clearInterval(checkInterval);
			if (rootRef.current) {
				try {
					rootRef.current.unmount();
					rootRef.current = null;
				} catch (error) {
					// Ignore unmount errors
				}
			}
		};
	}, [type]);

	const containerId = `fotogrids-${type}-defaults-root`;
	const keyValue = `${type}-defaults-content`;

	return (
		<div className="fotogrids-sidebar-tabs__content__inner" key={keyValue}>
			<Panel equalBodyPadding>
				<div id={containerId} ref={containerRef}></div>
			</Panel>
			<SaveBar
				dirty={Object.keys(pending).length > 0}
				saving={saving}
				status={status}
				onSave={handleSave}
				saveLabel={__('Save defaults', 'fotogrids')}
				watch={pending}
			/>
		</div>
	);
};

export default DefaultsTab;
