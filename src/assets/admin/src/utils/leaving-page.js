/**
 * Tracks whether the user is leaving the page.
 */

let leaving = false;

window.addEventListener('beforeunload', () => {
	leaving = true;
});
window.addEventListener('pagehide', () => {
	leaving = true;
});
window.addEventListener('pageshow', () => {
	leaving = false;
});

/**
 * Whether the user is leaving the page.
 *
 * The browser cancels requests still in flight when the page is left, and
 * they reject as network or JSON errors although the server did not fail.
 *
 * @return {boolean} True from `beforeunload` or `pagehide` until `pageshow`.
 */
export const isLeavingPage = () => leaving;
