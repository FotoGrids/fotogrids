/**
 * Tests for public/render/video/video-inline.js (IIFE; runs init() on import).
 *
 * The module publishes play() on window.FotoGrids.modules.videoInline, which is
 * what these tests drive - the click wiring itself belongs to onGallery.
 */

function loadModule() {
	jest.isolateModules(() => {
		require('../../../public/render/video/video-inline.js');
	});
	return window.FotoGrids.modules.videoInline;
}

function makeTile(attrs) {
	const tile = document.createElement('span');
	tile.className = 'fg-video';
	tile.setAttribute('data-fg-playback-mode', 'inline');
	Object.entries(attrs).forEach(([name, value]) => {
		tile.setAttribute(name, value);
	});
	document.body.appendChild(tile);
	return tile;
}

function fileTile(settings) {
	const attrs = {
		'data-fg-item-type': 'video_file',
		'data-fg-video-src': 'https://example.com/clip.mp4',
	};
	if (settings !== undefined) {
		attrs['data-fg-embed-settings'] = JSON.stringify(settings);
	}
	return makeTile(attrs);
}

function playerParams(tile) {
	return new URL(tile.querySelector('iframe').src).searchParams;
}

describe('video-inline', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		window.FotoGrids = { onGallery: jest.fn() };
	});

	it('applies the stored playback settings to a file video', () => {
		const play = loadModule().play;
		const tile = fileTile({
			autoplay: false,
			mute: true,
			loop: true,
			controls: false,
		});

		play(tile);

		const video = tile.querySelector('video');
		expect(video).not.toBeNull();
		expect(video.src).toBe('https://example.com/clip.mp4');
		expect(video.autoplay).toBe(false);
		expect(video.muted).toBe(true);
		expect(video.loop).toBe(true);
		expect(video.controls).toBe(false);
	});

	it('falls back to autoplay and controls on when settings are absent', () => {
		const play = loadModule().play;
		const tile = fileTile();

		play(tile);

		const video = tile.querySelector('video');
		expect(video.autoplay).toBe(true);
		expect(video.controls).toBe(true);
		expect(video.muted).toBe(false);
		expect(video.loop).toBe(false);
	});

	it('carries autoplay through to a YouTube embed', () => {
		const play = loadModule().play;
		const off = makeTile({
			'data-fg-item-type': 'video_youtube',
			'data-fg-embed-id': 'abc123',
			'data-fg-embed-settings': JSON.stringify({ autoplay: false }),
		});
		const on = makeTile({
			'data-fg-item-type': 'video_youtube',
			'data-fg-embed-id': 'abc123',
			'data-fg-embed-settings': JSON.stringify({ autoplay: true }),
		});

		play(off);
		play(on);

		expect(playerParams(off).get('autoplay')).toBe('0');
		expect(playerParams(on).get('autoplay')).toBe('1');
	});

	it('carries autoplay through to a Vimeo embed', () => {
		const play = loadModule().play;
		const tile = makeTile({
			'data-fg-item-type': 'video_vimeo',
			'data-fg-embed-id': '987654',
			'data-fg-embed-settings': JSON.stringify({ autoplay: false, mute: true }),
		});

		play(tile);

		const params = playerParams(tile);
		expect(params.get('autoplay')).toBe('0');
		expect(params.get('muted')).toBe('1');
	});

	it('leaves a tile that is already playing untouched', () => {
		const play = loadModule().play;
		const tile = fileTile({ mute: true });

		play(tile);
		const first = tile.querySelector('video');
		play(tile);

		expect(tile.querySelector('video')).toBe(first);
	});
});
