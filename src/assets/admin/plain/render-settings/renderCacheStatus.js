/**
 * Cache Status Component
 *
 * Renders a read-only cache status panel inside the collection settings
 * caching group. Shows when the gallery was last cached and when the
 * cache expires, with a Clear Cache button.
 *
 * On mount the component calls GET /fotogrids/v1/gallery/{id}/cache-status.
 * The Clear Cache button calls DELETE /fotogrids/v1/gallery/{id}/cache and
 * refreshes the status afterward.
 *
 * Props received via the render-settings framework
 * ------------------------------------------------
 * setting   - the JSON setting definition (key, label, …)
 * isDisabled - whether the field is locked/grayed out
 * __        - i18n function
 * postId    - gallery post ID
 * restUrl   - base REST URL, e.g. https://example.com/wp-json/fotogrids/v1/
 * restNonce - wp_rest nonce for authenticating REST requests
 */
const CacheStatusComponent = ({
	setting,
	isDisabled,
	__,
	postId,
	restUrl,
	restNonce,
}) => {
	const [status, setStatus] = React.useState(null);
	const [loadState, setLoadState] = React.useState('loading');
	const [flushState, setFlushState] = React.useState('idle');

	const baseClass = 'fotogrids-settings_cache-status';

	const fetchStatus = async () => {
		setLoadState('loading');
		try {
			const url = `${restUrl}gallery/${postId}/cache-status`;
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					'X-WP-Nonce': restNonce,
					'Content-Type': 'application/json',
				},
				credentials: 'same-origin',
			});

			if (!response.ok) {
				setLoadState('error');
				return;
			}

			const data = await response.json();
			setStatus(data);
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

	const handleFlush = async () => {
		if (isDisabled || flushState === 'loading') return;

		setFlushState('loading');
		try {
			const url = `${restUrl}gallery/${postId}/cache`;
			const response = await fetch(url, {
				method: 'DELETE',
				headers: {
					'X-WP-Nonce': restNonce,
					'Content-Type': 'application/json',
				},
				credentials: 'same-origin',
			});

			if (!response.ok) {
				setFlushState('error');
				if (window.fotogridsToast) {
					window.fotogridsToast.error(
						__(
							'Could not clear the cache. Please try again.',
							'fotogrids'
						)
					);
				}
				return;
			}

			setFlushState('done');
			if (window.fotogridsToast) {
				window.fotogridsToast.success(
					__('Cache cleared.', 'fotogrids')
				);
			}
			await fetchStatus();
		} catch (_err) {
			setFlushState('error');
			if (window.fotogridsToast) {
				window.fotogridsToast.error(
					__(
						'Could not clear the cache. Please try again.',
						'fotogrids'
					)
				);
			}
		}
	};

	const formatDate = (isoString) => {
		if (!isoString) return __('-', 'fotogrids');
		try {
			return new Date(isoString).toLocaleString();
		} catch (_err) {
			return isoString;
		}
	};

	const isCached = status?.cached === true;

	let body;

	if (loadState === 'loading') {
		body = React.createElement(
			'div',
			{
				className: `${baseClass}__loading`,
			},
			__('Loading cache status…', 'fotogrids')
		);
	} else if (loadState === 'error') {
		body = React.createElement(
			'div',
			{
				className: `${baseClass}__error`,
			},
			__('Could not load cache status.', 'fotogrids')
		);
	} else if (!isCached) {
		body = React.createElement(
			'div',
			{
				className: `${baseClass}__empty`,
			},
			__('No cache exists for this gallery yet.', 'fotogrids')
		);
	} else {
		const meta = status.meta || {};

		body = React.createElement(
			'div',
			{
				className: `${baseClass}__meta`,
			},
			[
				React.createElement(
					'span',
					{
						key: 'cached-label',
						className: `${baseClass}__meta__label`,
					},
					__('Cached at', 'fotogrids')
				),
				React.createElement(
					'span',
					{
						key: 'cached-value',
						className: `${baseClass}__meta__value`,
					},
					formatDate(meta.cached_at)
				),
				React.createElement(
					'span',
					{
						key: 'expires-label',
						className: `${baseClass}__meta__label`,
					},
					__('Expires at', 'fotogrids')
				),
				React.createElement(
					'span',
					{
						key: 'expires-value',
						className: `${baseClass}__meta__value`,
					},
					formatDate(meta.expires_at)
				),
			]
		);
	}

	return React.createElement(
		'div',
		{
			className: `${baseClass}`,
		},
		[
			React.createElement(
				'div',
				{
					key: 'content',
					className: `${baseClass}__content`,
				},
				[
					setting.label &&
						React.createElement(
							'div',
							{
								key: 'label',
								className: 'fotogrids-setting__label',
							},
							setting.label
						),
					React.createElement(
						'div',
						{
							key: 'body',
							className: `${baseClass}__body`,
						},
						body
					),
				].filter(Boolean)
			),

			React.createElement(
				'div',
				{
					key: 'actions',
					className: `${baseClass}__actions`,
				},
				[
					isCached &&
						React.createElement(
							'button',
							{
								key: 'flush',
								type: 'button',
								className:
									'fg-button fg-button--variant-primary',
								onClick: handleFlush,
								disabled:
									isDisabled || flushState === 'loading',
							},
							flushState === 'loading'
								? __('Clearing…', 'fotogrids')
								: __('Clear Cache', 'fotogrids')
						),
				].filter(Boolean)
			),
		].filter(Boolean)
	);
};

window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

window.FotoGridsRenderSettings.renderCacheStatus = (
	setting,
	currentValue,
	isDisabled,
	{ __, postId, restUrl, restNonce }
) => {
	return React.createElement(CacheStatusComponent, {
		setting,
		isDisabled,
		__,
		postId,
		restUrl,
		restNonce,
	});
};
