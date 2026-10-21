/**
 * Easy / Advanced settings-mode helpers.
 *
 * Pure functions shared by collection-settings.js and renderPresetGroup.js:
 * mode filtering of the assembled catalog tree, preset matching and the
 * "settings that only show in Advanced" count.
 *
 * @since 1.3.0
 */
(function () {
	'use strict';

	const EASY = 'easy';
	const ADVANCED = 'advanced';
	const CONTAINER_TYPES = [
		'setting_group',
		'side_by_side',
		'setting_subtabs',
	];
	const UI_ONLY_KEYS = ['_linked'];

	const isPlainObject = (value) =>
		value !== null && typeof value === 'object' && !Array.isArray(value);

	const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

	/**
	 * Whether a node is a container rather than a setting.
	 *
	 * @since 1.3.0
	 *
	 * @param {Object} node Catalog node.
	 * @returns {boolean}
	 */
	const isContainer = (node) =>
		isPlainObject(node) && CONTAINER_TYPES.includes(node.type);

	/**
	 * Modes a node shows in. Absent or empty means Advanced only.
	 *
	 * @since 1.3.0
	 *
	 * @param {Object} node Catalog node.
	 * @returns {string[]}
	 */
	const nodeModes = (node) =>
		Array.isArray(node?.modes) && node.modes.length > 0
			? node.modes
			: [ADVANCED];

	const optedOut = (node, mode) =>
		Array.isArray(node?.modes) &&
		node.modes.length > 0 &&
		!node.modes.includes(mode);

	const filterSubTabs = (subTabs, mode) => {
		const filtered = {};
		Object.keys(subTabs).forEach((id) => {
			const subTab = subTabs[id];
			if (!isPlainObject(subTab) || optedOut(subTab, mode)) {
				return;
			}
			const settings = filterSettings(subTab.settings, mode);
			if (settings.length > 0) {
				filtered[id] = { ...subTab, settings };
			}
		});
		return filtered;
	};

	const filterNode = (node, mode) => {
		if (!isPlainObject(node)) {
			return null;
		}

		if (!isContainer(node)) {
			return nodeModes(node).includes(mode) ? node : null;
		}

		if (optedOut(node, mode)) {
			return null;
		}

		if (node.type === 'setting_subtabs') {
			const subTabs = filterSubTabs(node.subTabs || {}, mode);
			return Object.keys(subTabs).length > 0
				? { ...node, subTabs }
				: null;
		}

		const settings = filterSettings(node.settings, mode);
		return settings.length > 0 ? { ...node, settings } : null;
	};

	function filterSettings(list, mode) {
		if (!Array.isArray(list)) {
			return [];
		}
		return list.map((node) => filterNode(node, mode)).filter(Boolean);
	}

	/**
	 * Derive the tree visible in a mode. Leaves show when their `modes`
	 * include it; containers, subtabs and tabs show when a descendant does.
	 * Conditions are left for the renderer.
	 *
	 * @since 1.3.0
	 *
	 * @param {Object<string, Object>} groups Tab id to tab node.
	 * @param {string} mode 'easy' or 'advanced'.
	 * @returns {Object<string, Object>}
	 */
	const filterTreeForMode = (groups, mode) => {
		const filtered = {};
		if (!isPlainObject(groups)) {
			return filtered;
		}

		Object.keys(groups).forEach((tabId) => {
			const tab = groups[tabId];
			if (!isPlainObject(tab) || optedOut(tab, mode)) {
				return;
			}

			const next = { ...tab };
			let visible = false;

			if (Array.isArray(tab.settings)) {
				next.settings = filterSettings(tab.settings, mode);
				visible = visible || next.settings.length > 0;
			}

			if (isPlainObject(tab.subTabs)) {
				next.subTabs = filterSubTabs(tab.subTabs, mode);
				visible = visible || Object.keys(next.subTabs).length > 0;
			}

			if (visible) {
				filtered[tabId] = next;
			}
		});

		return filtered;
	};

	/**
	 * Visit every leaf node of a tree.
	 *
	 * @since 1.3.0
	 *
	 * @param {Object<string, Object>} groups
	 * @param {(node: Object) => void} visit
	 */
	const walkLeaves = (groups, visit) => {
		const walkList = (list) => {
			if (!Array.isArray(list)) {
				return;
			}
			list.forEach((node) => {
				if (!isPlainObject(node)) {
					return;
				}
				if (!isContainer(node)) {
					visit(node);
					return;
				}
				if (node.type === 'setting_subtabs') {
					walkSubTabs(node.subTabs);
					return;
				}
				walkList(node.settings);
			});
		};
		const walkSubTabs = (subTabs) => {
			if (!isPlainObject(subTabs)) {
				return;
			}
			Object.values(subTabs).forEach((subTab) =>
				walkList(subTab?.settings)
			);
		};

		if (!isPlainObject(groups)) {
			return;
		}
		Object.values(groups).forEach((tab) => {
			walkList(tab?.settings);
			walkSubTabs(tab?.subTabs);
		});
	};

	/**
	 * Keys of every option `values` map in a preset_group.
	 *
	 * @since 1.3.0
	 *
	 * @param {Object} setting preset_group node.
	 * @returns {string[]}
	 */
	const presetKeys = (setting) => {
		const keys = [];
		(Array.isArray(setting?.options) ? setting.options : []).forEach(
			(option) => {
				if (isPlainObject(option?.values)) {
					Object.keys(option.values).forEach((key) => {
						if (!keys.includes(key)) {
							keys.push(key);
						}
					});
				}
			}
		);
		return keys;
	};

	/**
	 * Setting keys editable in a mode: visible leaves plus keys written by
	 * visible preset groups.
	 *
	 * @since 1.3.0
	 *
	 * @param {Object<string, Object>} groups Unfiltered tree.
	 * @param {string} mode
	 * @returns {Set<string>}
	 */
	const collectModeKeys = (groups, mode) => {
		const keys = new Set();
		walkLeaves(filterTreeForMode(groups, mode), (node) => {
			if (node.type === 'preset_group') {
				presetKeys(node).forEach((key) => keys.add(key));
				return;
			}
			if (typeof node.key === 'string' && node.key !== '') {
				keys.add(node.key);
			}
		});
		return keys;
	};

	/**
	 * Keep the active tab when it is still visible, otherwise land on the
	 * first visible tab.
	 *
	 * @since 1.3.0
	 *
	 * @param {Object<string, Object>} visibleGroups
	 * @param {string} activeTab
	 * @param {(group: Object) => boolean} [isShown]
	 * @returns {string}
	 */
	const resolveActiveTab = (visibleGroups, activeTab, isShown) => {
		if (visibleGroups && visibleGroups[activeTab]) {
			return activeTab;
		}
		const ids = Object.keys(visibleGroups || {});
		const shown = ids.find(
			(id) => typeof isShown !== 'function' || isShown(visibleGroups[id])
		);
		return shown || ids[0] || activeTab;
	};

	const parseMaybeJson = (value) => {
		if (typeof value !== 'string') {
			return value;
		}
		const trimmed = value.trim();
		if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
			try {
				return JSON.parse(trimmed);
			} catch {
				return value;
			}
		}
		return value;
	};

	const TRUE_VALUES = [true, 1, '1', 'true'];
	const FALSE_VALUES = [false, 0, '0', 'false', '', null, undefined];

	const toBool = (value) => {
		if (TRUE_VALUES.includes(value)) {
			return true;
		}
		if (FALSE_VALUES.includes(value)) {
			return false;
		}
		return null;
	};

	const isNumeric = (value) =>
		(typeof value === 'number' && Number.isFinite(value)) ||
		(typeof value === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(value));

	const scalarEqual = (a, b) => {
		if (a === b) {
			return true;
		}
		if (typeof a === 'boolean' || typeof b === 'boolean') {
			const boolA = toBool(a);
			return boolA !== null && boolA === toBool(b);
		}
		if (isNumeric(a) && isNumeric(b)) {
			return Number(a) === Number(b);
		}
		return a == null && b == null;
	};

	const dataKeys = (obj) =>
		Object.keys(obj).filter((key) => !UI_ONLY_KEYS.includes(key));

	// An object against a scalar: a {value, unit} pair compares its value,
	// any other object (e.g. four sides) compares every entry.
	const objectEqualsScalar = (obj, scalar) => {
		if (hasOwn(obj, 'value')) {
			return looseEqual(obj.value, scalar);
		}
		const keys = dataKeys(obj);
		return keys.length > 0 && keys.every((k) => looseEqual(obj[k], scalar));
	};

	/**
	 * Deep equality that treats numbers and numeric strings, and boolean
	 * spellings, as equal and ignores UI-only keys.
	 *
	 * @since 1.3.0
	 *
	 * @param {unknown} a
	 * @param {unknown} b
	 * @returns {boolean}
	 */
	function looseEqual(a, b) {
		const left = parseMaybeJson(a);
		const right = parseMaybeJson(b);

		if (Array.isArray(left) || Array.isArray(right)) {
			return (
				Array.isArray(left) &&
				Array.isArray(right) &&
				left.length === right.length &&
				left.every((item, i) => looseEqual(item, right[i]))
			);
		}

		if (isPlainObject(left) && isPlainObject(right)) {
			const keys = new Set([...dataKeys(left), ...dataKeys(right)]);
			return [...keys].every((k) => looseEqual(left[k], right[k]));
		}

		if (isPlainObject(left)) {
			return objectEqualsScalar(left, right);
		}
		if (isPlainObject(right)) {
			return objectEqualsScalar(right, left);
		}

		return scalarEqual(left, right);
	}

	/**
	 * Whether a stored value satisfies a preset's expected value. Objects
	 * match on the entries the preset lists (e.g. only some breakpoints).
	 *
	 * @since 1.3.0
	 *
	 * @param {unknown} expected
	 * @param {unknown} actual
	 * @returns {boolean}
	 */
	const matchesValue = (expected, actual) => {
		const want = parseMaybeJson(expected);
		const have = parseMaybeJson(actual);

		if (isPlainObject(want) && isPlainObject(have)) {
			return dataKeys(want).every((k) => matchesValue(want[k], have[k]));
		}

		return looseEqual(want, have);
	};

	/**
	 * First option whose every value matches the current settings.
	 *
	 * @since 1.3.0
	 *
	 * @param {Array<Object>} options preset_group options.
	 * @param {Object} current Key to current value.
	 * @returns {Object|null} The matching option, or null for Custom.
	 */
	const matchPreset = (options, current) => {
		const source = isPlainObject(current) ? current : {};
		return (
			(Array.isArray(options) ? options : []).find(
				(option) =>
					isPlainObject(option?.values) &&
					Object.keys(option.values).length > 0 &&
					Object.keys(option.values).every((key) =>
						matchesValue(option.values[key], source[key])
					)
			) || null
		);
	};

	const clone = (value) =>
		value === undefined ? value : JSON.parse(JSON.stringify(value));

	/**
	 * Values to write for a picked preset. A partial object is merged over
	 * the current object so unlisted entries keep their value.
	 *
	 * @since 1.3.0
	 *
	 * @param {Object} values Option `values` map.
	 * @param {Object} current Key to current value.
	 * @returns {Object}
	 */
	const applyPresetValues = (values, current) => {
		const next = {};
		const source = isPlainObject(current) ? current : {};
		Object.keys(isPlainObject(values) ? values : {}).forEach((key) => {
			const want = clone(values[key]);
			const have = parseMaybeJson(source[key]);
			if (isPlainObject(want) && isPlainObject(have)) {
				const merged = { ...have, ...want };
				UI_ONLY_KEYS.forEach((k) => delete merged[k]);
				next[key] = merged;
				return;
			}
			next[key] = want;
		});
		return next;
	};

	window.FotoGridsSettingsMode = {
		EASY,
		ADVANCED,
		nodeModes,
		isContainer,
		filterTreeForMode,
		walkLeaves,
		presetKeys,
		collectModeKeys,
		resolveActiveTab,
		looseEqual,
		matchesValue,
		matchPreset,
		applyPresetValues,
	};
})();
