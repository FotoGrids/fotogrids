/**
 * The walkthrough entry: the public start() and mounting.
 */
import { act } from 'react';

const loadEntry = async () => {
	await act(async () => {
		jest.isolateModules(() => {
			require('@modules/Walkthrough/assets/src/walkthrough');
		});
	});
};

afterEach(() => {
	document.body.innerHTML = '';
	delete window.fotogridsWalkthrough;
	delete window.FotoGridsWalkthrough;
});

it('exposes start(), which fires the start event', async () => {
	await loadEntry();
	const listener = jest.fn();
	document.addEventListener('fotogrids:walkthrough:start', listener);
	window.FotoGridsWalkthrough.start();
	document.removeEventListener('fotogrids:walkthrough:start', listener);

	expect(listener).toHaveBeenCalledTimes(1);
});

it('mounts a root for a known tour', async () => {
	window.fotogridsWalkthrough = { tour: 'gallery' };
	await loadEntry();

	expect(
		document.getElementById('fotogrids-walkthrough-root')
	).not.toBeNull();
});

it('mounts nothing without data or for an unknown tour', async () => {
	await loadEntry();
	expect(document.getElementById('fotogrids-walkthrough-root')).toBeNull();

	window.fotogridsWalkthrough = { tour: 'stats' };
	await loadEntry();
	expect(document.getElementById('fotogrids-walkthrough-root')).toBeNull();
});
