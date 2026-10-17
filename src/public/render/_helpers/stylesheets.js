/**
 * FotoGrids - Stylesheet helpers for in-place renders.
 */

/**
 * @param {Element} el
 * @return {boolean} Whether el is a FotoGrids <link> or <style>.
 */
function isFotoGridsStyle(el) {
	const isSheet =
		(el.tagName === 'LINK' && el.rel === 'stylesheet') ||
		el.tagName === 'STYLE';
	return isSheet && el.id.indexOf('fotogrids-') === 0;
}

/**
 * @return {Element|null} End of the first run of FotoGrids styles, or null.
 */
function findAnchor() {
	let anchor = document.querySelector(
		'link[rel="stylesheet"][id^="fotogrids-"]'
	);
	while (
		anchor &&
		anchor.nextElementSibling &&
		isFotoGridsStyle(anchor.nextElementSibling)
	) {
		anchor = anchor.nextElementSibling;
	}
	return anchor;
}

/**
 * Links each stylesheet the page lacks, after the printed FotoGrids styles or
 * ahead of the head's first stylesheet.
 *
 * @param {Record<string, string>} cssUrls Handle → URL map.
 */
export function injectMissingStyles(cssUrls) {
	if (!cssUrls || typeof cssUrls !== 'object') {
		return;
	}
	let anchor = findAnchor();

	Object.keys(cssUrls).forEach(function (handle) {
		const url = cssUrls[handle];
		if (!handle || !url) {
			return;
		}
		const linkId = 'fotogrids-css-' + handle;
		if (
			document.getElementById(linkId) ||
			document.getElementById(handle + '-css')
		) {
			return;
		}
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.id = linkId;
		link.href = url;
		if (anchor) {
			anchor.parentNode.insertBefore(link, anchor.nextSibling);
		} else {
			document.head.insertBefore(
				link,
				document.head.querySelector('link[rel="stylesheet"], style')
			);
		}
		anchor = link;
	});
}
