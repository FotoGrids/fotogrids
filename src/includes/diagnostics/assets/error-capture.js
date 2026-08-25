/**
 * FotoGrids browser error capture.
 *
 * Reports uncaught errors and rejected promises whose origin is a FotoGrids
 * script to the diagnostics endpoint, so they appear in Tools > System Info.
 *
 * Enqueued only for users who can already read the log, so there is no
 * anonymous reporting path. Deliberately dependency-free and standalone: it has
 * to survive the failure of whatever else is on the page.
 */
(function () {
	'use strict';

	var config = window.fotogridsErrorCapture;

	if (!config || !config.endpoint || !config.paths || !config.paths.length) {
		return;
	}

	var MAX_REPORTS_PER_PAGE = 10;
	var sent = 0;
	var seen = {};

	/**
	 * Whether a piece of text points at a FotoGrids asset.
	 *
	 * @param {string} text Filename or stack trace.
	 * @return {boolean} True when it references one of our script paths.
	 */
	function isOurs(text) {
		if (!text) {
			return false;
		}

		for (var i = 0; i < config.paths.length; i++) {
			if (text.indexOf(config.paths[i]) !== -1) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Posts one error to the diagnostics endpoint.
	 *
	 * @param {Object} payload Error fields.
	 * @return {void}
	 */
	function report(payload) {
		if (sent >= MAX_REPORTS_PER_PAGE) {
			return;
		}

		var key = payload.message + '|' + payload.file + '|' + payload.line;

		if (seen[key]) {
			return;
		}

		seen[key] = true;
		sent++;

		try {
			window.fetch(config.endpoint, {
				method: 'POST',
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': config.nonce,
				},
				body: JSON.stringify(payload),
			});
		} catch (e) {
			// A diagnostics report must never surface as a second error.
		}
	}

	window.addEventListener('error', function (event) {
		var file = event.filename || '';
		var stack = (event.error && event.error.stack) || '';

		// A cross-origin script reports "Script error." with no stack, which
		// cannot be attributed to anyone; those are left alone.
		if (!isOurs(file) && !isOurs(stack)) {
			return;
		}

		report({
			message: event.message || 'Unknown error',
			file: file,
			line: event.lineno || 0,
			stack: stack,
			url: window.location.href,
		});
	});

	window.addEventListener('unhandledrejection', function (event) {
		var reason = event.reason;
		var stack = (reason && reason.stack) || '';

		if (!isOurs(stack)) {
			return;
		}

		report({
			message:
				'Unhandled promise rejection: ' +
				((reason && reason.message) || String(reason)),
			file: '',
			line: 0,
			stack: stack,
			url: window.location.href,
		});
	});
})();
