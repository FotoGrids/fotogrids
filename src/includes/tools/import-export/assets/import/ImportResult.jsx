import React from 'react';
import { __ } from '@wordpress/i18n';
import { Button } from '@/admin/src/components/shared/Button';
import Icon from '@/admin/src/components/shared/Icon.jsx';
import ChipList from '../components/ChipList.jsx';
import { importResultChips } from '../utils.js';

const ImportResultRow = ({ title, chips, variant }) => (
	<div className="fg-ie-done__result">
		<span className="fg-ie-done__result-title">{title}</span>
		<ChipList chips={chips} variant={variant} />
	</div>
);

const ImportResult = ({ result, onReset }) => {
	const imported = importResultChips(result?.imported);
	const skipped = importResultChips(result?.skipped);
	const nothingImported = 0 === imported.length;

	let message = null;
	if (!nothingImported) {
		message =
			skipped.length > 0
				? __(
						'Your data has been imported. Some records were skipped.',
						'fotogrids'
					)
				: __('Your data has been imported successfully.', 'fotogrids');
	} else if (skipped.length > 0) {
		message = __('Every record you selected was skipped.', 'fotogrids');
	}

	return (
		<div
			className={`fg-ie-done${nothingImported ? ' fg-ie-done--nothing-imported' : ''}`}
		>
			<Icon name={nothingImported ? 'alert_circle' : 'check_badge_gi'} />
			<div className="fg-ie-done__content">
				<h3>
					{nothingImported
						? __('Nothing was imported', 'fotogrids')
						: __('Import complete', 'fotogrids')}
				</h3>
				{message && <p>{message}</p>}
				{imported.length > 0 && (
					<ImportResultRow
						title={__('Imported', 'fotogrids')}
						chips={imported}
						variant="count"
					/>
				)}
				{skipped.length > 0 && (
					<ImportResultRow
						title={__('Skipped', 'fotogrids')}
						chips={skipped}
						variant="skipped"
					/>
				)}
			</div>
			<Button variant="primary" onClick={onReset}>
				{__('Import another file', 'fotogrids')}
			</Button>
		</div>
	);
};

export default ImportResult;
