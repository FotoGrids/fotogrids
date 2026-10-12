import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import Panel from '@/admin/src/components/shared/SidebarTabs/elements/Panel.jsx';
import PanelRow from '@/admin/src/components/shared/SidebarTabs/elements/PanelRow.jsx';
import Segmented from '@/admin/src/components/shared/Segmented.jsx';
import Toggle from '@/admin/src/components/shared/Toggle.jsx';
import ToggleList from '@/admin/src/components/shared/ToggleList.jsx';
import { Button } from '@/admin/src/components/shared/Button';
import { EXPORT_TYPES } from '../constants.js';

const ExportPanel = ({ onOperationStart, onOperationEnd }) => {
	const allKeys = EXPORT_TYPES.map((t) => t.key);
	const [include, setInclude] = useState(new Set(allKeys));
	const [format, setFormat] = useState('json');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(null);

	const toggleType = (key) => {
		setInclude((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	};

	const toggleAll = () => {
		setInclude(
			include.size === allKeys.length ? new Set() : new Set(allKeys)
		);
	};

	const handleExport = async () => {
		if (include.size === 0) {
			return;
		}
		setBusy(true);
		setError(null);
		onOperationStart(
			__('Exporting - please do not close this window…', 'fotogrids')
		);

		try {
			const url = new URL(
				wpApiSettings.root +
					'fotogrids/v1/admin/tools/import-export/export',
				window.location.href
			);
			[...include].forEach((v) =>
				url.searchParams.append('include[]', v)
			);
			url.searchParams.set('format', format);

			const response = await fetch(url.toString(), {
				headers: { 'X-WP-Nonce': wpApiSettings.nonce },
			});

			if (!response.ok) {
				const json = await response.json().catch(() => ({}));
				throw new Error(
					json.message || __('Export failed.', 'fotogrids')
				);
			}

			const blob = await response.blob();
			const anchor = document.createElement('a');
			anchor.href = URL.createObjectURL(blob);
			anchor.download = `fotogrids-export.${format}`;
			document.body.appendChild(anchor);
			anchor.click();
			document.body.removeChild(anchor);
			URL.revokeObjectURL(anchor.href);
		} catch (err) {
			setError(err.message || __('Export failed.', 'fotogrids'));
		} finally {
			setBusy(false);
			onOperationEnd();
		}
	};

	return (
		<>
			<Panel
				title={__('What to export', 'fotogrids')}
				titleTag="h3"
				equalBodyPadding
				action={
					<Toggle
						id="fg-ie-export-select-all"
						checked={include.size === allKeys.length}
						onChange={() => toggleAll()}
						label={__('Select all', 'fotogrids')}
						labelLight
						size="small"
					/>
				}
			>
				<ToggleList noBorder>
					{EXPORT_TYPES.map(({ key, label }) => (
						<Toggle
							key={key}
							id={`fg-ie-export-${key}`}
							checked={include.has(key)}
							onChange={() => toggleType(key)}
							label={label}
						/>
					))}
				</ToggleList>
			</Panel>

			<Panel title={__('File format', 'fotogrids')} titleTag="h3">
				<PanelRow
					title={__('Export file format', 'fotogrids')}
					description={
						format === 'json'
							? __(
									'JSON is compact and works with most migration tools.',
									'fotogrids'
								)
							: __(
									'XML is more verbose and can be edited in any text editor.',
									'fotogrids'
								)
					}
				>
					<Segmented
						options={[
							{ value: 'json', label: 'JSON' },
							{ value: 'xml', label: 'XML' },
						]}
						value={format}
						onChange={setFormat}
						ariaLabel={__('Export file format', 'fotogrids')}
					/>
				</PanelRow>

				{error && (
					<div className="fg-ie-error-notice" role="alert">
						{error}
					</div>
				)}

				<div className="fg-ie-actions">
					<Button
						variant="primary"
						disabled={include.size === 0}
						busy={busy}
						onClick={handleExport}
					>
						{busy
							? __('Exporting…', 'fotogrids')
							: __('Export', 'fotogrids')}
					</Button>
					{include.size === 0 && (
						<span className="fg-ie-warning">
							{__(
								'Select at least one item to export.',
								'fotogrids'
							)}
						</span>
					)}
				</div>
			</Panel>
		</>
	);
};

export default ExportPanel;
