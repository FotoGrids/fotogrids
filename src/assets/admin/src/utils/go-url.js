const BASE_URL = 'https://go.fotogrids.com/';

/**
 * Build a go.fotogrids.com URL with the standard UTM parameters.
 *
 * utm_source is always "plugin"; utm_medium identifies the surface the link
 * lives on; utm_campaign identifies the destination intent; utm_content is an
 * optional nuance used to disambiguate two links on the same surface.
 *
 * @param {string} path     Path on the redirect host, without a leading slash.
 * @param {string} medium   Surface the link lives on (utm_medium).
 * @param {string} campaign Destination intent (utm_campaign).
 * @param {string} [content] Optional nuance (utm_content).
 * @return {string} Fully-formed URL.
 */
export const fgGoUrl = (path, medium, campaign, content = '') => {
	const params = new URLSearchParams({
		utm_source: 'plugin',
		utm_medium: medium,
		utm_campaign: campaign,
	});

	if (content) {
		params.set('utm_content', content);
	}

	return `${BASE_URL}${path.replace(/^\/+/, '')}?${params.toString()}`;
};
