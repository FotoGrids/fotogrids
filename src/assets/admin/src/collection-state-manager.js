/**
 * FotoGrids Collection State Manager
 *
 * Global state manager for collection items and unsaved changes tracking.
 * Provides a centralized, scalable solution for state management across components.
 */

(function () {
	'use strict';

	window.FotoGridsCollectionState = {
		items: {
			ids: [],
			initialIds: [],

			/**
			 * Set items
			 * @param {Array} itemIds - Array of item IDs
			 */
			setItems(itemIds) {
				if (!Array.isArray(itemIds)) {
					console.warn(
						'FotoGridsCollectionState: setItems expects an array'
					);
					return;
				}
				this.ids = [...itemIds];
				window.FotoGridsCollectionState._notifyListeners('items');
			},

			/**
			 * Initialize items (sets both current and initial state)
			 * @param {Array} itemIds - Array of item IDs
			 */
			initItems(itemIds) {
				if (!Array.isArray(itemIds)) {
					console.warn(
						'FotoGridsCollectionState: initItems expects an array'
					);
					return;
				}
				this.ids = [...itemIds];
				this.initialIds = [...itemIds];
				window.FotoGridsCollectionState._notifyListeners('items');
			},

			/**
			 * Add item
			 * @param {string|number} itemId - Item ID to add
			 */
			addItem(itemId) {
				if (!this.ids.includes(itemId)) {
					this.ids.push(itemId);
					window.FotoGridsCollectionState._notifyListeners('items');
				}
			},

			/**
			 * Remove item
			 * @param {string|number} itemId - Item ID to remove
			 */
			removeItem(itemId) {
				const index = this.ids.indexOf(itemId);
				if (index > -1) {
					this.ids.splice(index, 1);
					window.FotoGridsCollectionState._notifyListeners('items');
				}
			},

			/**
			 * Reorder items
			 * @param {Array} itemIds - New order of item IDs
			 */
			reorderItems(itemIds) {
				if (!Array.isArray(itemIds)) {
					console.warn(
						'FotoGridsCollectionState: reorderItems expects an array'
					);
					return;
				}
				this.ids = [...itemIds];
				window.FotoGridsCollectionState._notifyListeners('items');
			},

			/**
			 * Check if items have changed
			 * @returns {boolean}
			 */
			hasChanged() {
				if (this.ids.length !== this.initialIds.length) {
					return true;
				}
				return this.ids.some(
					(id, index) => id !== this.initialIds[index]
				);
			},

			reset() {
				this.ids = [...this.initialIds];
				window.FotoGridsCollectionState._notifyListeners('items');
			},

			save() {
				this.initialIds = [...this.ids];
				window.FotoGridsCollectionState._notifyListeners('items');
			},
		},

		unsavedChanges: {
			hasChanges: false,
			sources: {
				items: false,
				form: false,
				settings: false,
			},

			/**
			 * Set unsaved changes state
			 * @param {boolean} hasChanges - Whether there are unsaved changes
			 * @param {string} source - Source of the change ('items', 'form', 'settings')
			 */
			set(hasChanges, source) {
				this.hasChanges = hasChanges;
				if (source) {
					this.sources[source] = hasChanges;
				}
				window.FotoGridsCollectionState._notifyListeners(
					'unsavedChanges'
				);
			},

			/**
			 * Mark changes from a specific source
			 * @param {string} source - Source of the change
			 */
			markChanged(source) {
				this.hasChanges = true;
				if (source) {
					this.sources[source] = true;
				}
				window.FotoGridsCollectionState._notifyListeners(
					'unsavedChanges'
				);
			},

			clear() {
				this.hasChanges = false;
				this.sources = {
					items: false,
					form: false,
					settings: false,
				};
				window.FotoGridsCollectionState._notifyListeners(
					'unsavedChanges'
				);
			},

			/**
			 * Check if there are unsaved changes
			 * @returns {boolean}
			 */
			has() {
				return this.hasChanges;
			},
		},

		autosave: {
			enabled: false,
			interval: null,
			delay: 2000,

			enable() {
				this.enabled = true;
				window.FotoGridsCollectionState._notifyListeners('autosave');
			},

			disable() {
				this.enabled = false;
				if (this.interval) {
					clearTimeout(this.interval);
					this.interval = null;
				}
				window.FotoGridsCollectionState._notifyListeners('autosave');
			},

			/**
			 * Set autosave state
			 * @param {boolean} enabled - Whether autosave is enabled
			 */
			set(enabled) {
				if (enabled) {
					this.enable();
				} else {
					this.disable();
				}
			},

			/**
			 * Trigger autosave (debounced)
			 * @param {Function} saveCallback - Callback function to execute save
			 */
			trigger(saveCallback) {
				if (!this.enabled || typeof saveCallback !== 'function') {
					return;
				}

				if (this.interval) {
					clearTimeout(this.interval);
				}

				this.interval = setTimeout(() => {
					if (
						this.enabled &&
						window.FotoGridsAjaxSave &&
						window.FotoGridsAjaxSave.save
					) {
						window.FotoGridsAjaxSave.save();
					}
					this.interval = null;
				}, this.delay);
			},
		},

		_listeners: {
			items: [],
			unsavedChanges: [],
			autosave: [],
		},

		/**
		 * Add event listener
		 * @param {string} event - Event name ('items', 'unsavedChanges', 'autosave')
		 * @param {Function} callback - Callback function
		 */
		on(event, callback) {
			if (this._listeners[event] && typeof callback === 'function') {
				this._listeners[event].push(callback);
			}
		},

		/**
		 * Remove event listener
		 * @param {string} event - Event name
		 * @param {Function} callback - Callback function to remove
		 */
		off(event, callback) {
			if (this._listeners[event]) {
				const index = this._listeners[event].indexOf(callback);
				if (index > -1) {
					this._listeners[event].splice(index, 1);
				}
			}
		},

		/**
		 * Notify listeners of state change
		 * @private
		 */
		_notifyListeners(event) {
			if (this._listeners[event]) {
				this._listeners[event].forEach((callback) => {
					try {
						callback();
					} catch (error) {
						console.error(
							'FotoGridsCollectionState: Listener error',
							error
						);
					}
				});
			}
		},
	};

	window.FotoGridsCollectionState.on('items', function () {
		const itemsChanged = window.FotoGridsCollectionState.items.hasChanged();
		window.FotoGridsCollectionState.unsavedChanges.sources.items =
			itemsChanged;

		const hasAnyChanges =
			itemsChanged ||
			window.FotoGridsCollectionState.unsavedChanges.sources.form ||
			window.FotoGridsCollectionState.unsavedChanges.sources.settings;

		window.FotoGridsCollectionState.unsavedChanges.hasChanges =
			hasAnyChanges;
		window.FotoGridsCollectionState._notifyListeners('unsavedChanges');
	});
})();
