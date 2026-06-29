/**
 * Templates Page Component
 *
 * Displays pre-defined and user-created templates for galleries and albums.
 * Templates are organized by type (Gallery/Album) with side tabs.
 */
import React, { useState, useEffect } from 'react';
import PreviewTemplateModal from '../templates/PreviewTemplateModal';
import ApplyTemplateModal from '../templates/ApplyTemplateModal';
import Icon from '../shared/Icon';
import { Button } from '../shared/Button';
import Checkbox from '../shared/Checkbox';

const { __ } = wp.i18n;

// Album templates are not ready for release; set to true to re-enable the tab.
const ALBUM_TEMPLATES_ENABLED = false;

/**
 * Single template card with a state-driven thumbnail fallback.
 *
 * The fallback is React state rather than an imperative onError DOM mutation so
 * that a refreshed catalog (same template id, new thumbnail_url) reuses this
 * node and shows the new image. An imperative style.display change would survive
 * reconciliation and keep the refreshed thumbnail hidden until a full reload.
 */
const TemplateCard = ({ template, isProActive, onPreview, onApply }) => {
	const src = template.thumbnail_url || template.preview || '';
	const [imgError, setImgError] = useState(false);

	// Re-attempt the image whenever the source changes (e.g. after a refresh).
	useEffect(() => {
		setImgError(false);
	}, [src]);

	const isProTemplate = template.type !== 'free' && !isProActive;
	const canApply =
		template.can_apply !== undefined ? template.can_apply : !isProTemplate;
	const showImage = src && !imgError;

	return (
		<div className="fotogrids-template-card">
			{isProTemplate && (
				<span className="fotogrids-pro-badge fotogrids-pro-badge__absolute">
					{__('PRO', 'fotogrids')}
				</span>
			)}

			<div
				className="fotogrids-template-card__preview"
				onClick={() => onPreview(template)}
				style={{ cursor: 'pointer' }}
			>
				{showImage ? (
					<img
						src={src}
						alt={template.name}
						loading="lazy"
						onError={() => setImgError(true)}
					/>
				) : (
					<div className="fotogrids-template-card__preview-placeholder">
						<Icon name="image" />
					</div>
				)}
			</div>

			<div className="fotogrids-template-card__content">
				<h3>{template.name}</h3>
				{template.description && <p>{template.description}</p>}

				<div className="fotogrids-template-card__actions">
					<Button
						variant="secondary"
						size="xs"
						onClick={() => onPreview(template)}
					>
						{__('Preview', 'fotogrids')}
					</Button>
					{canApply && (
						<Button
							variant="primary"
							size="xs"
							onClick={() => onApply(template)}
						>
							{__('Apply', 'fotogrids')}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
};

const TemplatesPage = () => {
	const [activeTab, setActiveTab] = useState('gallery');
	const [templates, setTemplates] = useState({ gallery: [], album: [] });
	const [userTemplates, setUserTemplates] = useState({
		gallery: [],
		album: [],
	});
	const [loading, setLoading] = useState(true);
	const [selectedTemplate, setSelectedTemplate] = useState(null);
	const [showPreviewModal, setShowPreviewModal] = useState(false);
	const [showApplyModal, setShowApplyModal] = useState(false);
	const [showUserTemplates, setShowUserTemplates] = useState(false);
	const [showFotoGridsTemplates, setShowFotoGridsTemplates] = useState(true);
	const [showFree, setShowFree] = useState(true);
	const [showPro, setShowPro] = useState(true);
	const [libraryMeta, setLibraryMeta] = useState(null);
	const [refreshing, setRefreshing] = useState(false);
	const isProActive = window.fotogridsSettings?.isProActive || false;

	useEffect(() => {
		loadTemplates();
	}, []);

	// Open a template directly when the page is loaded with ?fg_preview=<id>,
	// so a specific template preview can be linked to. Runs once templates are
	// available so the matching template object can be resolved.
	useEffect(() => {
		if (loading) {
			return;
		}
		const params = new URLSearchParams(window.location.search);
		const previewId = params.get('fg_preview');
		if (!previewId) {
			return;
		}
		const pool = [
			...templates.gallery,
			...templates.album,
			...userTemplates.gallery,
			...userTemplates.album,
		];
		const match = pool.find((t) => t.id === previewId);
		if (match) {
			handlePreview(match);
		}
	}, [loading]);

	const setPreviewParam = (templateId) => {
		const url = new URL(window.location.href);
		if (templateId) {
			url.searchParams.set('fg_preview', templateId);
		} else {
			url.searchParams.delete('fg_preview');
		}
		window.history.replaceState({}, '', url.toString());
	};

	const loadTemplates = async (forceRefresh = false) => {
		if (forceRefresh) {
			setRefreshing(true);
		} else {
			setLoading(true);
		}
		try {
			const response = await wp.apiFetch({
				path: forceRefresh
					? '/fotogrids/v1/templates?refresh=1'
					: '/fotogrids/v1/templates',
				method: 'GET',
			});

			if (response.templates) {
				const galleryTemplates = response.templates.filter(
					(t) => t.category === 'gallery' || !t.category
				);
				const albumTemplates = response.templates.filter(
					(t) => t.category === 'album'
				);

				setTemplates({
					gallery: galleryTemplates.filter((t) => !t.isUserTemplate),
					album: albumTemplates.filter((t) => !t.isUserTemplate),
				});

				setUserTemplates({
					gallery: galleryTemplates.filter((t) => t.isUserTemplate),
					album: albumTemplates.filter((t) => t.isUserTemplate),
				});
			}

			if (response.library) {
				setLibraryMeta(response.library);
			}

			if (forceRefresh && window.fotogridsToast) {
				window.fotogridsToast.success(
					__('Template library refreshed.', 'fotogrids')
				);
			}
		} catch (error) {
			console.error('Error loading templates:', error);
			if (window.fotogridsToast) {
				window.fotogridsToast.error(
					__('Failed to load templates.', 'fotogrids')
				);
			}
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	};

	// Relative "x ago" string is computed server-side (human_time_diff) so the
	// admin UI needs no time-ago formatter. Absolute time is used for the title
	// tooltip. fetched_at is the last successful server sync, not the page load.
	const syncedAgo = (meta) =>
		meta && meta.synced_human ? meta.synced_human : '';

	const syncedAbsolute = (meta) => {
		if (!meta || !meta.fetched_at) {
			return '';
		}
		return new Date(meta.fetched_at * 1000).toLocaleString();
	};

	const handlePreview = (template) => {
		// All previews open in the modal. The modal iframes the live demo page
		// (mode 'iframe') or renders locally (mode 'local').
		setSelectedTemplate(template);
		setShowPreviewModal(true);
		setPreviewParam(template.id);
	};

	const handleApply = (template) => {
		setSelectedTemplate(template);
		setShowApplyModal(true);
	};

	const renderTemplateCard = (template) => (
		<TemplateCard
			key={template.id}
			template={template}
			isProActive={isProActive}
			onPreview={handlePreview}
			onApply={handleApply}
		/>
	);

	const infoItems = [
		{
			key: 'time',
			title: __('Save valuable time', 'fotogrids'),
			description: __(
				'Launch new galleries in minutes using ready-made layouts instead of rebuilding designs from scratch.',
				'fotogrids'
			),
		},
		{
			key: 'consistency',
			title: __('Keep every gallery on-brand', 'fotogrids'),
			description: __(
				'Apply the same spacing, colors and interactions across multiple galleries and albums with one click.',
				'fotogrids'
			),
		},
		{
			key: 'userTemplates',
			title: __('Create your own templates', 'fotogrids'),
			description: __(
				'Turn your best-performing gallery and album designs into reusable templates that your whole team can apply in a few clicks.',
				'fotogrids'
			),
			pro: true,
		},
	];

	const renderInfoColumn = () => {
		if (isProActive) {
			return null;
		}

		return (
			<aside className="fotogrids-templates-page__info">
				<h2>{__('What are Templates?', 'fotogrids')}</h2>
				<p>
					{__(
						'Templates are complete, ready-to-use gallery and album configurations.',
						'fotogrids'
					)}
				</p>
				<p>
					{__(
						'Templates bundle layout, spacing, hover effects and styling into reusable presets that you can apply in one click.',
						'fotogrids'
					)}
				</p>

				<ul className="fotogrids-templates-page__info-list">
					{infoItems.map((item) => (
						<li
							key={item.key}
							className={`fotogrids-templates-page__info-item ${item.pro ? 'fotogrids-templates-page__info-item--pro' : ''}`}
							onClick={() => {
								if (item.pro && window.FotoGridsUpgrade) {
									if (
										window.FotoGridsUpgrade
											.launchForFeature &&
										window.FotoGridsUpgrade.launchForFeature
											.templates
									) {
										window.FotoGridsUpgrade.launchForFeature.templates();
									} else if (window.FotoGridsUpgrade.launch) {
										window.FotoGridsUpgrade.launch(
											'templates'
										);
									}
								}
							}}
						>
							<div className="fotogrids-templates-page__info-item__heading">
								<Icon name="check_circle" />
								<h5>
									{item.title}
									{item.pro && (
										<span className="fotogrids-pro-badge">
											{__('Pro', 'fotogrids')}
										</span>
									)}
								</h5>
							</div>
							<p>{item.description}</p>
						</li>
					))}
				</ul>
			</aside>
		);
	};

	const handleUserTemplatesChange = (checked) => {
		if (!checked && !showFotoGridsTemplates) {
			// Can't uncheck if FotoGrids templates is also unchecked
			return;
		}
		setShowUserTemplates(checked);
	};

	const handleFotoGridsTemplatesChange = (checked) => {
		if (!checked && !showUserTemplates) {
			// Can't uncheck if user templates is also unchecked
			return;
		}
		setShowFotoGridsTemplates(checked);
	};

	const handleFreeChange = (checked) => {
		// Keep at least one tier visible.
		if (!checked && !showPro) {
			return;
		}
		setShowFree(checked);
	};

	const handleProChange = (checked) => {
		if (!checked && !showFree) {
			return;
		}
		setShowPro(checked);
	};

	const currentTemplates = templates[activeTab] || [];
	const currentUserTemplates = userTemplates[activeTab] || [];
	const filteredUserTemplates = showUserTemplates ? currentUserTemplates : [];

	// Free / Pro toggles filter the already-loaded FotoGrids cards client-side;
	// no refetch. A template counts as Pro when its type is anything but 'free'.
	const matchesTier = (template) => {
		const isPro = template.type && template.type !== 'free';
		return isPro ? showPro : showFree;
	};
	const filteredTemplates = showFotoGridsTemplates
		? currentTemplates.filter(matchesTier)
		: [];

	// The library can hide Pro entirely (flags.show_pro). When hidden there are
	// no Pro templates in the payload, so the Free/Pro tier toggles serve no
	// purpose and are removed.
	const proTierVisible = libraryMeta?.flags?.show_pro !== false;
	const activeTemplateType =
		activeTab === 'gallery'
			? __('Gallery', 'fotogrids')
			: __('Album', 'fotogrids');

	return (
		<div className="fotogrids-templates-page">
			{!isProActive && renderInfoColumn()}

			<div className="fotogrids-templates-page__main">
				<div className="fotogrids-templates-page__header">
					<div className="fotogrids-templates-page__tabs">
						<button
							type="button"
							className={`fotogrids-templates-page__tab ${activeTab === 'gallery' ? 'fg-is-active' : ''}`}
							onClick={() => setActiveTab('gallery')}
						>
							<span className="fotogrids-templates-page__tab__icon">
								<Icon name="layout_3x3" />
							</span>
							<span className="fotogrids-templates-page__tab__label">
								{__('Gallery Templates', 'fotogrids')}
							</span>
						</button>
						{ALBUM_TEMPLATES_ENABLED && (
							<button
								type="button"
								className={`fotogrids-templates-page__tab ${activeTab === 'album' ? 'fg-is-active' : ''}`}
								onClick={() => setActiveTab('album')}
							>
								<span className="fotogrids-templates-page__tab__icon">
									<Icon name="layout_2x2" />
								</span>
								<span className="fotogrids-templates-page__tab__label">
									{__('Album Templates', 'fotogrids')}
								</span>
							</button>
						)}
					</div>

					<div className="fotogrids-templates-page__types">
						<Checkbox
							checked={showUserTemplates}
							onChange={handleUserTemplatesChange}
							disabled={!isProActive}
							label={__('Your Templates', 'fotogrids')}
						/>
						<Checkbox
							checked={showFotoGridsTemplates}
							onChange={handleFotoGridsTemplatesChange}
							label={__('FotoGrids Templates', 'fotogrids')}
						/>
					</div>
				</div>

				<div className="fotogrids-templates-page__content">
					{!loading && (
						<div className="fotogrids-templates-page__library-bar">
							{showFotoGridsTemplates && proTierVisible && (
								<div className="fotogrids-templates-page__library-bar__tiers">
									<Checkbox
										checked={showFree}
										onChange={handleFreeChange}
										label={__('Free', 'fotogrids')}
									/>
									<Checkbox
										checked={showPro}
										onChange={handleProChange}
										label={__('Pro', 'fotogrids')}
									/>
								</div>
							)}
							<span
								className="fotogrids-templates-page__library-bar__updated"
								title={
									libraryMeta && libraryMeta.fetched_at
										? __(
												'Last synced from the FotoGrids template library. The catalog is cached and refreshes periodically; use Refresh to sync now.',
												'fotogrids'
											) +
											` (${syncedAbsolute(libraryMeta)})`
										: ''
								}
							>
								{libraryMeta && syncedAgo(libraryMeta)
									? __(
											'Last synced {time} ago',
											'fotogrids'
										).replace(
											'{time}',
											syncedAgo(libraryMeta)
										)
									: __(
											'Showing built-in templates',
											'fotogrids'
										)}
							</span>
							<Button
								variant="secondary"
								size="sm"
								icon="refresh_cv"
								className={
									refreshing
										? 'fotogrids-refresh-spinning'
										: ''
								}
								onClick={() => loadTemplates(true)}
								disabled={refreshing || loading}
							>
								{__('Refresh library', 'fotogrids')}
							</Button>
						</div>
					)}

					{loading ? (
						<div className="fotogrids-templates-page--loading">
							<span className="spinner fg-is-active"></span>
							<p>{__('Loading templates...', 'fotogrids')}</p>
						</div>
					) : (
						<>
							{filteredUserTemplates.length > 0 && (
								<div className="fotogrids-templates-page__section">
									<h2>{__('My Templates', 'fotogrids')}</h2>
									<div className="fotogrids-templates-page__grid">
										{filteredUserTemplates.map(
											renderTemplateCard
										)}
									</div>
								</div>
							)}

							{filteredTemplates.length > 0 && (
								<div className="fotogrids-templates-page__section">
									{filteredUserTemplates.length > 0 && (
										<h2>
											{__(
												'FotoGrids {type} Templates',
												'fotogrids'
											).replace(
												'{type}',
												activeTemplateType
											)}
										</h2>
									)}
									<div className="fotogrids-templates-page__grid">
										{filteredTemplates.map(
											renderTemplateCard
										)}
									</div>
								</div>
							)}

							{filteredUserTemplates.length === 0 &&
								filteredTemplates.length === 0 && (
									<p className="fotogrids-templates-page--empty">
										{__(
											'No templates available.',
											'fotogrids'
										)}
									</p>
								)}
						</>
					)}
				</div>
			</div>

			{showPreviewModal && selectedTemplate && (
				<PreviewTemplateModal
					template={selectedTemplate}
					onClose={() => {
						setShowPreviewModal(false);
						setPreviewParam(null);
					}}
					onApply={(template) => {
						setShowPreviewModal(false);
						setPreviewParam(null);
						handleApply(template);
					}}
				/>
			)}

			{showApplyModal && selectedTemplate && (
				<ApplyTemplateModal
					template={selectedTemplate}
					isOpen={showApplyModal}
					onClose={() => setShowApplyModal(false)}
					onSuccess={() => {
						setShowApplyModal(false);
						loadTemplates();
					}}
				/>
			)}
		</div>
	);
};

export default TemplatesPage;
