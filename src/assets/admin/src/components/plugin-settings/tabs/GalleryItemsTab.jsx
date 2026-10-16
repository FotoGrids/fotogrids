import React, { useState, useEffect, useMemo } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import {
	SettingsPanel,
	PanelRow,
	Segmented,
	SaveBar,
} from '../../shared/settings';
import Toggle from '../../shared/Toggle';
import InfoBlock from '../../shared/InfoBlock';

const REST_PATH = '/fotogrids/v1/admin/text-formatting';

const DEFAULTS = {
	mode: 'basic',
	links_new_tab: true,
	links_nofollow: false,
};

const normalize = (raw) => {
	const seed = raw && typeof raw === 'object' ? raw : {};
	return {
		mode: seed.mode === 'plain' ? 'plain' : 'basic',
		links_new_tab:
			typeof seed.links_new_tab === 'boolean'
				? seed.links_new_tab
				: DEFAULTS.links_new_tab,
		links_nofollow:
			typeof seed.links_nofollow === 'boolean'
				? seed.links_nofollow
				: DEFAULTS.links_nofollow,
	};
};

/**
 * Plugin Settings → Gallery Items tab.
 *
 * Reads and writes the fotogrids_text_formatting option through
 * /fotogrids/v1/admin/text-formatting.
 */
const GalleryItemsTab = () => {
	const initial = normalize(window.fotogridsAdmin?.textFormatting);

	const [settings, setSettings] = useState(initial);
	const [saved, setSaved] = useState(initial);
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState(null);

	useEffect(() => {
		let active = true;
		apiFetch({ path: REST_PATH })
			.then((data) => {
				if (!active || !data?.settings) {
					return;
				}
				const next = normalize(data.settings);
				setSettings(next);
				setSaved(next);
			})
			.catch(() => {});
		return () => {
			active = false;
		};
	}, []);

	const dirty = useMemo(
		() => JSON.stringify(settings) !== JSON.stringify(saved),
		[settings, saved]
	);

	const update = (key, value) => {
		setSettings((prev) => ({ ...prev, [key]: value }));
		setStatus(null);
	};

	const handleSave = async () => {
		setSaving(true);
		setStatus(null);
		try {
			const result = await apiFetch({
				path: REST_PATH,
				method: 'POST',
				data: settings,
			});
			const next = result?.settings
				? normalize(result.settings)
				: settings;
			setSettings(next);
			setSaved(next);
			if (window.fotogridsAdmin) {
				window.fotogridsAdmin.textFormatting = next;
			}
			setStatus('saved');
			setTimeout(() => setStatus(null), 3000);
			return true;
		} catch (err) {
			setStatus('error');
			return false;
		} finally {
			setSaving(false);
		}
	};

	const handleDiscard = () => {
		setSettings(saved);
		setStatus(null);
	};

	const plain = settings.mode === 'plain';
	const plainReason = __(
		'Captions and descriptions show as plain text, so links show as their text only.',
		'fotogrids'
	);

	return (
		<div
			className="fotogrids-sidebar-tabs__content__inner"
			key="gallery-items-content"
		>
			<SettingsPanel
				title={__('Captions and descriptions', 'fotogrids')}
				description={__(
					'How item captions and descriptions appear in thumbnails, album tiles and Lightboxes. These settings apply site-wide.',
					'fotogrids'
				)}
			>
				<PanelRow
					title={__('Formatting', 'fotogrids')}
					description={
						plain
							? __(
									'Every tag is removed and the text is shown as typed. Line breaks are kept.',
									'fotogrids'
								)
							: __(
									'Bold, italic, links and line breaks are shown. Every other tag is removed.',
									'fotogrids'
								)
					}
				>
					<Segmented
						ariaLabel={__(
							'Formatting in captions and descriptions',
							'fotogrids'
						)}
						value={settings.mode}
						onChange={(value) => update('mode', value)}
						options={[
							{
								value: 'basic',
								label: __('Basic formatting', 'fotogrids'),
							},
							{
								value: 'plain',
								label: __('Plain text', 'fotogrids'),
							},
						]}
					/>
				</PanelRow>
			</SettingsPanel>

			<SettingsPanel
				title={__('Links', 'fotogrids')}
				titleTag="h3"
				description={__(
					'Defaults for links in captions and descriptions. A link can override them in the item editor.',
					'fotogrids'
				)}
			>
				<PanelRow
					title={__('Open links in a new tab', 'fotogrids')}
					description={__(
						'Links open in a new browser tab, and screen readers announce it.',
						'fotogrids'
					)}
				>
					<Toggle
						id="fg-gallery-items-links-new-tab"
						checked={settings.links_new_tab}
						onChange={(value) => update('links_new_tab', value)}
						disabled={plain}
					/>
				</PanelRow>
				<PanelRow
					title={__(
						'Ask search engines not to follow links',
						'fotogrids'
					)}
					description={__(
						'Adds rel="nofollow", which tells search engines you do not vouch for the linked pages.',
						'fotogrids'
					)}
				>
					<Toggle
						id="fg-gallery-items-links-nofollow"
						checked={settings.links_nofollow}
						onChange={(value) => update('links_nofollow', value)}
						disabled={plain}
					/>
				</PanelRow>
				{plain && (
					<InfoBlock
						title={__('Links are off', 'fotogrids')}
						description={plainReason}
					/>
				)}
			</SettingsPanel>

			<SettingsPanel
				title={__('Who can add formatting', 'fotogrids')}
				titleTag="h3"
				noBody
				description={__(
					'The "Format captions and descriptions" permission in Permissions Manager decides who can add formatting in the item editor. Formatting already saved is shown for everyone.',
					'fotogrids'
				)}
			/>

			<SaveBar
				dirty={dirty}
				saving={saving}
				status={status}
				onSave={handleSave}
				onDiscard={handleDiscard}
				watch={settings}
			/>
		</div>
	);
};

export default GalleryItemsTab;
