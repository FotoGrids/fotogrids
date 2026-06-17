window.FotoGridsRenderSettings = window.FotoGridsRenderSettings || {};

const FOTOGRIDS_SYSTEM_FONT_OPTIONS = [
	{
		label: 'Arial',
		value: 'Arial',
		fontFamily: 'Arial, sans-serif',
		source: 'system',
	},
	{
		label: 'Helvetica',
		value: 'Helvetica',
		fontFamily: 'Helvetica, Arial, sans-serif',
		source: 'system',
	},
	{
		label: 'Times New Roman',
		value: 'Times New Roman',
		fontFamily: '"Times New Roman", Times, serif',
		source: 'system',
	},
	{
		label: 'Georgia',
		value: 'Georgia',
		fontFamily: 'Georgia, serif',
		source: 'system',
	},
	{
		label: 'Courier New',
		value: 'Courier New',
		fontFamily: '"Courier New", Courier, monospace',
		source: 'system',
	},
];

const FOTOGRIDS_GOOGLE_FONTS_FALLBACK = [
	'Roboto',
	'Open Sans',
	'Lato',
	'Montserrat',
	'Oswald',
	'Raleway',
	'Nunito',
	'Poppins',
	'Merriweather',
	'Ubuntu',
];

const FOTOGRIDS_GOOGLE_PREVIEW_BATCH_SIZE = 8;
const FOTOGRIDS_GOOGLE_RENDER_BATCH_SIZE = 80;

const getFontFamilyCache = () => {
	if (!window.FotoGridsFontFamilyCache) {
		window.FotoGridsFontFamilyCache = {
			families: null,
			loadPromise: null,
			previewBatches: {},
			preconnected: false,
		};
	}

	return window.FotoGridsFontFamilyCache;
};

const updateFontFamilyDebugState = (patch) => {
	window.FotoGridsFontFamilyDebug = {
		...(window.FotoGridsFontFamilyDebug || {}),
		...patch,
		updatedAt: Date.now(),
	};
};

const buildGoogleFontsEndpoint = () => {
	const restBase =
		window.fotogridsSettings?.restUrl || window.wpApiSettings?.root || '';
	if (!restBase) {
		return '';
	}

	const trimmedRestBase = restBase.replace(/\/$/, '');
	if (trimmedRestBase.includes('/fotogrids/v1')) {
		return `${trimmedRestBase}/admin/google-fonts/families`;
	}

	return `${trimmedRestBase}/fotogrids/v1/admin/google-fonts/families`;
};

const fetchGoogleFontsFamilies = async () => {
	const cache = getFontFamilyCache();

	if (Array.isArray(cache.families) && cache.families.length > 0) {
		return cache.families;
	}

	if (cache.loadPromise) {
		return cache.loadPromise;
	}

	cache.loadPromise = (async () => {
		const controller =
			typeof AbortController === 'function'
				? new AbortController()
				: null;
		const endpoint = buildGoogleFontsEndpoint();
		if (!endpoint) {
			throw new Error('REST base URL unavailable');
		}

		const timeoutId = setTimeout(() => {
			if (controller) {
				controller.abort();
			}
		}, 8000);

		try {
			const response = await fetch(endpoint, {
				method: 'GET',
				signal: controller ? controller.signal : undefined,
				headers: {
					'X-WP-Nonce':
						window.fotogridsSettings?.restNonce ||
						window.wpApiSettings?.nonce ||
						'',
				},
			});

			if (!response.ok) {
				throw new Error('Failed to load Google Fonts metadata');
			}

			const payload = await response.json();
			const families = Array.isArray(payload?.families)
				? payload.families
				: [];

			if (!families.length) {
				throw new Error('Google Fonts metadata was empty');
			}

			cache.families = families;
			return families;
		} finally {
			clearTimeout(timeoutId);
		}
	})();

	try {
		return await cache.loadPromise;
	} catch (error) {
		cache.loadPromise = null;
		throw error;
	}
};

const chunkArray = (items, size) => {
	if (!Array.isArray(items) || size <= 0) {
		return [];
	}

	const chunks = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}

	return chunks;
};

const ensureGoogleFontsPreconnect = () => {
	const cache = getFontFamilyCache();
	if (cache.preconnected) {
		return;
	}

	const head = document.head || document.getElementsByTagName('head')[0];
	if (!head) {
		return;
	}

	const preconnectGoogleApis = document.createElement('link');
	preconnectGoogleApis.rel = 'preconnect';
	preconnectGoogleApis.href = 'https://fonts.googleapis.com';
	head.appendChild(preconnectGoogleApis);

	const preconnectGoogleStatic = document.createElement('link');
	preconnectGoogleStatic.rel = 'preconnect';
	preconnectGoogleStatic.href = 'https://fonts.gstatic.com';
	preconnectGoogleStatic.crossOrigin = 'anonymous';
	head.appendChild(preconnectGoogleStatic);

	cache.preconnected = true;
};

const buildGoogleFontsStylesheetUrl = (fontFamilies) => {
	const params = fontFamilies
		.map((family) => {
			const encodedFamily = encodeURIComponent(family).replace(
				/%20/g,
				'+'
			);
			return `family=${encodedFamily}:wght@400`;
		})
		.join('&');

	return `https://fonts.googleapis.com/css2?${params}&display=swap`;
};

const preloadGoogleFontPreviews = (fontFamilies) => {
	if (!Array.isArray(fontFamilies) || fontFamilies.length === 0) {
		return;
	}

	ensureGoogleFontsPreconnect();
	const cache = getFontFamilyCache();
	const head = document.head || document.getElementsByTagName('head')[0];
	if (!head) {
		return;
	}

	const sanitizedFamilies = fontFamilies.filter(
		(family) => typeof family === 'string' && family.trim() !== ''
	);

	updateFontFamilyDebugState({
		previewRequestedFamilies: sanitizedFamilies.length,
		previewBatchSize: FOTOGRIDS_GOOGLE_PREVIEW_BATCH_SIZE,
		previewCachedBatchCount: Object.keys(cache.previewBatches).length,
	});

	chunkArray(sanitizedFamilies, FOTOGRIDS_GOOGLE_PREVIEW_BATCH_SIZE).forEach(
		(batch) => {
			const batchKey = batch.join('|').toLowerCase();
			if (cache.previewBatches[batchKey]) {
				return;
			}

			cache.previewBatches[batchKey] = true;

			const styleLink = document.createElement('link');
			styleLink.rel = 'stylesheet';
			styleLink.href = buildGoogleFontsStylesheetUrl(batch);
			styleLink.dataset.fotogridsFontPreview = batchKey;
			head.appendChild(styleLink);

			updateFontFamilyDebugState({
				lastPreviewBatchKey: batchKey,
				previewCachedBatchCount: Object.keys(cache.previewBatches)
					.length,
			});
		}
	);
};

const FontFamilyComponent = ({
	setting,
	currentValue,
	isDisabled,
	updateSetting,
	getFieldState,
	renderIcon,
	__,
}) => {
	const { useEffect, useMemo, useState } = wp.element;

	const defaultOptionValue = Object.prototype.hasOwnProperty.call(
		setting || {},
		'default_option_value'
	)
		? setting.default_option_value
		: 'default';
	const resolvedValue =
		currentValue === undefined ||
		currentValue === null ||
		currentValue === ''
			? defaultOptionValue
			: currentValue;

	const [searchTerm, setSearchTerm] = useState('');
	const [googleFonts, setGoogleFonts] = useState([]);
	const [googleFontsStatus, setGoogleFontsStatus] = useState('idle');
	const [googleVisibleCount, setGoogleVisibleCount] = useState(
		FOTOGRIDS_GOOGLE_RENDER_BATCH_SIZE
	);
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	useEffect(() => {
		if (googleFontsStatus !== 'loading') {
			return;
		}

		let isMounted = true;

		fetchGoogleFontsFamilies()
			.then((families) => {
				if (!isMounted) {
					return;
				}

				setGoogleFonts(
					families.map((family) => ({
						label: family,
						value: family,
						fontFamily: `"${family}", sans-serif`,
						source: 'google',
					}))
				);
				setGoogleFontsStatus('ready');
				updateFontFamilyDebugState({
					loadStatus: 'ready',
					totalGoogleFamilies: families.length,
				});
			})
			.catch(() => {
				if (!isMounted) {
					return;
				}

				setGoogleFonts(
					FOTOGRIDS_GOOGLE_FONTS_FALLBACK.map((family) => ({
						label: family,
						value: family,
						fontFamily: `"${family}", sans-serif`,
						source: 'google',
					}))
				);
				setGoogleFontsStatus('fallback');
				updateFontFamilyDebugState({
					loadStatus: 'fallback',
					totalGoogleFamilies: FOTOGRIDS_GOOGLE_FONTS_FALLBACK.length,
				});
			});

		return () => {
			isMounted = false;
		};
	}, [googleFontsStatus]);

	const normalizedSearchTerm = searchTerm.trim().toLowerCase();
	const defaultOption = {
		label: __('Default', 'fotogrids'),
		value: defaultOptionValue,
		fontFamily: '',
		source: 'default',
	};

	const filteredSystemOptions = useMemo(() => {
		if (!normalizedSearchTerm) {
			return FOTOGRIDS_SYSTEM_FONT_OPTIONS;
		}

		return FOTOGRIDS_SYSTEM_FONT_OPTIONS.filter((font) =>
			font.label.toLowerCase().includes(normalizedSearchTerm)
		);
	}, [normalizedSearchTerm]);

	const filteredGoogleOptions = useMemo(() => {
		if (!normalizedSearchTerm) {
			return googleFonts;
		}

		return googleFonts.filter((font) =>
			font.label.toLowerCase().includes(normalizedSearchTerm)
		);
	}, [googleFonts, normalizedSearchTerm]);

	const visibleGoogleOptions = useMemo(
		() => filteredGoogleOptions.slice(0, googleVisibleCount),
		[filteredGoogleOptions, googleVisibleCount]
	);

	const selectedOption = useMemo(() => {
		if (resolvedValue === defaultOption.value) {
			return defaultOption;
		}

		const systemMatch = FOTOGRIDS_SYSTEM_FONT_OPTIONS.find(
			(font) => font.value === resolvedValue
		);
		if (systemMatch) {
			return systemMatch;
		}

		const googleMatch = googleFonts.find(
			(font) => font.value === resolvedValue
		);
		if (googleMatch) {
			return googleMatch;
		}

		return {
			label: String(resolvedValue),
			value: resolvedValue,
			fontFamily: `"${String(resolvedValue)}", sans-serif`,
			source: 'google',
		};
	}, [defaultOption, googleFonts, resolvedValue]);

	useEffect(() => {
		if (!isDropdownOpen || !visibleGoogleOptions.length) {
			return;
		}

		preloadGoogleFontPreviews(
			visibleGoogleOptions.map((font) => font.value)
		);
	}, [isDropdownOpen, visibleGoogleOptions]);

	useEffect(() => {
		if (!selectedOption || selectedOption.source !== 'google') {
			return;
		}

		preloadGoogleFontPreviews([selectedOption.value]);
	}, [selectedOption]);

	const canLoadMoreGoogleFonts =
		visibleGoogleOptions.length < filteredGoogleOptions.length;

	const handleDropdownScroll = (event) => {
		const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
		const distanceToBottom = scrollHeight - (scrollTop + clientHeight);

		updateFontFamilyDebugState({
			scrollTop,
			clientHeight,
			scrollHeight,
			distanceToBottom,
			visibleGoogleCount: visibleGoogleOptions.length,
			totalFilteredGoogleCount: filteredGoogleOptions.length,
			canLoadMoreGoogleFonts,
		});

		if (!canLoadMoreGoogleFonts) {
			return;
		}

		if (distanceToBottom < 40) {
			setGoogleVisibleCount(
				(previousCount) =>
					previousCount + FOTOGRIDS_GOOGLE_RENDER_BATCH_SIZE
			);
		}
	};

	const googleStatus =
		googleFontsStatus === 'loading'
			? __('Loading Google Fonts…', 'fotogrids')
			: googleFontsStatus === 'fallback'
				? __(
						'Showing popular Google Fonts while full list is unavailable.',
						'fotogrids'
					)
				: normalizedSearchTerm &&
					  filteredSystemOptions.length === 0 &&
					  filteredGoogleOptions.length === 0
					? __('No fonts found for this search.', 'fotogrids')
					: '';

	const groups = [
		{
			id: 'system',
			label: __('System', 'fotogrids'),
			options: filteredSystemOptions,
		},
		{
			id: 'google',
			label: __('Google Fonts', 'fotogrids'),
			options: visibleGoogleOptions,
			status: googleStatus,
		},
	];

	return window.FotoGridsRenderSettings.renderSelect({
		setting,
		selectedOption,
		topOptions: [defaultOption],
		groups,
		isDisabled,
		getFieldState,
		renderIcon,
		__,
		searchEnabled: true,
		searchTerm,
		onSearchTermChange: (nextTerm) => setSearchTerm(nextTerm),
		searchPlaceholder: __('Search fonts…', 'fotogrids'),
		onSelect: (nextValue) => updateSetting(setting.key, nextValue),
		onOpen: () => {
			setIsDropdownOpen(true);
			updateFontFamilyDebugState({
				openEventAt: Date.now(),
				visibleGoogleCount: visibleGoogleOptions.length,
				totalFilteredGoogleCount: filteredGoogleOptions.length,
			});
			if (googleFontsStatus === 'idle') {
				setGoogleFontsStatus('loading');
			}
			setGoogleVisibleCount(FOTOGRIDS_GOOGLE_RENDER_BATCH_SIZE);
		},
		onClose: () => {
			setIsDropdownOpen(false);
			setSearchTerm('');
		},
		onDropdownScroll: handleDropdownScroll,
		getOptionStyle: (option) =>
			option?.fontFamily ? { fontFamily: option.fontFamily } : undefined,
		rootClassName: 'fotogrids-font-family',
		maxDropdownHeight: 400,
	});
};

window.FotoGridsRenderSettings.renderFontFamily = (
	setting,
	currentValue,
	isDisabled,
	{ updateSetting, getFieldState, renderIcon, __ }
) => {
	return wp.element.createElement(FontFamilyComponent, {
		setting,
		currentValue,
		isDisabled,
		updateSetting,
		getFieldState,
		renderIcon,
		__,
	});
};
