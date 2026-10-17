/**
 * Tests for public/render/_helpers/stylesheets.js.
 */

import { injectMissingStyles } from '../../../public/render/_helpers/stylesheets.js';

function addLink(id, href) {
	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.id = id;
	link.href = href;
	document.head.appendChild(link);
	return link;
}

function addStyle(id) {
	const style = document.createElement('style');
	style.id = id;
	document.head.appendChild(style);
	return style;
}

function headIds() {
	return Array.from(document.head.children).map((el) => el.id);
}

beforeEach(() => {
	document.head.innerHTML = '';
	document.body.innerHTML = '';
});

describe('injectMissingStyles', () => {
	it('places new stylesheets after the FotoGrids styles printed with the collection, in order', () => {
		addLink('fotogrids-captions-css', 'https://example.com/captions.css');
		addStyle('fotogrids-captions-inline-css');
		addStyle('global-styles-inline-css');
		addLink('fotogrids-errors-css', 'https://example.com/errors.css');
		addStyle('theme-style-inline-css');

		injectMissingStyles({
			'fotogrids-lightbox': 'https://example.com/lightbox.css',
			'fotogrids-sharing': 'https://example.com/sharing.css',
		});

		expect(headIds()).toEqual([
			'fotogrids-captions-css',
			'fotogrids-captions-inline-css',
			'fotogrids-css-fotogrids-lightbox',
			'fotogrids-css-fotogrids-sharing',
			'global-styles-inline-css',
			'fotogrids-errors-css',
			'theme-style-inline-css',
		]);
	});

	it('keeps adding to the same run on a later render', () => {
		addLink('fotogrids-captions-css', 'https://example.com/captions.css');
		addStyle('global-styles-inline-css');

		injectMissingStyles({
			'fotogrids-lightbox': 'https://example.com/lightbox.css',
		});
		injectMissingStyles({
			'fotogrids-sharing': 'https://example.com/sharing.css',
		});

		expect(headIds()).toEqual([
			'fotogrids-captions-css',
			'fotogrids-css-fotogrids-lightbox',
			'fotogrids-css-fotogrids-sharing',
			'global-styles-inline-css',
		]);
	});

	it('follows FotoGrids stylesheets printed in the footer', () => {
		addStyle('wp-custom-css');
		const footerLink = document.createElement('link');
		footerLink.rel = 'stylesheet';
		footerLink.id = 'fotogrids-captions-css';
		footerLink.href = 'https://example.com/captions.css';
		document.body.appendChild(footerLink);

		injectMissingStyles({
			'fotogrids-lightbox': 'https://example.com/lightbox.css',
		});

		expect(footerLink.nextElementSibling.id).toBe(
			'fotogrids-css-fotogrids-lightbox'
		);
	});

	it('appends to <head> when the page has no FotoGrids stylesheet', () => {
		addLink('theme-style-css', 'https://example.com/theme.css');

		injectMissingStyles({
			'fotogrids-lightbox': 'https://example.com/lightbox.css',
		});

		expect(headIds()).toEqual([
			'theme-style-css',
			'fotogrids-css-fotogrids-lightbox',
		]);
	});

	it('skips handles already linked under either id', () => {
		addLink('fotogrids-captions-css', 'https://example.com/captions.css');
		addLink(
			'fotogrids-css-fotogrids-lightbox',
			'https://example.com/lightbox.css'
		);

		injectMissingStyles({
			'fotogrids-captions': 'https://example.com/captions.css',
			'fotogrids-lightbox': 'https://example.com/lightbox.css',
		});

		expect(document.querySelectorAll('link')).toHaveLength(2);
	});

	it('ignores empty handles, empty URLs and a missing map', () => {
		injectMissingStyles({ '': 'https://example.com/a.css', b: '' });
		injectMissingStyles(null);

		expect(document.querySelectorAll('link')).toHaveLength(0);
	});
});
