/**
 * Touch reveal for captions that are shown only on hover.
 *
 * On a touch tap, an item whose caption is hidden reveals it and swallows the
 * tap; a second tap on the same item goes through to its link or lightbox.
 * The reveal is recorded on pointerdown because some browsers drop the click
 * of the first tap on an element that changes on hover.
 */
(function () {
	'use strict';

	const REVEALED = 'fg-caption-revealed';
	const bound = new WeakSet();

	function attach(collection) {
		if (
			bound.has(collection) ||
			collection.getAttribute('data-fg-caption-reveal') !== 'hover'
		) {
			return;
		}
		bound.add(collection);

		let pending = null;

		collection.addEventListener(
			'pointerdown',
			(event) => {
				if (event.pointerType !== 'touch') {
					pending = null;
					return;
				}
				const item = event.target.closest('.fg-item');
				if (
					!item ||
					!collection.contains(item) ||
					!item.querySelector('.fg-caption')
				) {
					pending = null;
					return;
				}
				pending = item.classList.contains(REVEALED) ? null : item;
				collection
					.querySelectorAll('.fg-item.' + REVEALED)
					.forEach((other) => {
						if (other !== item) {
							other.classList.remove(REVEALED);
						}
					});
				item.classList.add(REVEALED);
			},
			true
		);

		collection.addEventListener(
			'click',
			(event) => {
				if (!pending) {
					return;
				}
				const item = event.target.closest('.fg-item');
				const first = item === pending;
				pending = null;
				if (first) {
					event.preventDefault();
					event.stopPropagation();
				}
			},
			true
		);

		document.addEventListener('pointerdown', (event) => {
			if (!collection.contains(event.target)) {
				collection
					.querySelectorAll('.fg-item.' + REVEALED)
					.forEach((item) => item.classList.remove(REVEALED));
			}
		});
	}

	function init() {
		if (
			!window.FotoGrids ||
			typeof window.FotoGrids.onCollection !== 'function'
		) {
			return;
		}
		window.FotoGrids.onCollection(attach, 10);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
