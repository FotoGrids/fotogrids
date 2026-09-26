/**
 * Builds an absolute URL for a WordPress REST route.
 *
 * Query parameters are appended through URLSearchParams, so the separator is
 * correct for both the pretty base (/wp-json/) and the plain-permalink base
 * (/index.php?rest_route=/).
 *
 * @param {string} route  Route below the REST root, e.g. 'fotogrids/v1/metadata/tags'.
 * @param {Object} params Query parameters. Undefined, null and empty values are skipped.
 * @return {string} Absolute request URL.
 */
export const buildRestUrl = (route, params = {}) => {
	const root =
		window.fotogridsAdmin?.apiUrl || window.wpApiSettings?.root || '';
	const url = new URL(
		`${root}${route.replace(/^\//, '')}`,
		window.location.href
	);

	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== '') {
			url.searchParams.set(key, String(value));
		}
	});

	return url.toString();
};
