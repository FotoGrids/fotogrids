import React, { useState, useEffect, useCallback } from 'react';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import Panel from '@/admin/src/components/shared/SidebarTabs/elements/Panel.jsx';
import TabBar from '@/admin/src/components/shared/TabBar.jsx';
import Icon from '@/admin/src/components/shared/Icon.jsx';
import Checkbox from '@/admin/src/components/shared/Checkbox.jsx';
import Segmented from '@/admin/src/components/shared/Segmented.jsx';
import { Button } from '@/admin/src/components/shared/Button';

const baseClass = 'fg-migration';

/**
 * Display categories for the source picker, in order. Each maps the source
 * group slugs it contains: WordPress core and gallery plugins share the
 * "Galleries" category; slider plugins get their own. A source whose group
 * matches no category falls back to "Galleries".
 */
const CATEGORIES = [
	{
		id: 'galleries',
		label: __('Galleries', 'fotogrids'),
		groups: ['wordpress', 'gallery'],
	},
	{ id: 'sliders', label: __('Sliders', 'fotogrids'), groups: ['slider'] },
];

const restPath = (path) => `/fotogrids/v1/admin/tools/migration/${path}`;

/**
 * Status pill shown on a source card. Only unavailable (coming-soon) sources
 * carry a pill; available sources show none.
 */
const SourceStatus = ({ source }) => {
	if (source.available) {
		return null;
	}

	return (
		<span className={`${baseClass}__source-status`}>
			{__('Coming soon', 'fotogrids')}
		</span>
	);
};

/**
 * A single source-plugin card.
 */
const SourceCard = ({ source, active, onSelect }) => {
	const cardClasses = [
		`${baseClass}__source-card`,
		active ? `${baseClass}__source-card--active` : '',
		source.available ? '' : `${baseClass}__source-card--soon`,
	]
		.filter(Boolean)
		.join(' ');

	return (
		<button
			type="button"
			className={cardClasses}
			onClick={() => onSelect(source.id)}
			aria-pressed={active}
		>
			<span
				className={`${baseClass}__source-icon`}
				style={{
					'--fg-source-color': source.brand_color || 'var(--fg-blue)',
				}}
			>
				<Icon name={source.icon} />
			</span>
			<span className={`${baseClass}__source-body`}>
				<span className={`${baseClass}__source-title`}>
					<span className={`${baseClass}__source-name`}>
						{source.label}
					</span>
					<SourceStatus source={source} />
				</span>
			</span>
		</button>
	);
};

/**
 * Preview table of detected galleries with per-row selection.
 */
const PreviewTable = ({ galleries, selected, onToggle, onToggleAll }) => {
	const allSelected =
		galleries.length > 0 && selected.size === galleries.length;
	const someSelected = selected.size > 0 && !allSelected;

	return (
		<table className={`${baseClass}__preview`}>
			<thead>
				<tr>
					<th className={`${baseClass}__preview-check`}>
						<Checkbox
							checked={allSelected}
							indeterminate={someSelected}
							onChange={onToggleAll}
							ariaLabel={__('Select all galleries', 'fotogrids')}
						/>
					</th>
					<th>{__('Gallery', 'fotogrids')}</th>
					<th>{__('Images', 'fotogrids')}</th>
					<th>{__('Source', 'fotogrids')}</th>
				</tr>
			</thead>
			<tbody>
				{galleries.map((gallery) => (
					<tr key={gallery.ref}>
						<td className={`${baseClass}__preview-check`}>
							<Checkbox
								checked={selected.has(gallery.ref)}
								onChange={() => onToggle(gallery.ref)}
								ariaLabel={sprintf(
									/* translators: %s: gallery title */
									__('Select %s', 'fotogrids'),
									gallery.title
								)}
							/>
						</td>
						<td>
							<span className={`${baseClass}__preview-thumb`}>
								{gallery.thumbnail_url ? (
									<img src={gallery.thumbnail_url} alt="" />
								) : (
									<Icon name="image" />
								)}
							</span>
							<span className={`${baseClass}__preview-title`}>
								{gallery.title}
							</span>
						</td>
						<td>{gallery.item_count}</td>
						<td className={`${baseClass}__preview-origin`}>
							{gallery.origin_url ? (
								<a
									href={gallery.origin_url}
									target="_blank"
									rel="noreferrer"
								>
									{gallery.origin}
								</a>
							) : (
								gallery.origin
							)}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
};

/**
 * The functional import flow for an available source: scan, preview-select,
 * import, then a result summary.
 */
const ImportFlow = ({ source }) => {
	const [phase, setPhase] = useState('idle'); // idle | scanning | preview | importing | done
	const [galleries, setGalleries] = useState([]);
	const [selected, setSelected] = useState(new Set());
	const [conflict, setConflict] = useState('skip');
	const [result, setResult] = useState(null);
	const [error, setError] = useState(null);

	// Reset the flow whenever the selected source changes.
	useEffect(() => {
		setPhase('idle');
		setGalleries([]);
		setSelected(new Set());
		setResult(null);
		setError(null);
	}, [source.id]);

	const scan = useCallback(async () => {
		setPhase('scanning');
		setError(null);
		try {
			const response = await apiFetch({
				path: restPath(`scan?source=${encodeURIComponent(source.id)}`),
			});
			const found = response.galleries || [];
			setGalleries(found);
			setSelected(new Set(found.map((g) => g.ref)));
			setPhase('preview');
		} catch (err) {
			setError(err.message || __('Scan failed.', 'fotogrids'));
			setPhase('idle');
		}
	}, [source.id]);

	const runImport = useCallback(async () => {
		setPhase('importing');
		setError(null);
		try {
			const response = await apiFetch({
				path: restPath('import'),
				method: 'POST',
				data: {
					source: source.id,
					refs: Array.from(selected),
					conflict,
				},
			});
			setResult(response);
			setPhase('done');
		} catch (err) {
			setError(err.message || __('Import failed.', 'fotogrids'));
			setPhase('preview');
		}
	}, [source.id, selected, conflict]);

	const toggle = (ref) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(ref)) {
				next.delete(ref);
			} else {
				next.add(ref);
			}
			return next;
		});
	};

	const toggleAll = (checked) => {
		setSelected(checked ? new Set(galleries.map((g) => g.ref)) : new Set());
	};

	if (phase === 'done' && result) {
		return (
			<Panel equalBodyPadding>
				<div className={`${baseClass}__result`}>
					<span className={`${baseClass}__result-icon`}>
						<Icon name="check" />
					</span>
					<h3 className={`${baseClass}__result-title`}>
						{__('Import complete', 'fotogrids')}
					</h3>
					<p className={`${baseClass}__result-text`}>
						{sprintf(
							/* translators: 1: imported count, 2: skipped count */
							__(
								'%1$d galleries imported, %2$d skipped.',
								'fotogrids'
							),
							result.imported,
							result.skipped
						)}
					</p>
					{(result.messages || []).map((message, i) => (
						<p key={i} className={`${baseClass}__result-message`}>
							{message}
						</p>
					))}
					<Button variant="primary" onClick={scan}>
						{__('Scan again', 'fotogrids')}
					</Button>
				</div>
			</Panel>
		);
	}

	return (
		<Panel
			title={source.label}
			description={source.description}
			equalBodyPadding
		>
			{error && <div className={`${baseClass}__error`}>{error}</div>}

			{phase === 'idle' && (
				<div className={`${baseClass}__scan-cta`}>
					<Button variant="primary" onClick={scan}>
						{__('Scan galleries', 'fotogrids')}
					</Button>
				</div>
			)}

			{phase === 'scanning' && (
				<p className={`${baseClass}__loading`}>
					{__('Scanning…', 'fotogrids')}
				</p>
			)}

			{(phase === 'preview' || phase === 'importing') &&
				(galleries.length === 0 ? (
					<p className={`${baseClass}__empty`}>
						{__('No galleries found for this source.', 'fotogrids')}
					</p>
				) : (
					<>
						<PreviewTable
							galleries={galleries}
							selected={selected}
							onToggle={toggle}
							onToggleAll={toggleAll}
						/>
						<div className={`${baseClass}__import-bar`}>
							<div className={`${baseClass}__conflict`}>
								<span>
									{__(
										'If a gallery already exists:',
										'fotogrids'
									)}
								</span>
								<Segmented
									ariaLabel={__(
										'If a gallery already exists',
										'fotogrids'
									)}
									value={conflict}
									onChange={setConflict}
									options={[
										{
											value: 'skip',
											label: __('Skip', 'fotogrids'),
										},
										{
											value: 'duplicate',
											label: __('Duplicate', 'fotogrids'),
										},
									]}
								/>
							</div>
							<Button
								variant="primary"
								disabled={
									selected.size === 0 || phase === 'importing'
								}
								onClick={runImport}
							>
								{phase === 'importing'
									? __('Importing…', 'fotogrids')
									: sprintf(
											/* translators: %d: number of selected galleries */
											__(
												'Import %d galleries',
												'fotogrids'
											),
											selected.size
										)}
							</Button>
						</div>
					</>
				))}
		</Panel>
	);
};

/**
 * The coming-soon panel for a registered-but-unavailable source.
 */
const ComingSoonPanel = ({ source }) => (
	<Panel equalBodyPadding>
		<div className={`${baseClass}__placeholder`}>
			<span
				className={`${baseClass}__placeholder-icon`}
				style={{
					'--fg-source-color': source.brand_color || 'var(--fg-blue)',
				}}
			>
				<Icon name={source.icon} />
			</span>
			<h3 className={`${baseClass}__placeholder-title`}>
				{source.label}
			</h3>
			<p className={`${baseClass}__placeholder-text`}>
				{source.detected ? (
					<>
						{__(
							'We found the plugin installed on your site.',
							'fotogrids'
						)}
						<br />
						{__(
							'Migration support for this plugin is coming soon.',
							'fotogrids'
						)}
					</>
				) : (
					<>
						{__(
							'Migration from this plugin isn’t available yet.',
							'fotogrids'
						)}
						<br />
						{__(
							'Support is planned for an upcoming release.',
							'fotogrids'
						)}
					</>
				)}
			</p>
			<Button variant="primary" disabled>
				{__('Coming soon', 'fotogrids')}
			</Button>
		</div>
	</Panel>
);

/**
 * Migration Tool
 *
 * Loads the source manifest from the REST API, renders the grouped source
 * picker (WordPress first, then gallery plugins, then sliders), and drives
 * the scan → preview → import flow for the selected source. Sources whose
 * reader isn't implemented yet show a coming-soon panel.
 */
const MigrationTool = () => {
	const [sources, setSources] = useState([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState(null);
	const [selectedSource, setSelectedSource] = useState(null);
	const [activeTab, setActiveTab] = useState('choose');

	useEffect(() => {
		let active = true;
		(async () => {
			try {
				const manifest = await apiFetch({ path: restPath('sources') });
				if (active) {
					setSources(manifest);
					setLoading(false);
				}
			} catch (err) {
				if (active) {
					setLoadError(
						err.message ||
							__('Could not load migration sources.', 'fotogrids')
					);
					setLoading(false);
				}
			}
		})();
		return () => {
			active = false;
		};
	}, []);

	const current = sources.find((s) => s.id === selectedSource) || null;

	const categoryOf = (source) => {
		const match = CATEGORIES.find((c) => c.groups.includes(source.group));
		return match ? match.id : CATEGORIES[0].id;
	};

	const selectSource = (id) => {
		setSelectedSource(id);
		setActiveTab('run');
	};

	const tabs = current
		? [
				{
					id: 'choose',
					icon: 'layout_2x2',
					label: __('Choose', 'fotogrids'),
				},
				{ id: 'run', icon: 'import', label: __('Run', 'fotogrids') },
			]
		: [
				{
					id: 'choose',
					icon: 'layout_2x2',
					label: __('Choose', 'fotogrids'),
				},
			];

	return (
		<>
			<Panel
				title={__('Migration', 'fotogrids')}
				description={__(
					'Moving from another plugin? Choose the source and FotoGrids will help bring your galleries over.',
					'fotogrids'
				)}
				longDescription
				noBodyPadding
			>
				<TabBar
					tabs={tabs}
					activeTab={activeTab}
					onTabChange={setActiveTab}
				/>
			</Panel>

			{loading && (
				<Panel equalBodyPadding>
					<p className={`${baseClass}__loading`}>
						{__('Loading sources…', 'fotogrids')}
					</p>
				</Panel>
			)}

			{loadError && (
				<Panel equalBodyPadding>
					<div className={`${baseClass}__error`}>{loadError}</div>
				</Panel>
			)}

			{!loading &&
				!loadError &&
				activeTab === 'choose' &&
				CATEGORIES.map((category) => {
					const categorySources = sources.filter(
						(s) => categoryOf(s) === category.id
					);
					if (categorySources.length === 0) {
						return null;
					}
					return (
						<Panel
							key={category.id}
							title={category.label}
							equalBodyPadding
						>
							<div className={`${baseClass}__sources`}>
								{categorySources.map((source) => (
									<SourceCard
										key={source.id}
										source={source}
										active={selectedSource === source.id}
										onSelect={selectSource}
									/>
								))}
							</div>
						</Panel>
					);
				})}

			{activeTab === 'run' &&
				current &&
				(current.available ? (
					<ImportFlow source={current} />
				) : (
					<ComingSoonPanel source={current} />
				))}
		</>
	);
};

export default MigrationTool;
