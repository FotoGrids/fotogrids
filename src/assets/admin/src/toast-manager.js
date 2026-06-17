/**
 * Global Toast Notification Manager
 *
 * Provides a global API for triggering toast notifications from anywhere in the codebase.
 * Can be called from JavaScript or PHP (via inline scripts).
 *
 * Usage Examples:
 *
 * From JavaScript:
 * window.fotogridsToast.success('Gallery saved successfully!');
 * window.fotogridsToast.error('Failed to save gallery', 0); // 0 = no auto-dismiss
 * window.fotogridsToast.warning('Please check your settings');
 * window.fotogridsToast.info('Processing your request...');
 *
 * From PHP (inline script):
 * wp_add_inline_script('fotogrids-toast-init', 'window.fotogridsToast.success("Gallery saved!");');
 *
 * Advanced usage:
 * const toastId = window.fotogridsToast.add({
 *     message: 'Custom toast',
 *     type: 'info',
 *     duration: 3000
 * });
 * window.fotogridsToast.remove(toastId); // Dismiss manually
 * window.fotogridsToast.clear(); // Clear all toasts
 */

class ToastManager {
	constructor() {
		this.toasts = [];
		this.listeners = [];
		this.nextId = 1;
	}

	/**
	 * Subscribe to toast changes
	 * @param {Function} callback - Function to call when toasts change
	 * @returns {Function} Unsubscribe function
	 */
	subscribe(callback) {
		this.listeners.push(callback);
		return () => {
			this.listeners = this.listeners.filter(
				(listener) => listener !== callback
			);
		};
	}

	/**
	 * Notify all listeners of toast changes
	 */
	notify() {
		this.listeners.forEach((callback) => callback([...this.toasts]));
	}

	/**
	 * Add a new toast
	 * @param {Object} options - Toast options
	 * @param {string} options.message - Toast message
	 * @param {string} options.type - Toast type: 'success', 'error', 'warning', 'info'
	 * @param {number} options.duration - Auto-dismiss duration in milliseconds (0 = no auto-dismiss)
	 * @returns {string} Toast ID
	 */
	add({ message, type = 'info', duration = 5000 }) {
		if (!message) {
			console.warn('FotoGrids Toast: Message is required');
			return null;
		}

		const toast = {
			id: `toast-${this.nextId++}`,
			message: String(message),
			type: ['success', 'error', 'warning', 'info'].includes(type)
				? type
				: 'info',
			duration:
				typeof duration === 'number' && duration >= 0 ? duration : 5000,
			timestamp: Date.now(),
		};

		this.toasts.push(toast);
		this.notify();

		return toast.id;
	}

	/**
	 * Remove a toast by ID
	 * @param {string} id - Toast ID
	 */
	remove(id) {
		const index = this.toasts.findIndex((toast) => toast.id === id);
		if (index !== -1) {
			this.toasts.splice(index, 1);
			this.notify();
		}
	}

	/**
	 * Remove all toasts
	 */
	clear() {
		this.toasts = [];
		this.notify();
	}

	/**
	 * Show a success toast
	 * @param {string} message - Toast message
	 * @param {number} duration - Auto-dismiss duration in milliseconds
	 * @returns {string} Toast ID
	 */
	success(message, duration = 5000) {
		return this.add({ message, type: 'success', duration });
	}

	/**
	 * Show an error toast
	 * @param {string} message - Toast message
	 * @param {number} duration - Auto-dismiss duration in milliseconds (0 = no auto-dismiss)
	 * @returns {string} Toast ID
	 */
	error(message, duration = 7000) {
		return this.add({ message, type: 'error', duration });
	}

	/**
	 * Show a warning toast
	 * @param {string} message - Toast message
	 * @param {number} duration - Auto-dismiss duration in milliseconds
	 * @returns {string} Toast ID
	 */
	warning(message, duration = 6000) {
		return this.add({ message, type: 'warning', duration });
	}

	/**
	 * Show an info toast
	 * @param {string} message - Toast message
	 * @param {number} duration - Auto-dismiss duration in milliseconds
	 * @returns {string} Toast ID
	 */
	info(message, duration = 5000) {
		return this.add({ message, type: 'info', duration });
	}
}

const toastManager = new ToastManager();

if (typeof window !== 'undefined') {
	window.fotogridsToast = toastManager;
}

export default toastManager;
