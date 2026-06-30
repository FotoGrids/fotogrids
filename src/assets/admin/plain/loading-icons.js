/**
 * Loading Icons Library
 * Icons are loaded from config/loading-icons-smil.json (built from loading-icons.yaml).
 * SVG templates contain __FG_ID__; use getLoadingIconSvg(key, instanceId) to avoid
 * duplicate IDs when multiple loaders are on the page (e.g. React: useId(), vanilla: randomId()).
 */

const FotoGridsLoadingIcons = {};

/**
 * Returns SVG markup for a loading icon with optional unique instance id.
 * Replace __FG_ID__ so multiple loaders on the page don't collide (SMIL/url(#id)).
 * @param {string} key - Icon key (e.g. 'spinner', '12-dots').
 * @param {string} [instanceId] - Unique id for this instance (e.g. React useId(), or randomId() below). Omit for single loader.
 * @returns {string} SVG string.
 */
function getLoadingIconSvg(key, instanceId) {
	let svg = FotoGridsLoadingIcons[key] || FotoGridsLoadingIcons.spinner || '';
	if (instanceId && svg) {
		svg = svg.replace(/__FG_ID__/g, instanceId);
	}
	return svg;
}

/** Generates a short unique id for vanilla JS (no React useId). */
function randomId() {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID().slice(0, 8);
	}
	return 'fg-' + Math.random().toString(36).slice(2, 10);
}

function mergeLoadingIcons() {
	if (
		typeof window.FotoGridsIcons !== 'undefined' &&
		Object.keys(FotoGridsLoadingIcons).length > 0
	) {
		Object.keys(FotoGridsLoadingIcons).forEach(function (k) {
			window.FotoGridsIcons['loading_icon_' + k] =
				FotoGridsLoadingIcons[k];
		});
	}
}

(async function () {
	let baseUrl = window.fotogridsAdmin?.pluginUrl || '';

	if (!baseUrl) {
		let attempts = 0;
		const maxAttempts = 50;

		while (!baseUrl && attempts < maxAttempts) {
			await new Promise((resolve) => setTimeout(resolve, 100));
			baseUrl = window.fotogridsAdmin?.pluginUrl || '';
			attempts++;
		}
	}

	if (!baseUrl) {
		console.warn(
			'FotoGrids: Plugin URL not available, cannot load config/loading-icons-smil.json'
		);
		return;
	}

	try {
		const response = await fetch(
			`${baseUrl}config/loading-icons-smil.json`
		);
		if (response.ok) {
			const data = await response.json();

			// Merge icon data into the existing object so that getLoadingIconSvg /
			// randomId - already attached to it synchronously below - are preserved.
			Object.assign(FotoGridsLoadingIcons, data);

			if (typeof window !== 'undefined') {
				window.FotoGridsLoadingIcons = FotoGridsLoadingIcons;
			}

			mergeLoadingIcons();
		} else {
			console.warn(
				'FotoGrids: Could not load config/loading-icons-smil.json, using empty object'
			);
		}
	} catch (error) {
		console.warn(
			'FotoGrids: Error loading config/loading-icons-smil.json:',
			error
		);
	}
})();

if (typeof window !== 'undefined') {
	if (typeof window.FotoGridsIcons !== 'undefined') {
		setTimeout(mergeLoadingIcons, 200);
	} else {
		const checkInterval = setInterval(function () {
			if (
				typeof window.FotoGridsIcons !== 'undefined' &&
				Object.keys(FotoGridsLoadingIcons).length > 0
			) {
				mergeLoadingIcons();
				clearInterval(checkInterval);
			}
		}, 50);

		setTimeout(function () {
			clearInterval(checkInterval);
		}, 5000);
	}
}

if (typeof module !== 'undefined' && module.exports) {
	module.exports = FotoGridsLoadingIcons;
	module.exports.getLoadingIconSvg = getLoadingIconSvg;
	module.exports.randomId = randomId;
}
if (typeof window !== 'undefined') {
	window.FotoGridsLoadingIcons = FotoGridsLoadingIcons;
	window.FotoGridsLoadingIcons.getLoadingIconSvg = getLoadingIconSvg;
	window.FotoGridsLoadingIcons.randomId = randomId;
}
