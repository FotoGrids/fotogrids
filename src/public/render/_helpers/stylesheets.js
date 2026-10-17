/**
 * FotoGrids - Stylesheet helpers for in-place renders.
 */

/**
 * @param {Element} el
 * @return {boolean} Whether the element is a FotoGrids stylesheet or inline style.
 */
function isFotoGridsStyle(el) {
	const isSheet =
		(el.tagName === 'LINK' && el.rel === 'stylesheet') ||
		el.tagName === 'STYLE';
	return isSheet && el.id.indexOf('fotogrids-') === 0;
}

/**
 * Returns the last element of the run of FotoGrids styles that starts at the
 * first FotoGrids stylesheet in the document, or null when there is none.
 *
 * @return {Element|null} Element new stylesheets are placed after.
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
 * Links each stylesheet in the map that the document does not already carry,
 * placed with the FotoGrids stylesheets WordPress printed so it keeps the
 * cascade position a page load would give it.
 *
 * @param {Record<string, string>} cssUrls Handle → absolute URL map.
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
			document.head.appendChild(link);
		}
		anchor = link;
	});
}
