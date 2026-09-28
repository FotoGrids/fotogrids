/**
 * Keyboard activation for elements that carry role="button".
 */

/**
 * Builds an onKeyDown handler that runs `handler` on Enter or Space, the two
 * keys a native button responds to.
 *
 * @param {Function} handler Called with the keyboard event.
 * @return {Function} The onKeyDown handler.
 */
export function activateOnKey(handler) {
	return (event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handler(event);
		}
	};
}
