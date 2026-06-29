/**
 * Tests for admin/src/featured-image-picker.js
 *
 * The module is an IIFE that boots on load: it finds every
 * [data-fg-featured-image] root and wires the wp.media picker to a hidden
 * input. wp.media is mocked so no real media frame is constructed.
 */

const MARKUP = `
	<div class="fotogrids-featured-image" data-fg-featured-image>
		<div class="fotogrids-featured-image__preview" hidden data-fg-featured-image-preview></div>
		<input type="hidden" name="fotogrids_featured_image_id" value="" data-fg-featured-image-input />
		<p>
			<button type="button" data-fg-featured-image-set>Set featured image</button>
			<button type="button" hidden data-fg-featured-image-remove>Remove</button>
		</p>
	</div>
`;

const loadModule = () => {
	jest.isolateModules(() => require('@/admin/src/featured-image-picker'));
};

/**
 * Build a wp.media mock whose frame.on('select') handler can be triggered on
 * demand with a chosen attachment payload.
 */
const mockWpMedia = (attachment) => {
	let selectHandler = null;
	const frame = {
		on: (event, handler) => {
			if (event === 'select') {
				selectHandler = handler;
			}
		},
		open: jest.fn(),
		state: () => ({
			get: () => ({
				first: () => ({ toJSON: () => attachment }),
			}),
		}),
	};
	const media = jest.fn(() => frame);
	media.triggerSelect = () => selectHandler && selectHandler();
	media.frame = frame;
	window.wp = { media };
	return media;
};

describe('featured-image-picker', () => {
	afterEach(() => {
		document.body.innerHTML = '';
		delete window.wp;
		delete window.fotogridsFeaturedImage;
	});

	it('opens the media frame and stores the selected attachment id', () => {
		document.body.innerHTML = MARKUP;
		const media = mockWpMedia({ id: 42, url: 'https://example.com/a.jpg' });

		loadModule();

		const setButton = document.querySelector(
			'[data-fg-featured-image-set]'
		);
		setButton.click();
		expect(media).toHaveBeenCalledTimes(1);
		expect(media.frame.open).toHaveBeenCalled();

		media.triggerSelect();

		const input = document.querySelector('[data-fg-featured-image-input]');
		expect(input.value).toBe('42');

		const preview = document.querySelector(
			'[data-fg-featured-image-preview]'
		);
		expect(preview.hidden).toBe(false);
		expect(preview.querySelector('img').src).toContain(
			'https://example.com/a.jpg'
		);

		const remove = document.querySelector(
			'[data-fg-featured-image-remove]'
		);
		expect(remove.hidden).toBe(false);
	});

	it('prefers the medium size url for the preview when present', () => {
		document.body.innerHTML = MARKUP;
		mockWpMedia({
			id: 7,
			url: 'https://example.com/full.jpg',
			sizes: { medium: { url: 'https://example.com/medium.jpg' } },
		}).frame;

		loadModule();

		document.querySelector('[data-fg-featured-image-set]').click();
		window.wp.media.triggerSelect();

		const preview = document.querySelector(
			'[data-fg-featured-image-preview]'
		);
		expect(preview.querySelector('img').src).toContain(
			'https://example.com/medium.jpg'
		);
	});

	it('clears the input and hides the preview on remove', () => {
		document.body.innerHTML = MARKUP;
		mockWpMedia({ id: 9, url: 'https://example.com/x.jpg' });

		loadModule();

		document.querySelector('[data-fg-featured-image-set]').click();
		window.wp.media.triggerSelect();

		const input = document.querySelector('[data-fg-featured-image-input]');
		expect(input.value).toBe('9');

		document.querySelector('[data-fg-featured-image-remove]').click();
		expect(input.value).toBe('');

		const preview = document.querySelector(
			'[data-fg-featured-image-preview]'
		);
		expect(preview.hidden).toBe(true);
		expect(
			document.querySelector('[data-fg-featured-image-remove]').hidden
		).toBe(true);
	});

	it('reuses a single media frame across clicks', () => {
		document.body.innerHTML = MARKUP;
		const media = mockWpMedia({ id: 1, url: 'https://example.com/y.jpg' });

		loadModule();

		const setButton = document.querySelector(
			'[data-fg-featured-image-set]'
		);
		setButton.click();
		setButton.click();

		expect(media).toHaveBeenCalledTimes(1);
		expect(media.frame.open).toHaveBeenCalledTimes(2);
	});
});
