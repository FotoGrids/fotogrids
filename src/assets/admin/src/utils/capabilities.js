/**
 * Whether the current user holds a FotoGrids capability.
 *
 * Reads the capability snapshot localised on every FotoGrids screen. When the
 * snapshot is missing the capability reads as held, so no surface is locked
 * by accident.
 *
 * @param {string} cap Capability key.
 * @return {boolean} True when the user holds the capability.
 */
export const userCan = (cap) => {
	const bag = window.fotogridsAdmin?.capabilities;
	if (!bag) {
		return true;
	}
	return bag[cap] === true;
};
