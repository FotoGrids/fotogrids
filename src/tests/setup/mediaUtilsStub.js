/**
 * Stub for `@wordpress/media-utils`.
 *
 * The package is a WordPress-provided external at runtime and is not installed
 * locally, so Jest maps it here. Tests that exercise the upload paths mock it
 * themselves; this stub only keeps module resolution working for the tests
 * that import the component tree without using it.
 */
module.exports = {
	uploadMedia: () => {},
};
