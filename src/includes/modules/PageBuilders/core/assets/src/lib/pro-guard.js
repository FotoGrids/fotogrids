/**
 * Pro-guard client helper.
 *
 * Decides whether a picker card should be enabled or disabled, given a
 * gallery's `requires_pro` flag (from the REST endpoint) and the current
 * user's license state.
 *
 * Mirrors the server-side product rule (see core/class-pro-guard.php):
 *
 *   - never-Pro user, item requires Pro  -> card disabled, badge shown
 *   - active-Pro user                     -> card always enabled
 *   - lapsed-Pro user, item requires Pro  -> card enabled (the item already
 *                                            exists; the user is placing,
 *                                            not editing)
 *   - item does NOT require Pro           -> card always enabled
 *
 * The license state is sourced from the `licenseState` field exposed on the
 * page-builders localize payload (`window.fotogridsPageBuilders.licenseState`).
 * The Page Builders REST endpoints set it; the gallery picker REST response
 * also echoes it back per request as a defence-in-depth.
 *
 * Values for `licenseState`:
 *   'active' - Pro license currently valid
 *   'lapsed' - User has been on Pro before but the license is not currently valid
 *   'none'   - User has never been on Pro
 */

/**
 * Decide whether a picker item is selectable for the current viewer.
 *
 * @param {Object} item        A picker item: `{ id, requires_pro, ... }`.
 * @param {string} licenseState One of 'active' | 'lapsed' | 'none'.
 * @return {boolean} True when the item can be selected.
 */
export const isItemSelectable = (item, licenseState) => {
    if (!item || !item.requires_pro) {
        return true;
    }
    if (licenseState === 'active' || licenseState === 'lapsed') {
        return true;
    }
    return false; // never-Pro user, item requires Pro
};

/**
 * Whether to show a "Pro" badge on a picker card. Different from
 * `isItemSelectable` because we want lapsed-Pro users to still see the
 * badge (so they know what they're picking), even though the item is
 * selectable.
 *
 * @param {Object} item A picker item.
 * @return {boolean}
 */
export const shouldShowProBadge = (item) => Boolean(item && item.requires_pro);

/**
 * Whether to show the "Requires FotoGrids Pro" lock tooltip on a card.
 * Only true when the item is both Pro-requiring AND non-selectable for the
 * current viewer.
 *
 * @param {Object} item
 * @param {string} licenseState
 * @return {boolean}
 */
export const shouldShowProLock = (item, licenseState) =>
    shouldShowProBadge(item) && !isItemSelectable(item, licenseState);

/**
 * Read the current license state from the page-builders localize payload,
 * with a safe fallback.
 *
 * @return {'active'|'lapsed'|'none'}
 */
export const readLicenseState = () => {
    const state = window?.fotogridsPageBuilders?.licenseState;
    if (state === 'active' || state === 'lapsed' || state === 'none') {
        return state;
    }
    return 'none';
};
