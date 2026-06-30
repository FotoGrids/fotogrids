import React, { useState, useEffect } from 'react';
import { Modal } from '../shared/Modal';
import Icon from '../shared/Icon';

const { __ } = wp.i18n;

// Catalog tab indexes are cached per post type so reopening the Overview (or
// previewing another template of the same kind) doesn't refetch.
const catalogCache = {};

// Container node types in the catalog tree - they group settings but are not
// settings themselves, so they never produce a row.
const CONTAINER_TYPES = new Set([
	'setting_subtabs',
	'setting_group',
	'side_by_side',
]);

/**
 * Walk the assembled catalog tree and build a flat index of setting key to the
 * tab that owns it, preserving editor reading order.
 *
 * @param {Object} groups Map of tab id to tab node from the catalog endpoint.
 * @return {{ index: Object, tabOrder: Array }}
 */
const buildCatalogIndex = (groups) => {
	const index = {};
	const tabOrder = [];
	let order = 0;

	const walk = (nodes, tab) => {
		nodes.forEach((node) => {
			if (!node || typeof node !== 'object') return;

			const { key, type } = node;
			if (key && type && !CONTAINER_TYPES.has(type)) {
				index[key] = {
					tabId: tab.id,
					tabLabel: tab.label,
					label: node.label,
					type,
					options: node.options,
					order: order++,
				};
			}

			if (Array.isArray(node.settings)) {
				walk(node.settings, tab);
			}
			if (node.subTabs && typeof node.subTabs === 'object') {
				walk(Object.values(node.subTabs), tab);
			}
		});
	};

	Object.values(groups || {}).forEach((tabNode) => {
		if (!tabNode || typeof tabNode !== 'object') return;
		const tab = { id: tabNode.id, label: tabNode.label };
		if (!tab.id) return;
		tabOrder.push(tab);
		if (Array.isArray(tabNode.settings)) {
			walk(tabNode.settings, tab);
		}
		if (tabNode.subTabs && typeof tabNode.subTabs === 'object') {
			walk(Object.values(tabNode.subTabs), tab);
		}
	});

	return { index, tabOrder };
};

// Prefix-based grouping used only when the catalog can't be loaded (offline,
// library mode, or the settings bundle isn't present on the page).
const FALLBACK_GROUPS = [
	{
		id: 'layout',
		label: __('Layout', 'fotogrids'),
		exact: [
			'layout',
			'columns',
			'columns_mode',
			'columns_auto_range',
			'item_spacing',
		],
		prefixes: ['layout_', 'featured_', 'instant_photo_', 'masonry_'],
	},
	{
		id: 'appearance',
		label: __('Appearance', 'fotogrids'),
		exact: ['captions', 'lightbox'],
		prefixes: [
			'caption_',
			'lightbox_',
			'hover_',
			'border_',
			'shadow_',
			'image_filter',
			'radius',
		],
	},
	{
		id: 'interactions',
		label: __('Interactions', 'fotogrids'),
		exact: ['item_click_behavior'],
		prefixes: [
			'sharing',
			'direct_link',
			'external_',
			'watermark',
			'password',
			'permission',
		],
	},
];

const fallbackGroupId = (key) => {
	const group = FALLBACK_GROUPS.find(
		(g) =>
			(g.exact && g.exact.includes(key)) ||
			(g.prefixes && g.prefixes.some((p) => key.startsWith(p)))
	);
	return group ? group.id : 'other';
};

const FALLBACK_LABELS = {
	layout: __('Layout style', 'fotogrids'),
	columns: __('Columns', 'fotogrids'),
	item_spacing: __('Item spacing', 'fotogrids'),
	layout_item_aspect_ratio: __('Aspect ratio', 'fotogrids'),
	captions: __('Captions', 'fotogrids'),
	lightbox: __('Lightbox', 'fotogrids'),
	item_click_behavior: __('On click', 'fotogrids'),
};

const titleCase = (raw) =>
	String(raw)
		.replace(/[_-]+/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());

const isColorValue = (value) =>
	typeof value === 'string' && /^(#|rgb|hsl)/i.test(value.trim());

/**
 * Render a single setting value as readable content, using the catalog meta
 * (option labels, control type) when available.
 *
 * @param {*}      value Raw setting value.
 * @param {Object} meta  Catalog entry for the key, or undefined.
 * @return {React.ReactNode}
 */
const formatValue = (value, meta) => {
	if (typeof value === 'boolean') {
		return value ? __('On', 'fotogrids') : __('Off', 'fotogrids');
	}

	// Map a select/button-group value to its human option label.
	if (
		meta &&
		Array.isArray(meta.options) &&
		(typeof value === 'string' || typeof value === 'number')
	) {
		const option = meta.options.find(
			(opt) => String(opt.value) === String(value)
		);
		if (option && option.label) {
			return option.label;
		}
	}

	if (isColorValue(value)) {
		return (
			<span className="fotogrids-template-overview__color">
				<span
					className="fotogrids-template-overview__swatch"
					style={{ backgroundColor: value }}
					aria-hidden="true"
				/>
				{value}
			</span>
		);
	}

	if (value && typeof value === 'object' && !Array.isArray(value)) {
		const order = ['desktop', 'tablet', 'mobile'];
		const present = order.filter((bp) => value[bp] !== undefined);
		if (present.length) {
			return (
				<span className="fotogrids-template-overview__breakpoints">
					{present.map((bp) => (
						<span
							key={bp}
							className="fotogrids-template-overview__bp"
						>
							<span className="fotogrids-template-overview__bp-label">
								{titleCase(bp)}
							</span>
							<span className="fotogrids-template-overview__bp-value">
								{String(value[bp])}
							</span>
						</span>
					))}
				</span>
			);
		}
		return Object.values(value).map(String).join(' / ');
	}

	if (typeof value === 'string') {
		return titleCase(value);
	}

	return String(value);
};

const TemplateOverviewModal = ({ template, isPro, isOpen, onClose }) => {
	const settings = (template && template.settings) || {};
	const postType = template?.category === 'album' ? 'album' : 'gallery';
	const thumbnail = template
		? template.thumbnail_url ||
			template.preview ||
			template.preview_image ||
			''
		: '';

	const [catalog, setCatalog] = useState(null);
	const [status, setStatus] = useState('idle'); // idle | loading | ready | error

	// Load the same assembled catalog the gallery editor uses, so the Overview
	// groups settings into the real admin tabs. Falls back to prefix grouping
	// when the settings bundle isn't available.
	useEffect(() => {
		if (!isOpen) return undefined;

		const loader = window.FotoGridsSettings?.loadSettingsGroups;
		if (typeof loader !== 'function') {
			setStatus('error');
			return undefined;
		}

		if (catalogCache[postType]) {
			setCatalog(catalogCache[postType]);
			setStatus('ready');
			return undefined;
		}

		let active = true;
		setStatus('loading');
		loader(postType, false)
			.then((groups) => {
				if (!active) return;
				const built = buildCatalogIndex(groups);
				catalogCache[postType] = built;
				setCatalog(built);
				setStatus('ready');
			})
			.catch(() => {
				if (active) setStatus('error');
			});

		return () => {
			active = false;
		};
	}, [isOpen, postType]);

	const labelFor = (key) => {
		const meta = catalog?.index?.[key];
		return meta?.label || FALLBACK_LABELS[key] || titleCase(key);
	};

	// Build the ordered list of sections (one per touched admin tab) from the
	// catalog index, or from the prefix fallback when the catalog is absent.
	const buildSections = () => {
		const keys = Object.keys(settings);

		if (catalog && Object.keys(catalog.index).length) {
			const byTab = {};
			keys.forEach((key) => {
				const meta = catalog.index[key];
				const id = meta ? meta.tabId : '__other';
				(byTab[id] = byTab[id] || []).push(key);
			});

			const sections = catalog.tabOrder
				.filter((tab) => (byTab[tab.id] || []).length > 0)
				.map((tab) => ({
					id: tab.id,
					label: tab.label,
					keys: byTab[tab.id].sort(
						(a, b) =>
							catalog.index[a].order - catalog.index[b].order
					),
				}));

			if ((byTab.__other || []).length) {
				sections.push({
					id: '__other',
					label: __('Other', 'fotogrids'),
					keys: byTab.__other,
				});
			}
			return sections;
		}

		// Fallback: prefix grouping.
		const byGroup = {};
		keys.forEach((key) => {
			const id = fallbackGroupId(key);
			(byGroup[id] = byGroup[id] || []).push(key);
		});
		const sections = FALLBACK_GROUPS.filter(
			(g) => (byGroup[g.id] || []).length > 0
		).map((g) => ({ id: g.id, label: g.label, keys: byGroup[g.id] }));
		if ((byGroup.other || []).length) {
			sections.push({
				id: 'other',
				label: __('Other', 'fotogrids'),
				keys: byGroup.other,
			});
		}
		return sections;
	};

	const renderRows = (keys) =>
		keys.map((key) => (
			<div key={key} className="fotogrids-template-overview__row">
				<span className="fotogrids-template-overview__row-label">
					{labelFor(key)}
				</span>
				<span className="fotogrids-template-overview__row-value">
					{formatValue(settings[key], catalog?.index?.[key])}
				</span>
			</div>
		));

	const loadingCatalog = status === 'loading';
	const sections = loadingCatalog ? [] : buildSections();
	const hasSettings = sections.length > 0;

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="md">
			<Modal.Header>
				<Modal.HeaderTitle>
					{__('Template Overview', 'fotogrids')}
				</Modal.HeaderTitle>
			</Modal.Header>

			<Modal.Body>
				<div className="fotogrids-template-overview">
					<div className="fotogrids-template-overview__intro">
						<div className="fotogrids-template-overview__thumb">
							{thumbnail ? (
								<img
									src={thumbnail}
									alt={template?.name}
									loading="lazy"
									onError={(e) => {
										e.target.style.display = 'none';
										if (e.target.nextElementSibling) {
											e.target.nextElementSibling.style.display =
												'';
										}
									}}
								/>
							) : null}
							<div
								className="fotogrids-template-overview__thumb-placeholder"
								style={{ display: thumbnail ? 'none' : '' }}
							>
								<Icon name="image" />
							</div>
						</div>

						<div className="fotogrids-template-overview__meta">
							<h3 className="fotogrids-template-overview__name">
								{template?.name}
								{isPro && (
									<span className="fotogrids-pro-badge">
										{__('Pro', 'fotogrids')}
									</span>
								)}
							</h3>
							{template?.description && (
								<p className="fotogrids-template-overview__description">
									{template.description}
								</p>
							)}
						</div>
					</div>

					<div className="fotogrids-template-overview__settings">
						<h4 className="fotogrids-template-overview__settings-title">
							{__('Settings applied', 'fotogrids')}
						</h4>

						{loadingCatalog ? (
							<div className="fotogrids-template-overview__loading">
								<span className="spinner fg-is-active" />
							</div>
						) : hasSettings ? (
							sections.map((section) => (
								<div
									key={section.id}
									className="fotogrids-template-overview__group"
								>
									<span className="fotogrids-template-overview__group-label">
										{section.label}
									</span>
									<div className="fotogrids-template-overview__rows">
										{renderRows(section.keys)}
									</div>
								</div>
							))
						) : (
							<p className="fotogrids-template-overview__empty">
								{__(
									'This template applies its settings when you preview it.',
									'fotogrids'
								)}
							</p>
						)}
					</div>
				</div>
			</Modal.Body>
		</Modal>
	);
};

export default TemplateOverviewModal;
