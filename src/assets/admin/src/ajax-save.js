/**
 * FotoGrids AJAX Save Functionality
 *
 * Handles asynchronous saving of gallery data to prevent page reloads
 */

(function () {
	'use strict';

	const strings = window.fotogridsAjaxSave?.strings || {};
	const State = window.FotoGridsCollectionState;

	document.addEventListener('DOMContentLoaded', initAjaxSave);

	function initAjaxSave() {
		const isGallery = document.body.classList.contains(
			'post-type-fotogrids_gallery'
		);
		const isAlbum = document.body.classList.contains(
			'post-type-fotogrids_album'
		);
		if ((!isGallery && !isAlbum) || !document.getElementById('post')) {
			return;
		}

		interceptFormSubmission();
		addQuickSaveButton();
		addUnsavedChangesContainer();
		initValidationErrorMonitoring();
		initFormChangeTracking();
		initBeforeUnloadWarning();
		initAutosave();

		setTimeout(() => {
			const itemsGrid = document.getElementById('fotogrids-items-grid');
			if (itemsGrid && State) {
				const itemElements = itemsGrid.querySelectorAll(
					'.fotogrids-item-item'
				);
				const itemIds = Array.from(itemElements)
					.map((el) => el.getAttribute('data-id'))
					.filter(Boolean);
				State.items.initItems(itemIds);
			}
		}, 500);

		if (State) {
			State.on('unsavedChanges', updateUnsavedChangesDisplay);
		}
	}

	function addUnsavedChangesContainer() {
		const submitBox = document.querySelector('#submitdiv .inside');
		if (submitBox) {
			submitBox.insertAdjacentHTML(
				'beforeend',
				`
                <div id="fotogrids-unsaved-changes" class="fotogrids-unsaved-changes" style="display: none;">
                    <div class="fotogrids-unsaved-changes__btn">
                        <span class="dashicons dashicons-warning"></span>
                        ${strings.youHaveUnsavedChanges}
                    </div>
                </div>
            `
			);
		}
	}

	function interceptFormSubmission() {
		const form = document.getElementById('post');
		const saveButton = document.getElementById('save-post');

		if (saveButton) {
			saveButton.addEventListener(
				'click',
				function (e) {
					// Only intercept if this is an update (not initial publish)
					const action = document.getElementById(
						'original_post_status'
					)?.value;
					if (action && action !== 'auto-draft') {
						e.preventDefault();
						e.stopImmediatePropagation();
						e.stopPropagation();
						if (State) {
							State.unsavedChanges.clear();
						}
						saveCollectionAjax();
						return false;
					}
				},
				true
			); // Use capture phase
		}

		if (form) {
			form.addEventListener(
				'submit',
				function (e) {
					// Only intercept if this is an update (not initial publish)
					const action = document.getElementById(
						'original_post_status'
					)?.value;
					if (action && action !== 'auto-draft') {
						const savePostInput =
							document.querySelector('input[name="save"]');
						if (savePostInput) {
							e.preventDefault();
							e.stopImmediatePropagation();
							saveCollectionAjax();
							return false;
						}
					}
				},
				true
			); // Use capture phase to intercept early
		}

		document.addEventListener('keydown', function (e) {
			if ((e.ctrlKey || e.metaKey) && e.which === 83) {
				// Ctrl + S or ⌘ + S
				e.preventDefault();
				saveCollectionAjax();
				return false;
			}
		});
	}

	function addQuickSaveButton() {
		const adminBar = document.getElementById('wp-admin-bar-root-default');
		if (adminBar) {
			adminBar.insertAdjacentHTML(
				'beforeend',
				`
                <li id="wp-admin-bar-fotogrids-quick-save">
                    <a class="ab-item" href="#" id="fotogrids-quick-save" title="${strings.quickSaveGallery}">
                        <span class="ab-icon dashicons dashicons-yes-alt"></span>
                        <span class="ab-label">${strings.quickSave}</span>
                    </a>
                </li>
            `
			);

			const quickSaveButton = document.getElementById(
				'fotogrids-quick-save'
			);
			if (quickSaveButton) {
				quickSaveButton.addEventListener('click', function (e) {
					e.preventDefault();
					saveCollectionAjax();
				});
			}
		}
	}

	function initValidationErrorMonitoring() {
		const checkValidationErrors = () => {
			const hasErrors = hasValidationErrors();
			updateSaveButtonState(hasErrors);
		};

		setInterval(checkValidationErrors, 500);

		checkValidationErrors();
	}

	function hasValidationErrors() {
		const validationErrors = window.FotoGridsValidationErrors || {};
		return Object.values(validationErrors).some(
			(errorInfo) => errorInfo && errorInfo.hasErrors
		);
	}

	function updateSaveButtonState(hasErrors) {
		const publishButton = document.getElementById('publish');
		const saveButton = document.getElementById('save-post');
		const quickSaveButton = document.getElementById('fotogrids-quick-save');

		if (hasErrors) {
			if (publishButton) {
				publishButton.disabled = true;

				const originalText =
					publishButton.dataset.originalText ||
					publishButton.value ||
					publishButton.textContent;
				if (!publishButton.dataset.originalText) {
					publishButton.dataset.originalText = originalText;
				}

				const errorText = strings.fixErrors;
				if (publishButton.tagName === 'INPUT') {
					publishButton.value = errorText;
				} else {
					publishButton.textContent = errorText;
				}

				publishButton.title = strings.pleaseFixValidationErrors;
			}

			if (saveButton) {
				saveButton.disabled = true;
				saveButton.title = strings.pleaseFixValidationErrors;
			}

			if (quickSaveButton) {
				quickSaveButton.disabled = true;
				quickSaveButton.title = strings.pleaseFixValidationErrors;
			}
		} else {
			if (publishButton) {
				publishButton.disabled = false;

				const originalText = publishButton.dataset.originalText;
				if (originalText) {
					if (publishButton.tagName === 'INPUT') {
						publishButton.value = originalText;
					} else {
						publishButton.textContent = originalText;
					}
				}

				publishButton.removeAttribute('title');
			}

			if (saveButton) {
				saveButton.disabled = false;
				saveButton.removeAttribute('title');
			}

			if (quickSaveButton) {
				quickSaveButton.disabled = false;
				quickSaveButton.removeAttribute('title');
			}
		}
	}

	function saveCollectionAjax() {
		if (hasValidationErrors()) {
			if (window.fotogridsToast) {
				window.fotogridsToast.error(strings.fixValidationErrors);
			}
			return false;
		}

		const form = document.getElementById('post');

		// Only disable native WP form controls - exclude the React-managed settings
		// panel so focused inputs don't lose focus and React's disabled props aren't clobbered.
		const settingsPanel = document.getElementById(
			'fotogrids-collection-settings-root'
		);
		const formElements = Array.from(
			form.querySelectorAll('input, textarea, select, button')
		).filter((el) => !settingsPanel || !settingsPanel.contains(el));
		formElements.forEach((element) => (element.disabled = true));

		const formData = new FormData(form);
		formData.append('action', 'fotogrids_save_collection');

		const nonceField = document.getElementById('fotogrids_meta_box_nonce');
		const postIdField = document.getElementById('post_ID');
		const postTypeField = document.querySelector('input[name="post_type"]');

		if (nonceField) formData.append('nonce', nonceField.value);
		if (postIdField) formData.append('post_id', postIdField.value);
		if (postTypeField) formData.append('post_type', postTypeField.value);

		const gallerySettings = {};
		const galleryInputs = document.querySelectorAll(
			'input[name^="fotogrids_"]'
		);
		galleryInputs.forEach((input) => {
			const name = input.getAttribute('name');
			const value = input.value;
			// Always include fotogrids_ inputs - even empty ones. Empty string is a
			// valid save-intent (e.g. the user cleared a codearea field). The
			// `value !== ''` guard used to be here but it silently swallowed clears:
			// FormData skips disabled inputs (they are disabled above to prevent
			// native WP submission), so this loop is the only path for these
			// dynamically-created hidden inputs to reach the server.
			if (name) {
				gallerySettings[name] = value;
				formData.append(name, value);
			}
		});

		const formFields = {};
		for (const [key, value] of formData.entries()) {
			if (key.startsWith('fotogrids_')) {
				formFields[key] = value;
			}
		}

		fetch(window.ajaxurl, {
			method: 'POST',
			body: formData,
		})
			.then((response) => {
				if (!response.ok) {
					throw new Error('Network response was not ok');
				}
				return response.json();
			})
			.then((result) => {
				if (result.success) {
					handleSaveSuccess(result.data);
				} else {
					const errorMessage = result.data?.message
						? result.data.message
						: strings.saveFailed;
					handleSaveError(errorMessage);
				}
			})
			.catch((error) => {
				console.error('Save error:', error);
				const errorMessage = error.message
					? error.message
					: strings.saveFailed;
				handleSaveError(errorMessage);
			})
			.finally(() => {
				formElements.forEach((element) => (element.disabled = false));
			});
	}

	function handleSaveSuccess(data) {
		if (data.post_title) {
			document.title =
				data.post_title +
				' ‹ ' +
				document.title.split(' ‹ ').slice(1).join(' ‹ ');
			const titleElement = document.querySelector('.wrap h1');
			if (titleElement) {
				const isAlbum = data.post_type === 'fotogrids_album';
				const editLabel = isAlbum
					? strings.editAlbum
					: strings.editGallery;
				titleElement.textContent = editLabel + ': ' + data.post_title;
			}
		}

		if (data.redirect_url) {
			const currentUrl = window.location.href;
			const newUrl = data.redirect_url;
			if (
				currentUrl !== newUrl &&
				!currentUrl.includes('post=' + data.post_id)
			) {
				window.history.replaceState({}, '', newUrl);
			}
		}

		hideUnsavedChanges();

		const successMessage = data.message
			? data.message
			: strings.gallerySavedSuccessfully;
		if (window.fotogridsToast) {
			window.fotogridsToast.success(successMessage, 1000);
		}

		updateLastSavedTime();

		document.dispatchEvent(
			new CustomEvent('fotogrids:collection_saved', { detail: data })
		);
	}

	function initAutosave() {
		if (!State) return;

		const getAutosaveSetting = () => {
			const galleryAutosaveInput = document.querySelector(
				'input[name="fotogrids_autosave"]'
			);
			if (galleryAutosaveInput) {
				return (
					galleryAutosaveInput.value === '1' ||
					galleryAutosaveInput.value === 'true'
				);
			}

			const defaultsAutosaveInput = document.querySelector(
				'input[name="fotogrids_gallery_defaults[autosave]"]'
			);
			if (defaultsAutosaveInput) {
				return (
					defaultsAutosaveInput.value === '1' ||
					defaultsAutosaveInput.value === 'true'
				);
			}

			if (window.fotogridsSettings?.settings?.autosave !== undefined) {
				return window.fotogridsSettings.settings.autosave;
			}

			return false;
		};

		State.autosave.set(getAutosaveSetting());

		document.addEventListener('change', (e) => {
			if (
				e.target.matches(
					'input[name="fotogrids_autosave"], input[name="fotogrids_gallery_defaults[autosave]"]'
				)
			) {
				const enabled =
					e.target.value === '1' || e.target.value === 'true';
				State.autosave.set(enabled);
				updateUnsavedChangesDisplay();
			}
		});

		if (State) {
			State.on('autosave', () => {
				updateUnsavedChangesDisplay();
			});
		}
	}

	function handleSaveError(message) {
		const errorMessage = message ? message : strings.saveFailed;
		if (window.fotogridsToast) {
			window.fotogridsToast.error(errorMessage, 3000);
		}

		const form = document.getElementById('post');
		if (form) {
			const settingsPanel = document.getElementById(
				'fotogrids-collection-settings-root'
			);
			const formElements = Array.from(
				form.querySelectorAll('input, textarea, select, button')
			).filter((el) => !settingsPanel || !settingsPanel.contains(el));
			formElements.forEach((element) => (element.disabled = false));
		}

		document.dispatchEvent(
			new CustomEvent('fotogrids:gallery_save_error', {
				detail: errorMessage,
			})
		);
	}

	function updateLastSavedTime() {
		const now = new Date();
		const timeString = now.toLocaleTimeString();

		let lastSaved = document.querySelector(
			'.misc-pub-fg-last-saved .timestamp'
		);
		if (!lastSaved) {
			const miscActions = document.querySelector(
				'#misc-publishing-actions'
			);
			if (miscActions) {
				miscActions.insertAdjacentHTML(
					'beforeend',
					`<div class="misc-pub-section misc-pub-fg-last-saved"> ${strings.lastSaved}: <span class="timestamp"></span></div>`
				);
				lastSaved = document.querySelector(
					'.misc-pub-fg-last-saved .timestamp'
				);
			}
		}

		if (lastSaved) {
			lastSaved.innerHTML = timeString;
		}
	}

	function updateUnsavedChangesDisplay() {
		if (!State) return;

		const autosaveEnabled = State.autosave.enabled;
		const hasChanges = State.unsavedChanges.has();
		const shouldShow = hasChanges && !autosaveEnabled;

		const unsavedChanges = document.getElementById(
			'fotogrids-unsaved-changes'
		);
		if (unsavedChanges) {
			unsavedChanges.style.display = shouldShow ? 'block' : 'none';
		}

		const updateButton = document.getElementById('publish');
		const saveButton = document.getElementById('save-post');
		if (updateButton) {
			updateButton.classList.toggle('fotogrids-has-changes', shouldShow);
		}
		if (saveButton) {
			saveButton.classList.toggle('fotogrids-has-changes', shouldShow);
		}
	}

	function showUnsavedChanges(source) {
		if (State) {
			State.unsavedChanges.markChanged(source);
		}
	}

	function hideUnsavedChanges() {
		if (State) {
			State.unsavedChanges.clear();
			State.items.save();
		}
	}

	function initFormChangeTracking() {
		const form = document.getElementById('post');
		if (!form || !State) return;

		let initialFormState = {};
		const updateInitialState = () => {
			const formData = new FormData(form);
			initialFormState = {};
			for (const [key, value] of formData.entries()) {
				if (
					key.startsWith('fotogrids_') ||
					key === 'post_title' ||
					key === 'content'
				) {
					initialFormState[key] = value;
				}
			}
		};
		updateInitialState();

		const handleFormChange = () => {
			showUnsavedChanges('form');
			if (State.autosave.enabled) {
				State.autosave.trigger(() => saveCollectionAjax());
			}
		};

		const handleNativeFormChange = (e) => {
			const target = e.target;
			const name = target.getAttribute('name') || '';

			if (name.startsWith('fotogrids_') || name === 'post_title') {
				handleFormChange();
			}
		};

		form.addEventListener('change', handleNativeFormChange);
		form.addEventListener('input', handleNativeFormChange);

		document.addEventListener(
			'fotogrids:setting_changed',
			handleFormChange
		);

		document.addEventListener('fotogrids:collection_saved', () => {
			updateInitialState();
		});
	}

	function initBeforeUnloadWarning() {
		window.addEventListener('beforeunload', (e) => {
			if (
				State &&
				State.unsavedChanges.has() &&
				!State.autosave.enabled
			) {
				e.preventDefault();
				e.returnValue = strings.unsavedChangesConfirm;
				return strings.unsavedChangesConfirm;
			}
		});
	}

	window.FotoGridsAjaxSave = {
		save: saveCollectionAjax,
		showUnsavedChanges,
		hideUnsavedChanges,
		updateLastSavedTime,
	};
})();
