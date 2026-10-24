/**
 * Walkthrough module entry: mounts the tour for the current screen.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import Walkthrough, { START_EVENT } from './components/Walkthrough';
import { getTours } from './tours';
import './walkthrough.scss';

window.FotoGridsWalkthrough = {
	/**
	 * Start the current screen's tour.
	 *
	 * @returns {void}
	 */
	start() {
		document.dispatchEvent(new CustomEvent(START_EVENT));
	},
};

const boot = () => {
	const config = window.fotogridsWalkthrough;
	const tour = config ? getTours()[config.tour] : null;
	if (!tour) {
		return;
	}

	const container = document.createElement('div');
	container.id = 'fotogrids-walkthrough-root';
	document.body.appendChild(container);
	createRoot(container).render(
		React.createElement(Walkthrough, { tour, config })
	);
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', boot);
} else {
	boot();
}
