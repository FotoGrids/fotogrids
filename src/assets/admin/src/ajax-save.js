/**
 * FotoGrids AJAX Save Functionality
 * 
 * Handles asynchronous saving of gallery data to prevent page reloads
 */

(function($) {
    'use strict';

    // Initialize when DOM is ready
    $(document).ready(function() {
        initAjaxSave();
    });

    function initAjaxSave() {
        // Only initialize on gallery edit pages
        if (!$('body').hasClass('post-type-fotogrids_gallery') || !$('#post').length) {
            return;
        }

        // Add save status container
        addSaveStatusContainer();
        
        // Intercept form submission
        interceptFormSubmission();
        
        // Add quick save functionality
        addQuickSaveButton();
    }

    function addSaveStatusContainer() {
        // Add save status container after the submit box
        const submitBox = $('#submitdiv .inside');
        if (submitBox.length) {
            submitBox.append(`
                <div id="fotogrids-save-status" class="fotogrids-save-status" style="display: none;">
                    <div class="fotogrids-save-message"></div>
                    <div class="fotogrids-save-spinner">
                        <span class="spinner"></span>
                    </div>
                </div>
                <div id="fotogrids-unsaved-changes" class="fotogrids-unsaved-changes" style="display: none;">
                    <div class="fotogrids-unsaved-message">
                        <span class="dashicons dashicons-warning"></span>
                        You have unsaved changes
                    </div>
                </div>
            `);
        }
    }

    function interceptFormSubmission() {
        const $form = $('#post');
        const $publishButton = $('#publish, #save-post');
        
        // Intercept publish/update button clicks
        $publishButton.on('click', function(e) {
            // Only intercept if this is an update (not initial publish)
            const action = $('#original_post_status').val();
            if (action && action !== 'auto-draft') {
                e.preventDefault();
                e.stopImmediatePropagation();
                saveGalleryAjax();
                return false;
            }
        });

        // Intercept form submission
        $form.on('submit', function(e) {
            // Only intercept if this is an update (not initial publish)
            const action = $('#original_post_status').val();
            if (action && action !== 'auto-draft') {
                e.preventDefault();
                saveGalleryAjax();
                return false;
            }
        });

        // Handle keyboard shortcuts (Ctrl+S / Cmd+S)
        $(document).on('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.which === 83) { // Ctrl+S or Cmd+S
                e.preventDefault();
                saveGalleryAjax();
                return false;
            }
        });
    }

    function addQuickSaveButton() {
        // Add a quick save button to the admin bar if it exists
        const $adminBar = $('#wp-admin-bar-root-default');
        if ($adminBar.length) {
            $adminBar.append(`
                <li id="wp-admin-bar-fotogrids-quick-save">
                    <a class="ab-item" href="#" id="fotogrids-quick-save" title="Quick Save Gallery (Ctrl+S)">
                        <span class="ab-icon dashicons dashicons-yes-alt"></span>
                        <span class="ab-label">Quick Save</span>
                    </a>
                </li>
            `);

            $('#fotogrids-quick-save').on('click', function(e) {
                e.preventDefault();
                saveGalleryAjax();
            });
        }
    }

    function saveGalleryAjax() {
        const $form = $('#post');
        const $statusContainer = $('#fotogrids-save-status');
        const $messageContainer = $('.fotogrids-save-message');
        const $spinner = $('.fotogrids-save-spinner');
        
        // Show loading state
        showSaveStatus('loading', 'Saving gallery...');
        
        // Disable form elements during save
        $form.find('input, textarea, select, button').prop('disabled', true);
        
        // Collect basic form data
        const formData = new FormData($form[0]);
        formData.append('action', 'fotogrids_save_gallery');
        formData.append('nonce', $('#fotogrids_meta_box_nonce').val());
        formData.append('post_id', $('#post_ID').val());

        // Manually collect all gallery settings from hidden inputs
        const gallerySettings = {};
        $('input[name^="fotogrids_"]').each(function() {
            const name = $(this).attr('name');
            const value = $(this).val();
            if (name && value !== '') {
                gallerySettings[name] = value;
                formData.append(name, value);
            }
        });

        // Debug: Log all form fields being sent
        const formFields = {};
        for (let [key, value] of formData.entries()) {
            if (key.startsWith('fotogrids_')) {
                formFields[key] = value;
            }
        }
        
        // Debug logging
        console.log('FotoGrids AJAX Save: Sending request', {
            action: 'fotogrids_save_gallery',
            nonce: $('#fotogrids_meta_box_nonce').val(),
            post_id: $('#post_ID').val(),
            post_title: $('#title').val(),
            fotogrids_fields: formFields
        });

        // Perform AJAX request
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            timeout: 30000, // 30 second timeout
            success: function(response) {
                if (response.success) {
                    handleSaveSuccess(response.data);
                } else {
                    handleSaveError(response.data ? response.data.message : 'Unknown error occurred');
                }
            },
            error: function(xhr, status, error) {
                let errorMessage = 'Save failed. ';
                if (status === 'timeout') {
                    errorMessage += 'Request timed out.';
                } else if (xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message) {
                    errorMessage += xhr.responseJSON.data.message;
                } else {
                    errorMessage += error || 'Please try again.';
                }
                handleSaveError(errorMessage);
            },
            complete: function() {
                // Re-enable form elements
                $form.find('input, textarea, select, button').prop('disabled', false);
            }
        });
    }

    function handleSaveSuccess(data) {
        // Update the page title if it changed
        if (data.post_title) {
            document.title = data.post_title + ' ‹ ' + document.title.split(' ‹ ').slice(1).join(' ‹ ');
            $('.wrap h1').first().text('Edit Gallery: ' + data.post_title);
        }

        // Update the permalink if this was a new post
        if (data.redirect_url) {
            const currentUrl = window.location.href;
            const newUrl = data.redirect_url;
            if (currentUrl !== newUrl && !currentUrl.includes('post=' + data.post_id)) {
                // Update URL without reload for new posts
                window.history.replaceState({}, '', newUrl);
            }
        }

        // Hide unsaved changes indicator
        hideUnsavedChanges();

        // Show success message
        showSaveStatus('success', data.message || 'Gallery saved successfully!');
        
        // Update last saved time
        updateLastSavedTime();
        
        // Trigger custom event for other scripts
        $(document).trigger('fotogrids:gallery_saved', [data]);
    }

    function handleSaveError(message) {
        showSaveStatus('error', message || 'Save failed. Please try again.');
        
        // Trigger custom event for other scripts
        $(document).trigger('fotogrids:gallery_save_error', [message]);
    }

    function showSaveStatus(type, message) {
        const $statusContainer = $('#fotogrids-save-status');
        const $messageContainer = $('.fotogrids-save-message');
        const $spinner = $('.fotogrids-save-spinner');
        
        // Remove previous status classes
        $statusContainer.removeClass('loading success error');
        
        // Add current status class
        $statusContainer.addClass(type);
        
        // Update message
        $messageContainer.text(message);
        
        // Show/hide spinner
        if (type === 'loading') {
            $spinner.show();
        } else {
            $spinner.hide();
        }
        
        // Show status container
        $statusContainer.show();
        
        // Auto-hide success/error messages after 5 seconds
        if (type !== 'loading') {
            setTimeout(function() {
                $statusContainer.fadeOut();
            }, 5000);
        }
    }

    function updateLastSavedTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        
        // Update or add last saved indicator
        let $lastSaved = $('#fotogrids-last-saved');
        if (!$lastSaved.length) {
            $('#submitdiv .inside').append('<div id="fotogrids-last-saved" class="fotogrids-last-saved"></div>');
            $lastSaved = $('#fotogrids-last-saved');
        }
        
        $lastSaved.html(`<small><em>Last saved: ${timeString}</em></small>`);
    }

    function showUnsavedChanges() {
        $('#fotogrids-unsaved-changes').fadeIn();
        
        // Add visual indicator to Update button
        const $updateButton = $('#publish, #save-post');
        $updateButton.addClass('fotogrids-has-changes');
    }
    
    function hideUnsavedChanges() {
        $('#fotogrids-unsaved-changes').fadeOut();
        
        // Remove visual indicator from Update button
        const $updateButton = $('#publish, #save-post');
        $updateButton.removeClass('fotogrids-has-changes');
    }

    // Expose functions for external use
    window.FotoGridsAjaxSave = {
        save: saveGalleryAjax,
        showStatus: showSaveStatus,
        showUnsavedChanges: showUnsavedChanges,
        hideUnsavedChanges: hideUnsavedChanges
    };

})(jQuery);
