import React, { useState, useEffect } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { FormField } from '../shared/FormField';
import Segmented from '../shared/Segmented';
import Select from '../shared/Select';
import NumberField from '../shared/NumberField';
import TemplateOverviewModal from './TemplateOverviewModal';
import ApplyTemplateModal from './ApplyTemplateModal';

const { __ } = wp.i18n;

// Device preset widths (px) used to constrain the preview iframe so the
// template's responsive columns render at real breakpoints.
const DEVICE_WIDTHS = {
	desktop: 0, // 0 = full width
	tablet: 768,
	mobile: 390,
};

const DEFAULT_CUSTOM_BG = '#0066cc';
const DEFAULT_CUSTOM_WIDTH = 1000;

const PreviewTemplateModal = ({ template, onClose, onApply }) => {
	const [showOverviewModal, setShowOverviewModal] = useState(false);
	const [showApplyModal, setShowApplyModal] = useState(false);
	const [pageBackground, setPageBackground] = useState('light'); // 'light' | 'dark' | 'custom'
	const [customBgColor, setCustomBgColor] = useState(DEFAULT_CUSTOM_BG);
	const [device, setDevice] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile' | 'custom'
	const [customWidth, setCustomWidth] = useState(DEFAULT_CUSTOM_WIDTH);

	const isPro = template?.type !== 'free' && template?.type !== undefined;

	// The preview iframe (a demo page on the library service) can ask the parent
	// to apply the template via postMessage. Only act on messages from the
	// configured library origin, and only for the template being previewed.
	useEffect(() => {
		if (!template) {
			return undefined;
		}

		// Accept messages from either the library subdomain or the main site:
		// today library.fotogrids.com redirects to www, so the iframe's real
		// origin is www; a future standalone library site is covered too.
		// Override with window.fotogridsAdmin.libraryOrigins (array) if needed.
		const allowedOrigins = window.fotogridsAdmin?.libraryOrigins || [
			'https://library.fotogrids.com',
			'https://www.fotogrids.com',
		];

		const onMessage = (event) => {
			if (!allowedOrigins.includes(event.origin)) {
				return;
			}
			const data = event.data;
			if (
				!data ||
				typeof data !== 'object' ||
				data.type !== 'fotogrids:apply'
			) {
				return;
			}
			// If the message names a template, it must match the one on screen.
			if (
				data.templateId &&
				template.id &&
				data.templateId !== template.id
			) {
				return;
			}
			if (onApply) {
				onApply(template);
			} else {
				setShowApplyModal(true);
			}
		};

		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	}, [template, onApply]);

	// Background controls only affect the locally-rendered preview; for an
	// iframed live demo page they have no effect, so hide them in that mode.
	const isIframePreview = template?.preview_handler?.mode === 'iframe';

	const resolvedWidth = () => {
		if (device === 'custom') {
			return Math.max(
				280,
				parseInt(customWidth, 10) || DEFAULT_CUSTOM_WIDTH
			);
		}
		return DEVICE_WIDTHS[device] || 0;
	};

	const getPreviewUrl = (template) => {
		const handler = template.preview_handler || { mode: 'local' };

		// Catalog templates iframe their live demo page on the library service.
		if (handler.mode === 'iframe' && handler.url) {
			return handler.url;
		}

		// Local render (user templates, offline fallback, Pro-installed path).
		const baseUrl =
			window.fotogridsAdmin?.apiUrl ||
			window.location.origin + '/wp-json/';
		const previewUrl = new URL('fotogrids/v1/templates/preview', baseUrl);

		const restNonce =
			window.fotogridsAdmin?.restNonce || wpApiSettings?.nonce || '';
		if (restNonce) {
			previewUrl.searchParams.append('_wpnonce', restNonce);
		}

		previewUrl.searchParams.append('template_id', template.id);
		previewUrl.searchParams.append(
			'category',
			template.category || 'gallery'
		);

		previewUrl.searchParams.append('preview_background', pageBackground);
		if (pageBackground === 'custom') {
			previewUrl.searchParams.append('preview_bg_color', customBgColor);
		}

		return previewUrl.toString();
	};

	const getIframeStyle = () => {
		const width = resolvedWidth();
		const style = {
			border: 'none',
			backgroundColor: 'transparent',
		};

		if (width > 0) {
			style.width = `${width}px`;
			style.maxWidth = '100%';
			style.margin = '0 auto';
			style.display = 'block';
		} else {
			style.width = '100%';
		}

		return style;
	};

	// Reuse the plugin's color picker widget (exposed as a plain global by the
	// render-settings bundle); fall back to a native input where it is absent.
	const renderBackgroundColorPicker = () => {
		const renderer = window.FotoGridsRenderSettings?.renderColorPicker;
		if (!renderer) {
			return (
				<input
					id="preview-bg-color"
					type="color"
					className="fotogrids-color-input"
					value={customBgColor}
					onChange={(e) => setCustomBgColor(e.target.value)}
				/>
			);
		}
		return renderer(
			{ key: 'preview_bg_color', default: DEFAULT_CUSTOM_BG },
			customBgColor,
			false,
			{
				updateSetting: (key, value) => setCustomBgColor(value),
				getFieldState: () => 'editable',
				__,
			}
		);
	};

	const deviceControl = (
		<div className="fotogrids-template-preview__header-center">
			<Segmented
				ariaLabel={__('Preview device', 'fotogrids')}
				value={device}
				onChange={setDevice}
				options={[
					{
						value: 'desktop',
						label: __('Desktop', 'fotogrids'),
						icon: 'responsive_desktop',
					},
					{
						value: 'tablet',
						label: __('Tablet', 'fotogrids'),
						icon: 'responsive_tablet',
					},
					{
						value: 'mobile',
						label: __('Mobile', 'fotogrids'),
						icon: 'responsive_mobile',
					},
					{ value: 'custom', label: __('Custom', 'fotogrids') },
				]}
			/>
		</div>
	);

	return (
		<>
			<Modal isOpen={!!template} onClose={onClose} size="full">
				<Modal.Header
					size="sm"
					className="fotogrids-template-preview__header"
				>
					<Button
						variant="secondary"
						size="xs"
						icon="chevron_left"
						onClick={onClose}
					>
						{__('Back', 'fotogrids')}
					</Button>

					{deviceControl}

					<Modal.HeaderActions>
						<Button
							variant="secondary"
							size="xs"
							onClick={() => setShowOverviewModal(true)}
						>
							{__('Overview', 'fotogrids')}
						</Button>
						<Button
							variant="primary"
							size="xs"
							onClick={() => {
								if (onApply) {
									onApply(template);
								} else {
									setShowApplyModal(true);
								}
							}}
						>
							{__('Apply', 'fotogrids')}
						</Button>
					</Modal.HeaderActions>
				</Modal.Header>

				{(device === 'custom' || !isIframePreview) && (
					<Modal.SubHeader>
						<div className="fotogrids-template-preview__controls">
							{device === 'custom' && (
								<FormField
									label={__('Width', 'fotogrids')}
									htmlFor="preview-width-px"
								>
									<NumberField
										id="preview-width-px"
										value={customWidth}
										onChange={setCustomWidth}
										min={280}
										max={3840}
										step={10}
										unit="px"
									/>
								</FormField>
							)}

							{!isIframePreview && (
								<FormField
									label={__('Page Background', 'fotogrids')}
									htmlFor="preview-background"
								>
									<Select
										id="preview-background"
										value={pageBackground}
										onChange={setPageBackground}
										options={[
											{
												value: 'light',
												label: __('Light', 'fotogrids'),
											},
											{
												value: 'dark',
												label: __('Dark', 'fotogrids'),
											},
											{
												value: 'custom',
												label: __(
													'Custom',
													'fotogrids'
												),
											},
										]}
									/>
								</FormField>
							)}

							{!isIframePreview &&
								pageBackground === 'custom' && (
									<FormField
										label={__(
											'Background Color',
											'fotogrids'
										)}
										htmlFor="preview-bg-color"
									>
										{renderBackgroundColorPicker()}
									</FormField>
								)}
						</div>
					</Modal.SubHeader>
				)}

				<Modal.Body padding={false}>
					<Modal.Main>
						<div className="fotogrids-template-preview--container">
							<iframe
								src={getPreviewUrl(template)}
								title={template?.name}
								className="fotogrids-template-preview--iframe"
								style={getIframeStyle()}
								loading="lazy"
							/>
						</div>
					</Modal.Main>
				</Modal.Body>
			</Modal>

			<TemplateOverviewModal
				template={template}
				isPro={isPro}
				isOpen={showOverviewModal}
				onClose={() => setShowOverviewModal(false)}
			/>

			<ApplyTemplateModal
				template={template}
				isOpen={showApplyModal && !onApply}
				onClose={() => setShowApplyModal(false)}
				onSuccess={() => {
					setShowApplyModal(false);
					onClose();
				}}
			/>
		</>
	);
};

export default PreviewTemplateModal;
