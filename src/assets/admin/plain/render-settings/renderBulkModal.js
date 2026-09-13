window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderBulkModal = ({
	showBulkModal,
	bulkAction,
	bulkUrl,
	setBulkUrl,
	bulkTarget,
	setBulkTarget,
	validateUrl,
	closeBulkModal,
	executeBulkAction,
	__,
}) => {
	if (!showBulkModal) return null;

	const { createElement: h } = wp.element;

	const validation = validateUrl(bulkUrl);
	const canExecute =
		bulkAction === 'clear_all' ||
		(bulkAction === 'apply_to_all' && validation.valid && bulkUrl.trim());

	return h(
		'div',
		{
			key: 'bulk-modal',
			className: 'fotogrids-modal',
			id: 'fotogrids-modal__bulk-external-url',
		},
		[
			h('div', {
				key: 'overlay',
				className: 'fotogrids-modal__overlay',
				onClick: (e) => {
					if (e.target === e.currentTarget) {
						closeBulkModal();
					}
				},
			}),

			h(
				'div',
				{ key: 'content', className: 'fotogrids-modal__content' },
				[
					h(
						'div',
						{ key: 'header', className: 'fotogrids-modal__header' },
						[
							h(
								'h3',
								{ key: 'h3' },
								bulkAction === 'apply_to_all'
									? __('Apply URL to All Items', 'fotogrids')
									: __('Clear All URLs', 'fotogrids')
							),
							h(
								'button',
								{
									key: 'close',
									type: 'button',
									className: 'fotogrids-modal__close',
									onClick: closeBulkModal,
								},
								'×'
							),
						]
					),

					h(
						'div',
						{ key: 'body', className: 'fotogrids-modal__body' },
						[
							h(
								'div',
								{
									key: 'layout',
									className:
										'fotogrids-modal__layout fotogrids-modal__layout-single',
								},
								[
									bulkAction === 'apply_to_all'
										? [
												h(
													'div',
													{
														key: 'field',
														className:
															'fotogrids-modal__field',
													},
													[
														h(
															'label',
															{
																key: 'label',
																className:
																	'fotogrids-setting__label',
															},
															__(
																'URL to apply to all items',
																'fotogrids'
															)
														),
														h('input', {
															key: 'input',
															type: 'url',
															value: bulkUrl,
															placeholder: __(
																'Enter URL (e.g., https://example.com)',
																'fotogrids'
															),
															className: `fotogrids-modal__input ${!validation.valid ? 'fotogrids-modal__input--invalid' : validation.valid && bulkUrl ? 'fotogrids-modal__input--valid' : ''}`,
															onChange: (e) =>
																setBulkUrl(
																	e.target
																		.value
																),
															onKeyDown: (e) => {
																if (
																	e.key ===
																		'Enter' &&
																	canExecute
																) {
																	executeBulkAction();
																}
															},
														}),
														validation.message &&
															h(
																'div',
																{
																	key: 'validation',
																	className: `fotogrids-modal__validation ${validation.valid ? 'fotogrids-modal__validation--valid' : 'fotogrids-modal__validation--invalid'}`,
																},
																validation.message
															),
													]
												),

												h(
													'div',
													{
														key: 'field-2',
														className:
															'fotogrids-modal__field',
													},
													[
														h(
															'label',
															{
																key: 'label',
																className:
																	'fotogrids-setting__label',
															},
															__(
																'Link Target',
																'fotogrids'
															)
														),
														h(
															'select',
															{
																key: 'select',
																value: bulkTarget,
																onChange: (e) =>
																	setBulkTarget(
																		e.target
																			.value
																	),
																className:
																	'fotogrids-modal__select',
															},
															[
																h(
																	'option',
																	{
																		key: 'option',
																		value: 'global',
																	},
																	__(
																		'Global Default',
																		'fotogrids'
																	)
																),
																h(
																	'option',
																	{
																		key: 'option-2',
																		value: '_self',
																	},
																	__(
																		'Same Tab',
																		'fotogrids'
																	)
																),
																h(
																	'option',
																	{
																		key: 'option-3',
																		value: '_blank',
																	},
																	__(
																		'New Tab',
																		'fotogrids'
																	)
																),
															]
														),
													]
												),
											]
										: [
												h(
													'p',
													{ key: 'p' },
													__(
														'Are you sure you want to clear all URLs? This action cannot be undone.',
														'fotogrids'
													)
												),
											],
								]
							),
						]
					),

					h(
						'div',
						{ key: 'footer', className: 'fotogrids-modal__footer' },
						[
							h(
								'button',
								{
									key: 'fg-button',
									type: 'button',
									className:
										'fg-button fg-button--variant-secondary',
									onClick: closeBulkModal,
								},
								__('Cancel', 'fotogrids')
							),
							h(
								'button',
								{
									key: 'fg-button-2',
									type: 'button',
									className: `fg-button fg-button--variant-primary`,
									onClick: executeBulkAction,
									disabled: !canExecute,
								},
								bulkAction === 'apply_to_all'
									? __('Apply to All', 'fotogrids')
									: __('Clear All', 'fotogrids')
							),
						]
					),
				]
			),
		]
	);
};
