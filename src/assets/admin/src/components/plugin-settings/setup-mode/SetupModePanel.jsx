import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Panel } from '../../shared/settings';
import {
	ADVANCED,
	EASY,
	canEditSiteMode,
	changeSiteMode,
	readSiteMode,
} from './setup-mode';

const BASE = 'fotogrids-settings-mode-panel';

/**
 * Settings > Defaults panel for the site default setup mode.
 *
 * @since 1.3.0
 */
const SetupModePanel = () => {
	const [mode, setMode] = useState(() => readSiteMode());
	const [saving, setSaving] = useState(false);
	const editable = canEditSiteMode();

	const options = [
		{
			value: EASY,
			title: __('Easy', 'fotogrids'),
			text: __(
				'Only the essential settings. Everything else keeps its default.',
				'fotogrids'
			),
		},
		{
			value: ADVANCED,
			title: __('Advanced', 'fotogrids'),
			text: __(
				'Every setting, for full control over look and behaviour.',
				'fotogrids'
			),
		},
	];

	const pick = async (next) => {
		if (!editable || saving || next === mode) {
			return;
		}
		setSaving(true);
		await changeSiteMode({
			next,
			current: mode,
			setMode,
			messages: {
				saved: __('Default mode saved.', 'fotogrids'),
				failed: __(
					'The default mode could not be saved. Please try again.',
					'fotogrids'
				),
			},
		});
		setSaving(false);
	};

	const headingId = `${BASE}-heading`;
	const descriptionId = `${BASE}-description`;

	return (
		<Panel
			title={__('Setup Mode', 'fotogrids')}
			className={BASE}
			equalBodyPadding
		>
			<p id={headingId} className={`${BASE}__heading`}>
				{__('Default mode for new users', 'fotogrids')}
			</p>
			<p id={descriptionId} className={`${BASE}__description`}>
				{__(
					"Used by everyone who hasn't picked a mode yet. Each person can still switch between Easy and Advanced on any gallery or album, and their choice only changes what they see.",
					'fotogrids'
				)}
			</p>
			<div
				role="radiogroup"
				aria-labelledby={headingId}
				aria-describedby={descriptionId}
				aria-busy={saving || undefined}
				className={`${BASE}__options`}
			>
				{options.map((option) => {
					const checked = mode === option.value;
					const id = `${BASE}-${option.value}`;
					return (
						<label
							key={option.value}
							htmlFor={id}
							className={[
								`${BASE}__card`,
								checked ? 'fg-is-active' : '',
								editable ? '' : `${BASE}__card--readonly`,
							]
								.filter(Boolean)
								.join(' ')}
						>
							<input
								type="radio"
								id={id}
								name={BASE}
								value={option.value}
								checked={checked}
								disabled={!editable}
								onChange={() => pick(option.value)}
								className={`${BASE}__input`}
							/>
							<span
								className={`${BASE}__radio`}
								aria-hidden="true"
							>
								<span className={`${BASE}__dot`} />
							</span>
							<span className={`${BASE}__title`}>
								{option.title}
							</span>
							<span className={`${BASE}__text`}>
								{option.text}
							</span>
						</label>
					);
				})}
			</div>
			{!editable && (
				<p className={`${BASE}__readonly-note`}>
					{__(
						"Your role can't change the default mode.",
						'fotogrids'
					)}
				</p>
			)}
		</Panel>
	);
};

export default SetupModePanel;
