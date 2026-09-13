/**
 * Tests for public/render/video/video-inline.js (IIFE; runs init() on import).
 *
 * The module publishes prepare() and play() on window.FotoGrids.modules
 * .videoInline. prepare() is what onGallery runs over each tile; play() is the
 * click path. The click wiring itself belongs to onGallery.
 */

function loadModule() {
	jest.isolateModules(() => {
		require('../../../public/render/video/video-inline.js');
	});
	return window.FotoGrids.modules.videoInline;
}

function makeTile(attrs, { poster = '' } = {}) {
	const tile = document.createElement('span');
	tile.className = 'fg-video';
	tile.setAttribute('data-fg-playback-mode', 'inline');
	Object.entries(attrs).forEach(([name, value]) => {
		tile.setAttribute(name, value);
	});
	if (poster) {
		const img = document.createElement('img');
		img.className = 'fg-video-poster';
		img.src = poster;
		tile.appendChild(img);
	}
	document.body.appendChild(tile);
	return tile;
}

function fileTile(settings, opts) {
	const attrs = {
		'data-fg-item-type': 'video_file',
		'data-fg-video-src': 'https://example.com/clip.mp4',
	};
	if (settings !== undefined) {
		attrs['data-fg-embed-settings'] = JSON.stringify(settings);
	}
	return makeTile(attrs, opts);
}

function embedTile(settings) {
	return makeTile({
		'data-fg-item-type': 'video_youtube',
		'data-fg-embed-id': 'abc123',
		'data-fg-embed-settings': JSON.stringify(settings),
	});
}

function playerParams(tile) {
	return new URL(tile.querySelector('iframe').src).searchParams;
}

describe('video-inline', () => {
	let playMock;

	beforeEach(() => {
		document.body.innerHTML = '';
		window.FotoGrids = { onGallery: jest.fn() };
		delete window.IntersectionObserver;
		playMock = jest.fn(() => Promise.resolve());
		window.HTMLMediaElement.prototype.play = playMock;
	});

	describe('resting state', () => {
		it('mounts a paused native player when controls are on', () => {
			const { prepare } = loadModule();
			const tile = fileTile(
				{ autoplay: false, controls: true, mute: true, loop: true },
				{ poster: 'https://example.com/poster.jpg' }
			);

			prepare(tile);

			const video = tile.querySelector('video');
			expect(video).not.toBeNull();
			expect(video.controls).toBe(true);
			expect(video.autoplay).toBe(false);
			expect(video.muted).toBe(true);
			expect(video.loop).toBe(true);
			expect(video.poster).toBe('https://example.com/poster.jpg');
			expect(video.preload).toBe('metadata');
			expect(playMock).not.toHaveBeenCalled();
		});

		it('leaves the poster and badge alone when controls are off', () => {
			const { prepare } = loadModule();
			const tile = fileTile({ autoplay: false, controls: false });

			prepare(tile);

			expect(tile.querySelector('video')).toBeNull();
			expect(tile.getAttribute('data-fg-playing')).toBeNull();
		});

		it('does not load an embed iframe until it is clicked', () => {
			const { prepare } = loadModule();
			const tile = embedTile({ autoplay: false, controls: true });

			prepare(tile);

			expect(tile.querySelector('iframe')).toBeNull();
		});
	});

	describe('autoplay', () => {
		it('mounts and plays immediately when there is no IntersectionObserver', () => {
			const { prepare } = loadModule();
			const tile = fileTile({ autoplay: true, mute: true });

			prepare(tile);

			const video = tile.querySelector('video');
			expect(video.autoplay).toBe(true);
			expect(video.preload).toBe('auto');
			expect(playMock).toHaveBeenCalled();
		});

		it('waits for the tile to reach the viewport when one exists', () => {
			const observed = [];
			let fire;
			window.IntersectionObserver = function (cb) {
				fire = cb;
				this.observe = (el) => observed.push(el);
				this.disconnect = jest.fn();
			};

			const { prepare } = loadModule();
			const tile = fileTile({ autoplay: true, mute: true });

			prepare(tile);
			expect(observed).toEqual([tile]);
			expect(tile.querySelector('video')).toBeNull();

			fire([{ isIntersecting: true, target: tile }]);
			expect(tile.querySelector('video')).not.toBeNull();
			expect(playMock).toHaveBeenCalled();
		});

		it('restores a play badge when the browser refuses a controls-off autoplay', async () => {
			playMock.mockReturnValue(Promise.reject(new Error('blocked')));
			const { prepare } = loadModule();
			const tile = fileTile({ autoplay: true, controls: false });

			prepare(tile);
			await Promise.resolve();
			await Promise.resolve();

			expect(tile.querySelector('.fg-video-badge')).not.toBeNull();
		});

		it('leaves a refused autoplay alone when the native controls are showing', async () => {
			playMock.mockReturnValue(Promise.reject(new Error('blocked')));
			const { prepare } = loadModule();
			const tile = fileTile({ autoplay: true, controls: true });

			prepare(tile);
			await Promise.resolve();
			await Promise.resolve();

			expect(tile.querySelector('.fg-video-badge')).toBeNull();
		});
	});

	describe('click', () => {
		it('starts playback regardless of the stored autoplay value', () => {
			const { play } = loadModule();
			const tile = fileTile({ autoplay: false, controls: false, mute: true });

			play(tile);

			const video = tile.querySelector('video');
			expect(video.autoplay).toBe(true);
			expect(video.muted).toBe(true);
			expect(playMock).toHaveBeenCalled();
		});

		it('opens a clicked embed with autoplay on, whatever the item stored', () => {
			const { play } = loadModule();
			const tile = embedTile({ autoplay: false, mute: true });

			play(tile);

			const params = playerParams(tile);
			expect(params.get('autoplay')).toBe('1');
			expect(params.get('mute')).toBe('1');
		});

		it('leaves a tile that is already playing untouched', () => {
			const { play } = loadModule();
			const tile = fileTile({ mute: true });

			play(tile);
			const first = tile.querySelector('video');
			play(tile);

			expect(tile.querySelector('video')).toBe(first);
		});
	});

	describe('stored settings', () => {
		it('applies mute, loop and controls to the player', () => {
			const { play } = loadModule();
			const tile = fileTile({ mute: true, loop: true, controls: false });

			play(tile);

			const video = tile.querySelector('video');
			expect(video.muted).toBe(true);
			expect(video.loop).toBe(true);
			expect(video.controls).toBe(false);
		});

		it('carries mute and controls into a Vimeo embed URL', () => {
			const { play } = loadModule();
			const tile = makeTile({
				'data-fg-item-type': 'video_vimeo',
				'data-fg-embed-id': '987654',
				'data-fg-embed-settings': JSON.stringify({ mute: true, loop: true }),
			});

			play(tile);

			const params = playerParams(tile);
			expect(params.get('muted')).toBe('1');
			expect(params.get('loop')).toBe('1');
		});
	});
});
