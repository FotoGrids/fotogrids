/**
 * FotoGrids Collection State Manager
 *
 * Global state manager for collection items and unsaved changes tracking.
 * Provides a centralized, scalable solution for state management across components.
 */

(function() {
    'use strict';

    // Initialize global state object
    window.FotoGridsCollectionState = {
        // Items state
        items: {
            // Array of item IDs in current order
            ids: [],
            // Initial state snapshot (for comparison)
            initialIds: [],

            /**
             * Set items
             * @param {Array} itemIds - Array of item IDs
             */
            setItems: function(itemIds) {
                if (!Array.isArray(itemIds)) {
                    console.warn('FotoGridsCollectionState: setItems expects an array');
                    return;
                }
                this.ids = [...itemIds];
                window.FotoGridsCollectionState._notifyListeners('items');
            },

            /**
             * Initialize items (sets both current and initial state)
             * @param {Array} itemIds - Array of item IDs
             */
            initItems: function(itemIds) {
                if (!Array.isArray(itemIds)) {
                    console.warn('FotoGridsCollectionState: initItems expects an array');
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
            addItem: function(itemId) {
                if (!this.ids.includes(itemId)) {
                    this.ids.push(itemId);
                    window.FotoGridsCollectionState._notifyListeners('items');
                }
            },

            /**
             * Remove item
             * @param {string|number} itemId - Item ID to remove
             */
            removeItem: function(itemId) {
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
            reorderItems: function(itemIds) {
                if (!Array.isArray(itemIds)) {
                    console.warn('FotoGridsCollectionState: reorderItems expects an array');
                    return;
                }
                this.ids = [...itemIds];
                window.FotoGridsCollectionState._notifyListeners('items');
            },

            /**
             * Check if items have changed
             * @returns {boolean}
             */
            hasChanged: function() {
                if (this.ids.length !== this.initialIds.length) {
                    return true;
                }
                return this.ids.some((id, index) => id !== this.initialIds[index]);
            },

            /**
             * Reset to initial state
             */
            reset: function() {
                this.ids = [...this.initialIds];
                window.FotoGridsCollectionState._notifyListeners('items');
            },

            /**
             * Save current state as initial
             */
            save: function() {
                this.initialIds = [...this.ids];
                window.FotoGridsCollectionState._notifyListeners('items');
            }
        },

        // Unsaved changes state
        unsavedChanges: {
            // Flag indicating if there are unsaved changes
            hasChanges: false,
            // Sources of changes (for debugging/tracking)
            sources: {
                items: false,
                form: false,
                settings: false
            },

            /**
             * Set unsaved changes state
             * @param {boolean} hasChanges - Whether there are unsaved changes
             * @param {string} source - Source of the change ('items', 'form', 'settings')
             */
            set: function(hasChanges, source) {
                this.hasChanges = hasChanges;
                if (source) {
                    this.sources[source] = hasChanges;
                }
                window.FotoGridsCollectionState._notifyListeners('unsavedChanges');
            },

            /**
             * Mark changes from a specific source
             * @param {string} source - Source of the change
             */
            markChanged: function(source) {
                this.hasChanges = true;
                if (source) {
                    this.sources[source] = true;
                }
                window.FotoGridsCollectionState._notifyListeners('unsavedChanges');
            },

            /**
             * Clear all unsaved changes
             */
            clear: function() {
                this.hasChanges = false;
                this.sources = {
                    items: false,
                    form: false,
                    settings: false
                };
                window.FotoGridsCollectionState._notifyListeners('unsavedChanges');
            },

            /**
             * Check if there are unsaved changes
             * @returns {boolean}
             */
            has: function() {
                return this.hasChanges;
            }
        },

        // Autosave state
        autosave: {
            enabled: false,
            interval: null,
            delay: 2000, // 2 seconds debounce

            /**
             * Enable autosave
             */
            enable: function() {
                this.enabled = true;
                window.FotoGridsCollectionState._notifyListeners('autosave');
            },

            /**
             * Disable autosave
             */
            disable: function() {
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
            set: function(enabled) {
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
            trigger: function(saveCallback) {
                if (!this.enabled || typeof saveCallback !== 'function') {
                    return;
                }

                if (this.interval) {
                    clearTimeout(this.interval);
                }

                this.interval = setTimeout(() => {
                    if (this.enabled && window.FotoGridsAjaxSave && window.FotoGridsAjaxSave.save) {
                        window.FotoGridsAjaxSave.save();
                    }
                    this.interval = null;
                }, this.delay);
            }
        },

        // Event listeners
        _listeners: {
            items: [],
            unsavedChanges: [],
            autosave: []
        },

        /**
         * Add event listener
         * @param {string} event - Event name ('items', 'unsavedChanges', 'autosave')
         * @param {Function} callback - Callback function
         */
        on: function(event, callback) {
            if (this._listeners[event] && typeof callback === 'function') {
                this._listeners[event].push(callback);
            }
        },

        /**
         * Remove event listener
         * @param {string} event - Event name
         * @param {Function} callback - Callback function to remove
         */
        off: function(event, callback) {
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
        _notifyListeners: function(event) {
            if (this._listeners[event]) {
                this._listeners[event].forEach(callback => {
                    try {
                        callback();
                    } catch (error) {
                        console.error('FotoGridsCollectionState: Listener error', error);
                    }
                });
            }
        }
    };

    // Listen for items changes to auto-update unsaved changes
    window.FotoGridsCollectionState.on('items', function() {
        const itemsChanged = window.FotoGridsCollectionState.items.hasChanged();
        window.FotoGridsCollectionState.unsavedChanges.sources.items = itemsChanged;

        // Update overall unsaved changes state
        const hasAnyChanges = itemsChanged ||
                             window.FotoGridsCollectionState.unsavedChanges.sources.form ||
                             window.FotoGridsCollectionState.unsavedChanges.sources.settings;

        window.FotoGridsCollectionState.unsavedChanges.hasChanges = hasAnyChanges;
        window.FotoGridsCollectionState._notifyListeners('unsavedChanges');
    });

})();

