/**
 * Watermark Status Component
 *
 * Renders a per-gallery watermark status notice inside the collection settings
 * Security panel. Shows how many of the gallery's images still need a
 * watermark, with a button to regenerate just this gallery and an expandable
 * list of the missing/stale items.
 *
 * On mount it calls GET /fotogrids/v1/admin/watermark/status?gallery_id={id}.
 * The Regenerate button loops POST /fotogrids/v1/admin/watermark/regenerate
 * over the pending attachment IDs, then refreshes.
 *
 * Props received via the render-settings framework
 * ------------------------------------------------
 * setting    - the JSON setting definition
 * isDisabled - whether the field is locked
 * __         - i18n function
 * postId     - gallery post ID
 * restUrl    - base REST URL, e.g. https://example.com/wp-json/fotogrids/v1/
 * restNonce  - wp_rest nonce
 */
const WatermarkStatusComponent = ({
	isDisabled,
	__,
	postId,
	restUrl,
	restNonce,
}) => {
	const h = React.createElement;
	const baseClass = 'fotogrids-settings_watermark-status';

	const [status, setStatus] = React.useState(null);
	const [loadState, setLoadState] = React.useState('loading');
	const [running, setRunning] = React.useState(false);
	const [progress, setProgress] = React.useState({ done: 0, total: 0 });
	const [showList, setShowList] = React.useState(false);

	const request = (path, method) =>
		fetch(`${restUrl}${path}`, {
			method,
			headers: {
				'X-WP-Nonce': restNonce,
				'Content-Type': 'application/json',
			},
			credentials: 'same-origin',
		});

	const fetchStatus = async () => {
		try {
			const response = await request(
				`admin/watermark/status?gallery_id=${postId}`,
				'GET'
			);
			if (!response.ok) {
				setLoadState('error');
				return;
			}
			setStatus(await response.json());
			setLoadState('done');
		} catch (_err) {
			setLoadState('error');
		}
	};

	React.useEffect(() => {
		if (postId) {
			fetchStatus();
		}
	}, [postId]);

	const regenerate = async (ids) => {
		if (isDisabled || running || !Array.isArray(ids) || ids.length === 0)
			return;

		setRunning(true);
		setProgress({ done: 0, total: ids.length });

		for (let i = 0; i < ids.length; i++) {
			try {
				await fetch(`${restUrl}admin/watermark/regenerate`, {
					method: 'POST',
					headers: {
						'X-WP-Nonce': restNonce,
						'Content-Type': 'application/json',
					},
					credentials: 'same-origin',
					body: JSON.stringify({ attachment_id: ids[i] }),
				});
			} catch (_err) {
				// Continue; a failed image stays pending and shows next refresh.
			}
			setProgress({ done: i + 1, total: ids.length });
		}

		await fetchStatus();
		setRunning(false);
		if (window.fotogridsToast) {
			window.fotogridsToast.success(
				__('Watermarks updated for this gallery.', 'fotogrids')
			);
		}
	};

	const handleRegenerate = () => regenerate(status?.pending_ids);

	if (loadState === 'loading' || loadState === 'error') {
		return null;
	}

	const counts = status?.counts || {};
	const total = counts.total || 0;
	const pending = status?.pending || 0;

	// Nothing to surface: watermark off site-wide, or every image is current.
	if (!status?.enabled || pending === 0) {
		return null;
	}

	const items = Array.isArray(status?.items) ? status.items : [];
	const missingItems = items.filter((it) => it.state !== 'current');

	const title = wp.i18n.sprintf(
		/* translators: 1: pending count, 2: total count. */
		__(
			'%1$d of %2$d items in this gallery aren’t watermarked',
			'fotogrids'
		),
		pending,
		total
	);

	const stateLabel = (state) =>
		state === 'stale'
			? __('out of date', 'fotogrids')
			: __('missing', 'fotogrids');

	const listToggle = h(
		'button',
		{
			key: 'toggle',
			type: 'button',
			className: `fg-button fg-button--variant-secondary fg-button--size-sm ${baseClass}__list-toggle`,
			onClick: () => setShowList((v) => !v),
		},
		showList
			? __('Hide items', 'fotogrids')
			: __('Show missing items', 'fotogrids')
	);

	const list =
		showList &&
		h(
			'ul',
			{
				key: 'list',
				className: `${baseClass}__list`,
			},
			missingItems.map((it) =>
				h(
					'li',
					{
						key: it.attachment_id,
						className: `${baseClass}__item`,
					},
					[
						h(
							'span',
							{
								key: 'name',
								className: `${baseClass}__item-name`,
							},
							it.filename || `#${it.attachment_id}`
						),
						h(
							'span',
							{
								key: 'state',
								className: `${baseClass}__item-state ${baseClass}__item-state--${it.state}`,
							},
							stateLabel(it.state)
						),
					]
				)
			)
		);

	return h(
		'div',
		{ className: baseClass },
		[
			h('div', { key: 'notice', className: `${baseClass}__notice` }, [
				h('div', { key: 'text', className: `${baseClass}__text` }, [
					h(
						'div',
						{ key: 'title', className: `${baseClass}__title` },
						title
					),
					h(
						'div',
						{ key: 'desc', className: `${baseClass}__desc` },
						running
							? wp.i18n.sprintf(
									// translators: %1$d: number of items processed; %2$d: total number of items.
									__(
										'Regenerating… %1$d of %2$d',
										'fotogrids'
									),
									progress.done,
									progress.total
								)
							: __(
									'The site watermark is on for this gallery, but these images still serve clean copies.',
									'fotogrids'
								)
					),
				]),
				h(
					'div',
					{ key: 'buttons', className: `${baseClass}__buttons` },
					[
						h(
							'button',
							{
								key: 'btn',
								type: 'button',
								className:
									'fg-button fg-button--variant-primary fg-button--size-sm',
								onClick: handleRegenerate,
								disabled: isDisabled || running,
							},
							running
								? __('Regenerating…', 'fotogrids')
								: __('Regenerate this gallery', 'fotogrids')
						),
						missingItems.length > 0 && listToggle,
					]
				),
			]),
			list,
		].filter(Boolean)
	);
};

window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderWatermarkStatus = (
	setting,
	currentValue,
	isDisabled,
	{ __, postId, restUrl, restNonce }
) => {
	return React.createElement(WatermarkStatusComponent, {
		setting,
		isDisabled,
		__,
		postId,
		restUrl,
		restNonce,
	});
};
