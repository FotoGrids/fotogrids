/**
 * FotoGrids Admin Meta Boxes JavaScript
 */

(function($) {
    'use strict';
    
    // Debug logging
    console.log('FotoGrids Gallery Manager Script Loading...');
    console.log('jQuery available:', typeof jQuery !== 'undefined');
    console.log('wp object available:', typeof wp !== 'undefined');
    console.log('wp.media available:', typeof wp !== 'undefined' && typeof wp.media !== 'undefined');
    console.log('Button exists:', document.getElementById('fotogrids-add-images') !== null);
    
    $(document).ready(function() {
        console.log('jQuery ready fired');
        console.log('Looking for button with ID: fotogrids-add-images');
        var button = $('#fotogrids-add-images');
        console.log('Button found:', button.length > 0);
        console.log('Button element:', button[0]);
        
        if (button.length === 0) {
            console.error('Add Images button not found in DOM!');
            return;
        }
        
        // Initialize icons
        initializeIcons();
        
        // Initialize gallery manager
        initGalleryManager();
        
        // Initialize sortable if available
        if ($.fn.sortable) {
            initSortableImages();
        }
        
        // Initialize image interactions
        initImageInteractions();
    });
    
    function initGalleryManager() {
        // Add Images button click handler
        $('#fotogrids-add-images').on('click', function(e) {
            e.preventDefault();
            
            console.log('=== Add Images Button Clicked ===');
            console.log('Event object:', e);
            console.log('Button element:', this);
            console.log('jQuery version:', $.fn.jquery);
            console.log('wp.media available:', typeof wp !== 'undefined' && typeof wp.media !== 'undefined');
            
            if (typeof wp === 'undefined' || typeof wp.media === 'undefined') {
                alert(fotogridsMetaBoxes.strings.mediaNotAvailable || 'WordPress media library is not available. Please refresh the page.');
                return;
            }
            
            openMediaUploader();
        });
        
        // Remove image button handler
        $(document).on('click', '.fotogrids-remove-image', function(e) {
            e.preventDefault();
            $(this).closest('.fotogrids-image-item').remove();
            
            if ($('#fotogrids-images-grid .fotogrids-image-item').length === 0) {
                $('#fotogrids-images-container').html('<p class="description">' + (fotogridsMetaBoxes.strings.noImages || 'No images selected. Click "Add Images" to get started.') + '</p>');
            }
        });
        
        // Clear all images button handler
        $('#fotogrids-clear-images').on('click', function(e) {
            e.preventDefault();
            if (confirm(fotogridsMetaBoxes.strings.confirmClear || 'Are you sure you want to remove all images?')) {
                $('#fotogrids-images-container').html('<p class="description">' + (fotogridsMetaBoxes.strings.noImages || 'No images selected. Click "Add Images" to get started.') + '</p>');
            }
        });
        
        // Edit image button handler
        $(document).on('click', '.fotogrids-edit-image', function(e) {
            e.preventDefault();
            var imageId = $(this).data('id');
            openImageEditModal(imageId);
        });
        
        // Modal close handlers
        $(document).on('click', '.fotogrids-modal-close', function() {
            $('#fotogrids-image-edit-modal').fadeOut(function() {
                $(this).remove();
            });
        });
        
        // Save image metadata handler
        $(document).on('click', '#fotogrids-save-image-meta', function() {
            saveImageMetadata($(this).data('id'));
        });
    }
    
    function openMediaUploader() {
        console.log('Opening media uploader...');
        
        var mediaUploader = wp.media({
            title: fotogridsMetaBoxes.strings.selectImages || 'Select Images for Gallery',
            button: { text: fotogridsMetaBoxes.strings.addToGallery || 'Add to Gallery' },
            multiple: true,
            library: { type: 'image' }
        });
        
        mediaUploader.on('select', function() {
            console.log('Images selected from media uploader');
            var attachments = mediaUploader.state().get('selection').toJSON();
            console.log('Selected attachments:', attachments);
            
            var container = $('#fotogrids-images-container');
            var grid = $('#fotogrids-images-grid');
            
            if (grid.length === 0) {
                container.html('<div id="fotogrids-images-grid" class="fotogrids-sortable"></div>');
                grid = $('#fotogrids-images-grid');
            }
            
            $.each(attachments, function(index, attachment) {
                if (grid.find('[data-id="' + attachment.id + '"]').length === 0) {
                    addImageToGrid(attachment, grid);
                }
            });
            
            container.find('.description').hide();
            
            // Reinitialize sortable and interactions
            reinitializeSortable();
        });
        
        console.log('About to open media uploader...');
        mediaUploader.open();
    }
    
    function addImageToGrid(attachment, grid) {
        var imageTitle = attachment.title || attachment.filename || 'Untitled';
        var thumbnailUrl = attachment.sizes && attachment.sizes.thumbnail ? attachment.sizes.thumbnail.url : attachment.url;
        
        var imageHtml = '<div class="fotogrids-image-item" data-id="' + attachment.id + '">' +
            '<img src="' + thumbnailUrl + '" alt="' + (attachment.alt || attachment.title || '') + '" />' +
            '<div class="fotogrids-image-controls">' +
                '<button type="button" class="fotogrids-edit-image" data-id="' + attachment.id + '" title="' + (fotogridsMetaBoxes.strings.editImage || 'Edit Image') + '">' +
                    '<span class="fotogrids-icon" data-icon="edit"></span>' +
                '</button>' +
                '<button type="button" class="fotogrids-remove-image" data-id="' + attachment.id + '" title="' + (fotogridsMetaBoxes.strings.removeImage || 'Remove Image') + '">' +
                    '<span class="fotogrids-icon" data-icon="x"></span>' +
                '</button>' +
            '</div>' +
            '<div class="fotogrids-image-title">' + (imageTitle.length > 20 ? imageTitle.substring(0, 20) + '...' : imageTitle) + '</div>' +
            '<input type="hidden" name="fotogrids_gallery_images[]" value="' + attachment.id + '" />' +
        '</div>';
        
        grid.append(imageHtml);
        
        // Initialize icons for the newly added image
        initializeIcons();
    }
    
    function openImageEditModal(imageId) {
        console.log('Opening image edit modal for ID:', imageId);
        
        // Show loading state
        var loadingHtml = '<div id="fotogrids-image-edit-modal" class="fotogrids-modal">' +
            '<div class="fotogrids-modal-content">' +
                '<div class="fotogrids-loading">' + (fotogridsMetaBoxes.strings.loading || 'Loading...') + '</div>' +
            '</div>' +
        '</div>';
        
        $('body').append(loadingHtml);
        $('#fotogrids-image-edit-modal').fadeIn();
        
        // Get image data via AJAX
        $.post(fotogridsMetaBoxes.ajaxUrl, {
            action: 'fotogrids_get_image_data',
            image_id: imageId,
            nonce: fotogridsMetaBoxes.nonce
        }, function(response) {
            if (response.success) {
                renderImageEditModal(response.data, imageId);
            } else {
                alert(fotogridsMetaBoxes.strings.errorLoadingImage || 'Error loading image data');
                $('#fotogrids-image-edit-modal').remove();
            }
        }).fail(function() {
            alert(fotogridsMetaBoxes.strings.errorLoadingImage || 'Error loading image data');
            $('#fotogrids-image-edit-modal').remove();
        });
    }
    
    function renderImageEditModal(data, imageId) {
        // Get all image IDs from the gallery grid for navigation
        var allImageIds = [];
        $('#fotogrids-images-grid .fotogrids-image-item').each(function() {
            allImageIds.push(parseInt($(this).data('id')));
        });
        
        var currentIndex = allImageIds.indexOf(parseInt(imageId));
        
        // Calculate next/prev image IDs with circular navigation
        var prevImageId, nextImageId;
        if (allImageIds.length === 1) {
            // If only one image, both arrows point to the same image
            prevImageId = nextImageId = allImageIds[0];
        } else {
            prevImageId = currentIndex > 0 ? allImageIds[currentIndex - 1] : allImageIds[allImageIds.length - 1];
            nextImageId = currentIndex < allImageIds.length - 1 ? allImageIds[currentIndex + 1] : allImageIds[0];
        }
        
        var modalHtml = '<div class="fotogrids-modal-content">' +
            '<div class="fotogrids-modal-header">' +
                '<h3>' + (fotogridsMetaBoxes.strings.editImage || 'Edit Image') + '</h3>' +
                '<button type="button" class="fotogrids-modal-close">×</button>' +
            '</div>' +
            '<div class="fotogrids-modal-body">' +
                '<div class="fotogrids-modal-layout">' +
                    // Left side - Image preview (without navigation arrows)
                    '<div class="fotogrids-modal-left">' +
                        '<div class="fotogrids-image-preview">' +
                            '<img src="' + data.medium_url + '" alt="' + (data.alt || '') + '" />' +
                        '</div>' +
                    '</div>' +
                    // Right side - Tabs and content
                    '<div class="fotogrids-modal-right">' +
                        '<div class="fotogrids-modal-tabs">' +
                            '<button type="button" class="fotogrids-tab-button active" data-tab="details">' + (fotogridsMetaBoxes.strings.details || 'Details') + '</button>' +
                            '<button type="button" class="fotogrids-tab-button" data-tab="tags">' + (fotogridsMetaBoxes.strings.tags || 'Tags') + '</button>' +
                            '<button type="button" class="fotogrids-tab-button" data-tab="people">' + (fotogridsMetaBoxes.strings.people || 'People') + '</button>' +
                            '<button type="button" class="fotogrids-tab-button" data-tab="location">' + (fotogridsMetaBoxes.strings.location || 'Location') + '</button>' +
                            '<button type="button" class="fotogrids-tab-button" data-tab="seo">' + 
                                (fotogridsMetaBoxes.strings.seo || 'SEO') + 
                                '<span class="fotogrids-pro-badge">Pro</span>' +
                            '</button>' +
                            '<button type="button" class="fotogrids-tab-button" data-tab="advanced">' + (fotogridsMetaBoxes.strings.advanced || 'Advanced') + '</button>' +
                        '</div>' +
                        '<div class="fotogrids-tab-content">' +
                            // Details tab content
                            '<div class="fotogrids-tab-panel active" data-tab="details">' +
                                '<table class="form-table">' +
                                    '<tr>' +
                                        '<th><label for="fotogrids-image-title">' + (fotogridsMetaBoxes.strings.title || 'Title') + '</label></th>' +
                                        '<td><input type="text" id="fotogrids-image-title" value="' + (data.title || '') + '" /></td>' +
                                    '</tr>' +
                                    '<tr>' +
                                        '<th><label for="fotogrids-image-alt">' + (fotogridsMetaBoxes.strings.altText || 'Alt Text') + '</label></th>' +
                                        '<td><input type="text" id="fotogrids-image-alt" value="' + (data.alt || '') + '" /></td>' +
                                    '</tr>' +
                                    '<tr>' +
                                        '<th><label for="fotogrids-image-caption">' + (fotogridsMetaBoxes.strings.caption || 'Caption') + '</label></th>' +
                                        '<td><textarea id="fotogrids-image-caption" rows="3">' + (data.caption || '') + '</textarea></td>' +
                                    '</tr>' +
                                    '<tr>' +
                                        '<th><label for="fotogrids-image-description">' + (fotogridsMetaBoxes.strings.description || 'Description') + '</label></th>' +
                                        '<td><textarea id="fotogrids-image-description" rows="4">' + (data.description || '') + '</textarea></td>' +
                                    '</tr>' +
                                '</table>' +
                            '</div>' +
                            // Tags tab content
                            '<div class="fotogrids-tab-panel" data-tab="tags">' +
                                '<div class="fotogrids-tags-section">' +
                                    '<h4>Image Tags</h4>' +
                                    '<div class="fotogrids-tags-input">' +
                                        '<input type="text" id="fotogrids-tags-input" placeholder="Add tags..." />' +
                                        '<button type="button" class="button" id="fotogrids-add-tag">Add Tag</button>' +
                                    '</div>' +
                                    '<div class="fotogrids-tags-list" id="fotogrids-tags-list">' +
                                        // Tags will be populated here
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                            // People tab content
                            '<div class="fotogrids-tab-panel" data-tab="people">' +
                                '<div class="fotogrids-people-section">' +
                                    '<h4>People in Image</h4>' +
                                    '<div class="fotogrids-people-input">' +
                                        '<input type="text" id="fotogrids-people-name" placeholder="Person name..." />' +
                                        '<input type="text" id="fotogrids-people-details" placeholder="Additional details..." />' +
                                        '<button type="button" class="button" id="fotogrids-add-person">Add Person</button>' +
                                    '</div>' +
                                    '<div class="fotogrids-people-list" id="fotogrids-people-list">' +
                                        // People will be populated here
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                            // Location tab content
                            '<div class="fotogrids-tab-panel" data-tab="location">' +
                                '<div class="fotogrids-location-section">' +
                                    '<h4>Location</h4>' +
                                    '<div class="fotogrids-location-input">' +
                                        '<input type="text" id="fotogrids-location-text" placeholder="Enter location..." value="' + (data.location || '') + '" />' +
                                        '<p class="description">Enter the location where this image was taken.</p>' +
                                    '</div>' +
                                '</div>' +
                            '</div>' +
                            // SEO tab content (Pro)
                            '<div class="fotogrids-tab-panel" data-tab="seo">' +
                                '<div class="fotogrids-pro-content">' +
                                    '<h4>SEO Settings <span class="fotogrids-pro-badge">Pro</span></h4>' +
                                    '<p class="description">SEO features are available in the Pro version.</p>' +
                                '</div>' +
                            '</div>' +
                            // Advanced tab content
                            '<div class="fotogrids-tab-panel" data-tab="advanced">' +
                                '<div class="fotogrids-advanced-section">' +
                                    '<h4>Advanced Settings</h4>' +
                                    '<p class="description">Advanced settings will be available here.</p>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="fotogrids-modal-footer">' +
                '<button type="button" class="button button-primary" id="fotogrids-save-image-meta" data-id="' + imageId + '">' + (fotogridsMetaBoxes.strings.saveChanges || 'Save Changes') + '</button>' +
                '<button type="button" class="button fotogrids-modal-cancel">' + (fotogridsMetaBoxes.strings.cancel || 'Cancel') + '</button>' +
            '</div>' +
        '</div>';
        
        // Add navigation arrows outside the modal only if there are multiple images
        if (allImageIds.length > 1) {
            modalHtml += '<button type="button" class="fotogrids-nav-arrow fotogrids-nav-prev" ' +
                'data-image-id="' + prevImageId + '" ' +
                'title="' + (fotogridsMetaBoxes.strings.prevImage || 'Previous image') + '">' +
                '<span class="fotogrids-icon" data-icon="chevron-left"></span>' +
            '</button>' +
            '<button type="button" class="fotogrids-nav-arrow fotogrids-nav-next" ' +
                'data-image-id="' + nextImageId + '" ' +
                'title="' + (fotogridsMetaBoxes.strings.nextImage || 'Next image') + '">' +
                '<span class="fotogrids-icon" data-icon="chevron-right"></span>' +
            '</button>';
        }
        
        $('#fotogrids-image-edit-modal').html(modalHtml);
        
        // Initialize tab functionality
        initializeModalTabs();
        
        // Initialize tag and people functionality
        initializeTagsAndPeople(data, imageId);
        
        // Initialize navigation functionality
        initializeImageNavigation();
        
        // Initialize icons (render SVG icons)
        initializeIcons();
    }
    
    function initializeImageNavigation() {
        // Handle navigation arrow clicks (no disabled state needed for circular navigation)
        $(document).off('click.fotogrids-nav').on('click.fotogrids-nav', '.fotogrids-nav-arrow', function(e) {
            e.preventDefault();
            var targetImageId = $(this).data('image-id');
            if (targetImageId) {
                // Save current changes before navigating
                var currentImageId = $('#fotogrids-save-image-meta').data('id');
                saveImageMetadataBeforeNav(currentImageId, targetImageId);
            }
        });
    }
    
    function saveImageMetadataBeforeNav(currentImageId, targetImageId) {
        var title = $('#fotogrids-image-title').val();
        var alt = $('#fotogrids-image-alt').val();
        var caption = $('#fotogrids-image-caption').val();
        var description = $('#fotogrids-image-description').val();
        var location = $('#fotogrids-location-text').val();
        
        // Collect tags
        var tags = [];
        $('#fotogrids-tags-list .fotogrids-tag-item').each(function() {
            tags.push($(this).data('value'));
        });
        
        // Collect people
        var people = [];
        $('#fotogrids-people-list .fotogrids-person-item').each(function() {
            var name = $(this).data('name');
            var details = $(this).find('.fotogrids-person-details').text();
            people.push({
                name: name,
                details: details
            });
        });
        
        // Save current image data, then load next image
        $.post(fotogridsMetaBoxes.ajaxUrl, {
            action: 'fotogrids_save_image_data',
            image_id: currentImageId,
            title: title,
            alt: alt,
            caption: caption,
            description: description,
            location: location,
            tags: JSON.stringify(tags),
            people: JSON.stringify(people),
            nonce: fotogridsMetaBoxes.nonce
        }, function(response) {
            if (response.success) {
                // Update the current image in the grid
                var imageItem = $('.fotogrids-image-item[data-id="' + currentImageId + '"]');
                var displayTitle = title.length > 20 ? title.substring(0, 20) + '...' : title;
                imageItem.find('.fotogrids-image-title').text(displayTitle);
                imageItem.find('img').attr('alt', alt);
                
                // Load the next image
                loadImageInModal(targetImageId);
            } else {
                alert(fotogridsMetaBoxes.strings.errorSaving || 'Error saving changes');
            }
        }).fail(function() {
            alert(fotogridsMetaBoxes.strings.errorSaving || 'Error saving changes');
        });
    }
    
    function loadImageInModal(imageId) {
        // Show loading state in modal
        $('.fotogrids-modal-content').addClass('loading');
        
        // Get image data via AJAX
        $.post(fotogridsMetaBoxes.ajaxUrl, {
            action: 'fotogrids_get_image_data',
            image_id: imageId,
            nonce: fotogridsMetaBoxes.nonce
        }, function(response) {
            if (response.success) {
                renderImageEditModal(response.data, imageId);
                $('.fotogrids-modal-content').removeClass('loading');
            } else {
                alert(fotogridsMetaBoxes.strings.errorLoadingImage || 'Error loading image data');
                $('.fotogrids-modal-content').removeClass('loading');
            }
        }).fail(function() {
            alert(fotogridsMetaBoxes.strings.errorLoadingImage || 'Error loading image data');
            $('.fotogrids-modal-content').removeClass('loading');
        });
    }
    
    function saveImageMetadata(imageId) {
        var title = $('#fotogrids-image-title').val();
        var alt = $('#fotogrids-image-alt').val();
        var caption = $('#fotogrids-image-caption').val();
        var description = $('#fotogrids-image-description').val();
        var location = $('#fotogrids-location-text').val();
        
        // Collect tags
        var tags = [];
        $('#fotogrids-tags-list .fotogrids-tag-item').each(function() {
            tags.push($(this).data('value'));
        });
        
        // Collect people
        var people = [];
        $('#fotogrids-people-list .fotogrids-person-item').each(function() {
            var name = $(this).data('name');
            var details = $(this).find('.fotogrids-person-details').text();
            people.push({
                name: name,
                details: details
            });
        });
        
        console.log('Saving image metadata for ID:', imageId);
        
        $.post(fotogridsMetaBoxes.ajaxUrl, {
            action: 'fotogrids_save_image_data',
            image_id: imageId,
            title: title,
            alt: alt,
            caption: caption,
            description: description,
            location: location,
            tags: JSON.stringify(tags),
            people: JSON.stringify(people),
            nonce: fotogridsMetaBoxes.nonce
        }, function(response) {
            if (response.success) {
                // Update the image title in the grid
                var imageItem = $('.fotogrids-image-item[data-id="' + imageId + '"]');
                var displayTitle = title.length > 20 ? title.substring(0, 20) + '...' : title;
                imageItem.find('.fotogrids-image-title').text(displayTitle);
                imageItem.find('img').attr('alt', alt);
                
                $('#fotogrids-image-edit-modal').fadeOut(function() {
                    $(this).remove();
                });
            } else {
                alert(fotogridsMetaBoxes.strings.errorSaving || 'Error saving image data');
            }
        }).fail(function() {
            alert(fotogridsMetaBoxes.strings.errorSaving || 'Error saving image data');
        });
    }
    
    /**
     * Initialize SVG icons from FotoGridsIcons
     */
    function initializeIcons() {
        if (typeof window.FotoGridsIcons === 'undefined') {
            console.warn('FotoGridsIcons not available');
            return;
        }
        
        // Find all icon placeholders and replace with SVG
        $('.fotogrids-icon[data-icon]').each(function() {
            var $icon = $(this);
            var iconName = $icon.data('icon');
            var iconSvg = window.FotoGridsIcons[iconName];
            
            if (iconSvg) {
                $icon.html(iconSvg);
            } else {
                console.warn('Icon not found:', iconName);
                $icon.text(iconName); // Fallback to text
            }
        });
    }
    
    /**
     * Initialize sortable images with enhanced visual feedback
     */
    function initSortableImages() {
        $('#fotogrids-images-grid').sortable({
            items: '.fotogrids-image-item',
            cursor: 'move',
            tolerance: 'pointer',
            placeholder: 'fotogrids-image-placeholder',
            forcePlaceholderSize: true,
            start: function(event, ui) {
                // Add class to indicate dragging state
                ui.item.addClass('fotogrids-dragging');
                
                // Set placeholder dimensions to match dragged item
                ui.placeholder.height(ui.item.height());
                ui.placeholder.width(ui.item.width());
            },
            stop: function(event, ui) {
                // Remove dragging state
                ui.item.removeClass('fotogrids-dragging');
            }
        });
    }
    
    /**
     * Initialize image interactions (hover, click-to-edit)
     */
    function initImageInteractions() {
        // Add hover cursor styling
        $(document).on('mouseenter', '.fotogrids-image-item', function() {
            $(this).addClass('fotogrids-image-hoverable');
        });
        
        $(document).on('mouseleave', '.fotogrids-image-item', function() {
            $(this).removeClass('fotogrids-image-hoverable');
        });
        
        // Click on image (not buttons) to open edit modal
        $(document).on('click', '.fotogrids-image-item img', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Don't trigger if currently dragging
            if ($(this).closest('.fotogrids-image-item').hasClass('fotogrids-dragging')) {
                return;
            }
            
            const imageId = $(this).closest('.fotogrids-image-item').data('id');
            const editButton = $(this).closest('.fotogrids-image-item').find('.fotogrids-edit-image');
            
            // Trigger the existing edit button functionality
            if (editButton.length) {
                editButton.trigger('click');
            }
        });
        
        // Prevent click-to-edit when clicking on control buttons
        $(document).on('click', '.fotogrids-image-controls', function(e) {
            e.stopPropagation();
        });
        
        // Prevent click-to-edit when clicking on image title
        $(document).on('click', '.fotogrids-image-title', function(e) {
            e.stopPropagation();
        });
    }
    
    /**
     * Initialize modal tab functionality
     */
    function initializeModalTabs() {
        // Tab button click handler
        $(document).on('click', '.fotogrids-tab-button', function() {
            const tabId = $(this).data('tab');
            
            // Update tab buttons
            $('.fotogrids-tab-button').removeClass('active');
            $(this).addClass('active');
            
            // Update tab panels
            $('.fotogrids-tab-panel').removeClass('active');
            $('[data-tab="' + tabId + '"]').filter('.fotogrids-tab-panel').addClass('active');
        });
        
        // Update modal close handlers to include new cancel button
        $(document).on('click', '.fotogrids-modal-cancel', function() {
            $('#fotogrids-image-edit-modal').fadeOut(function() {
                $(this).remove();
            });
        });
    }
    
    /**
     * Initialize tags and people functionality
     */
    function initializeTagsAndPeople(data, imageId) {
        // Initialize existing tags if any
        if (data.custom_data && data.custom_data.tags) {
            data.custom_data.tags.forEach(function(tag) {
                addTagToList(tag, 'tags');
            });
        }
        
        // Initialize existing people if any
        if (data.custom_data && data.custom_data.people) {
            data.custom_data.people.forEach(function(person) {
                addPersonToList(person);
            });
        }
        
        // Add tag functionality
        $(document).on('click', '#fotogrids-add-tag', function() {
            const tagInput = $('#fotogrids-tags-input');
            const tagValue = tagInput.val().trim();
            
            if (tagValue) {
                addTagToList(tagValue, 'tags');
                tagInput.val('');
            }
        });
        
        // Add tag on Enter key
        $(document).on('keypress', '#fotogrids-tags-input', function(e) {
            if (e.which === 13) { // Enter key
                $('#fotogrids-add-tag').click();
            }
        });
        
        // Add person functionality
        $(document).on('click', '#fotogrids-add-person', function() {
            const nameInput = $('#fotogrids-people-name');
            const detailsInput = $('#fotogrids-people-details');
            const name = nameInput.val().trim();
            const details = detailsInput.val().trim();
            
            if (name) {
                addPersonToList({
                    name: name,
                    details: details
                });
                nameInput.val('');
                detailsInput.val('');
            }
        });
        
        // Add person on Enter key
        $(document).on('keypress', '#fotogrids-people-name, #fotogrids-people-details', function(e) {
            if (e.which === 13) { // Enter key
                $('#fotogrids-add-person').click();
            }
        });
    }
    
    /**
     * Add a tag to the tags list
     */
    function addTagToList(tagValue, type) {
        const listId = type === 'tags' ? 'fotogrids-tags-list' : 'fotogrids-people-list';
        const tagHtml = '<span class="fotogrids-tag-item" data-value="' + tagValue + '">' +
            '<span class="fotogrids-tag-text">' + tagValue + '</span>' +
            '<button type="button" class="fotogrids-tag-remove" title="Remove">×</button>' +
        '</span>';
        
        $('#' + listId).append(tagHtml);
    }
    
    /**
     * Add a person to the people list
     */
    function addPersonToList(person) {
        const personHtml = '<div class="fotogrids-person-item" data-name="' + person.name + '">' +
            '<div class="fotogrids-person-info">' +
                '<strong class="fotogrids-person-name">' + person.name + '</strong>' +
                (person.details ? '<span class="fotogrids-person-details">' + person.details + '</span>' : '') +
            '</div>' +
            '<button type="button" class="fotogrids-person-remove" title="Remove">×</button>' +
        '</div>';
        
        $('#fotogrids-people-list').append(personHtml);
    }
    
    // Remove tag/person handlers
    $(document).on('click', '.fotogrids-tag-remove', function() {
        $(this).closest('.fotogrids-tag-item').remove();
    });
    
    $(document).on('click', '.fotogrids-person-remove', function() {
        $(this).closest('.fotogrids-person-item').remove();
    });
    
    /**
     * Reinitialize sortable after adding new images
     */
    function reinitializeSortable() {
        if ($.fn.sortable) {
            const grid = $('#fotogrids-images-grid');
            if (grid.hasClass('ui-sortable')) {
                grid.sortable('refresh');
            } else {
                initSortableImages();
            }
        }
        
        // Reinitialize image interactions for new images
        initImageInteractions();
    }
    
    /**
     * Copy to clipboard functionality
     */
    function copyToClipboard(text) {
        // Modern approach using navigator.clipboard
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(function() {
                showCopySuccess();
            }).catch(function(err) {
                console.error('Failed to copy text: ', err);
                fallbackCopyTextToClipboard(text);
            });
        } else {
            // Fallback for older browsers or non-secure contexts
            fallbackCopyTextToClipboard(text);
        }
    }
    
    /**
     * Fallback copy method for older browsers
     */
    function fallbackCopyTextToClipboard(text) {
        var textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            var successful = document.execCommand('copy');
            if (successful) {
                showCopySuccess();
            } else {
                showCopyError();
            }
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
            showCopyError();
        }
        
        document.body.removeChild(textArea);
    }
    
    /**
     * Show success message after copying
     */
    function showCopySuccess() {
        var button = $('.fotogrids-copy-shortcode');
        var originalText = button.text();
        button.text(fotogridsMetaBoxes.strings.copied || 'Copied!').addClass('copied');
        
        setTimeout(function() {
            button.text(originalText).removeClass('copied');
        }, 2000);
    }
    
    /**
     * Show error message if copying fails
     */
    function showCopyError() {
        var button = $('.fotogrids-copy-shortcode');
        var originalText = button.text();
        button.text(fotogridsMetaBoxes.strings.copyFailed || 'Copy failed').addClass('copy-error');
        
        setTimeout(function() {
            button.text(originalText).removeClass('copy-error');
        }, 2000);
    }
    
    // Copy shortcode button handler
    $(document).on('click', '.fotogrids-copy-shortcode', function(e) {
        e.preventDefault();
        var shortcode = $(this).data('shortcode');
        if (shortcode) {
            copyToClipboard(shortcode);
        }
    });
    
})(jQuery);
