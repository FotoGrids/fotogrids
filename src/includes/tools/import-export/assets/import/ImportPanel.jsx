import React, { useState } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import Panel from '@/admin/src/components/shared/SidebarTabs/elements/Panel.jsx';
import PanelRow from '@/admin/src/components/shared/SidebarTabs/elements/PanelRow.jsx';
import FileUpload from '@/admin/src/components/blocks/FileUpload.jsx';
import Segmented from '@/admin/src/components/shared/Segmented.jsx';
import DangerZone from '@/admin/src/components/shared/DangerZone.jsx';
import Toggle from '@/admin/src/components/shared/Toggle.jsx';
import { Button } from '@/admin/src/components/shared/Button';
import {
	CONFLICT_OPTIONS,
	EXPORT_TYPES,
	SETTINGS_TYPES,
} from '../constants.js';
import FileSummary from './FileSummary.jsx';
import ImportResult from './ImportResult.jsx';

const ImportPanel = ({ onOperationStart, onOperationEnd }) => {
	const [phase, setPhase] = useState('idle');
	const [file, setFile] = useState(null);
	const [summary, setSummary] = useState(null);
	const [analyseError, setAnalyseError] = useState(null);
	const [importError, setImportError] = useState(null);
	const [include, setInclude] = useState(new Set());
	const [settingsInclude, setSettingsInclude] = useState(new Set());
	const [conflictMode, setConflictMode] = useState({}); // { [key]: 'skip'|'overwrite'|'duplicate' }
	const [result, setResult] = useState(null);

	const getConflictMode = (key) => conflictMode[key] ?? 'skip';
	const setTypeConflictMode = (key, value) =>
		setConflictMode((prev) => ({ ...prev, [key]: value }));

	const handleFileReady = async (fileObj) => {
		setFile(fileObj);
		setPhase('analysing');
		setAnalyseError(null);
		setSummary(null);

		try {
			const response = await apiFetch({
				path: '/fotogrids/v1/admin/tools/import-export/import',
				method: 'POST',
				data: { phase: 'analyse', file: fileObj.text },
			});
			setSummary(response);
			const availableKeys = EXPORT_TYPES.filter(
				({ key, hidden }) => !hidden && 'settings' !== key
			)
				.map(({ key }) => key)
				.filter((k) => (response?.contents ?? {})[k] > 0);
			setInclude(new Set(availableKeys));
			setSettingsInclude(new Set());
			setPhase('ready');
		} catch (err) {
			setAnalyseError(
				err.message || __('Could not analyse the file.', 'fotogrids')
			);
			setPhase('idle');
		}
	};

	const resetFile = () => {
		setFile(null);
		setSummary(null);
		setResult(null);
		setPhase('idle');
		setAnalyseError(null);
		setImportError(null);
	};

	const toggleSet = (setter) => (key) => {
		setter((prev) => {
			const next = new Set(prev);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	};
	const toggleInclude = toggleSet(setInclude);
	const toggleSetting = toggleSet(setSettingsInclude);

	const settingsInFile = SETTINGS_TYPES.filter(({ key }) =>
		(summary?.contents?.settings_detail ?? []).includes(key)
	);
	const chosenSettings = settingsInFile
		.map(({ key }) => key)
		.filter((key) => settingsInclude.has(key));
	const effectiveInclude = [...include].filter(
		(key) => 'settings' !== key || chosenSettings.length > 0
	);

	const handleImport = async () => {
		setPhase('importing');
		setImportError(null);
		onOperationStart(
			__('Importing - please do not close this window…', 'fotogrids')
		);

		try {
			const response = await apiFetch({
				path: '/fotogrids/v1/admin/tools/import-export/import',
				method: 'POST',
				data: {
					phase: 'execute',
					file: file.text,
					include: effectiveInclude,
					settings: effectiveInclude.includes('settings')
						? chosenSettings
						: [],
					galleries: getConflictMode('galleries'),
					albums: getConflictMode('albums'),
				},
			});
			setResult(response);
			setPhase('done');
		} catch (err) {
			setImportError(err.message || __('Import failed.', 'fotogrids'));
			setPhase('ready');
		} finally {
			onOperationEnd();
		}
	};

	const counts = summary?.contents ?? {};
	const availableTypes = EXPORT_TYPES.filter(
		({ key, hidden }) =>
			!hidden &&
			counts[key] > 0 &&
			('settings' !== key || settingsInFile.length > 0)
	);

	if (phase === 'done') {
		return (
			<Panel
				title={__('Import result', 'fotogrids')}
				titleTag="h3"
				equalBodyPadding
			>
				<ImportResult result={result} onReset={resetFile} />
			</Panel>
		);
	}

	return (
		<>
			<Panel
				title={
					!file
						? __('Select export file', 'fotogrids')
						: __('Selected export file', 'fotogrids')
				}
				titleTag="h3"
				equalBodyPadding
				action={
					file && (
						<button
							type="button"
							className="fg-ie-link-btn"
							onClick={resetFile}
						>
							{__('Choose a different file', 'fotogrids')}
						</button>
					)
				}
			>
				{phase === 'idle' || phase === 'analysing' ? (
					<>
						<FileUpload
							accept=".json,.xml"
							title={__('Select file to import', 'fotogrids')}
							subtitle={__(
								'Drop your .json or .xml export file here',
								'fotogrids'
							)}
							hint={__(
								'Supported formats: JSON, XML',
								'fotogrids'
							)}
							onFileReady={handleFileReady}
							inputId="fg-ie-import-file"
						/>
						{phase === 'analysing' && (
							<p
								className="fg-ie-hint fg-ie-hint--loading"
								aria-live="polite"
							>
								{__('Analysing file…', 'fotogrids')}
							</p>
						)}
						{analyseError && (
							<div className="fg-ie-error-notice" role="alert">
								{analyseError}
							</div>
						)}
					</>
				) : (
					<FileSummary file={file} summary={summary} />
				)}
			</Panel>

			{(phase === 'ready' || phase === 'importing') && (
				<Panel title={__('What to import', 'fotogrids')} titleTag="h3">
					{availableTypes.map(
						({ key, label, description, conflict }) => {
							const count = counts[key];
							const checked = include.has(key);

							const showCount =
								typeof count === 'number' && count > 0;
							const title = (
								<>
									{label}
									{showCount && (
										<>
											{' '}
											<span className="fg-ie-import-count">
												{count}
											</span>
										</>
									)}
								</>
							);

							return (
								<React.Fragment key={key}>
									<PanelRow
										title={title}
										description={description}
										splitColumns
										className="fg-ie-import-row"
									>
										<div className="fg-ie-import-row-control">
											{conflict && checked && (
												<Segmented
													options={CONFLICT_OPTIONS}
													value={getConflictMode(key)}
													onChange={(v) =>
														setTypeConflictMode(
															key,
															v
														)
													}
													disabled={
														phase === 'importing'
													}
													ariaLabel={
														label +
														' ' +
														__(
															'conflict handling',
															'fotogrids'
														)
													}
												/>
											)}
											<Toggle
												id={`fg-ie-import-${key}`}
												checked={checked}
												onChange={() =>
													toggleInclude(key)
												}
												disabled={phase === 'importing'}
											/>
										</div>
									</PanelRow>
									{'settings' === key &&
										checked &&
										settingsInFile.map((setting) => (
											<PanelRow
												key={setting.key}
												title={setting.label}
												description={
													setting.description
												}
												splitColumns
												className="fg-ie-import-row fg-ie-import-row--setting"
											>
												<div className="fg-ie-import-row-control">
													<Toggle
														id={`fg-ie-import-setting-${setting.key}`}
														checked={settingsInclude.has(
															setting.key
														)}
														onChange={() =>
															toggleSetting(
																setting.key
															)
														}
														disabled={
															phase ===
															'importing'
														}
													/>
												</div>
											</PanelRow>
										))}
								</React.Fragment>
							);
						}
					)}

					{importError && (
						<div className="fg-ie-error-notice" role="alert">
							{importError}
						</div>
					)}

					<DangerZone
						title={__('Ready to import', 'fotogrids')}
						description={__(
							'We recommend taking a database backup before importing. This action cannot be undone.',
							'fotogrids'
						)}
					>
						<Button
							variant="primary"
							disabled={effectiveInclude.length === 0}
							busy={phase === 'importing'}
							onClick={handleImport}
						>
							{phase === 'importing'
								? __('Importing…', 'fotogrids')
								: __('Import', 'fotogrids')}
						</Button>
					</DangerZone>
				</Panel>
			)}
		</>
	);
};

export default ImportPanel;
