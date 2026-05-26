/**
 * UploadArea - presentational template for drag-and-drop upload zones.
 *
 * Pure visual component with zero fetch logic. Renders the dashed drop zone,
 * folder + plus icon, progress bar, and error slot. All state and network
 * logic lives in the consumer (MediaUpload or FileUpload).
 *
 * Consumers own:
 *  - isDragging / isUploading / uploadProgress / error state
 *  - The hidden <input ref> (passed in so the consumer can trigger clicks)
 *  - The onFiles callback (called with a FileList on drop or input change)
 *
 * @param {Object}       props
 * @param {boolean}      [props.isDragging]       Drop zone is active.
 * @param {boolean}      [props.isUploading]      Upload in progress.
 * @param {number}       [props.uploadProgress]   0–100.
 * @param {string|null}  [props.error]            Error message to display.
 * @param {string}       [props.title]            Main label, e.g. "Select files to upload".
 * @param {string}       [props.subtitle]         Secondary label, e.g. "or drag and drop files here".
 * @param {string}       [props.hint]             Small muted line, e.g. "Supported: .json, .xml".
 * @param {string}       [props.accept]           Passed to <input accept>.
 * @param {boolean}      [props.multiple]         Allow multiple files.
 * @param {Function}     props.onFiles            Called with FileList on drop or input change.
 * @param {Function}     [props.onDragChange]     Called with true/false as drag state changes.
 * @param {Object}       props.inputRef           React ref for the hidden file input.
 * @param {string}       [props.inputId]          HTML id for the hidden input.
 */
import React from 'react';

const { __ } = wp.i18n;

const UploadArea = ({
    isDragging = false,
    isUploading = false,
    uploadProgress = 0,
    error = null,
    title,
    subtitle,
    hint,
    accept,
    multiple = true,
    onFiles,
    onDragChange,
    inputRef,
    inputId = 'fotogrids-upload-input',
}) => {
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragChange?.(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragChange?.(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDragChange?.(false);
        if (onFiles && e.dataTransfer.files.length > 0) {
            onFiles(e.dataTransfer.files);
        }
    };

    const handleInputChange = (e) => {
        if (onFiles && e.target.files.length > 0) {
            onFiles(e.target.files);
            e.target.value = '';
        }
    };

    const handleClick = () => {
        if (inputRef?.current && !isUploading) {
            inputRef.current.click();
        }
    };

    const zoneClass = [
        'fotogrids-upload-area',
        isDragging  ? 'fotogrids-upload-area--dragging'  : '',
        isUploading ? 'fotogrids-upload-area--uploading' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className="fotogrids-upload-area-wrapper">
            <div
                className={zoneClass}
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleClick}
                style={{ cursor: isUploading ? 'not-allowed' : 'pointer' }}
            >
                <input
                    ref={inputRef}
                    id={inputId}
                    type="file"
                    multiple={multiple}
                    accept={accept}
                    style={{ display: 'none' }}
                    onChange={handleInputChange}
                />

                {isUploading ? (
                    <div className="fotogrids-upload-area__progress">
                        <div className="fotogrids-upload-area__progress-bar">
                            <div
                                className="fotogrids-upload-area__progress-fill"
                                style={{ width: `${uploadProgress}%` }}
                            />
                        </div>
                        <p>{__('Uploading…', 'fotogrids')} {uploadProgress}%</p>
                    </div>
                ) : (
                    <>
                        <div className="fotogrids-upload-area__icon">
                            <div
                                className="fotogrids-upload-area__icon-folder"
                                dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.folder }}
                            />
                            <div
                                className="fotogrids-upload-area__icon-plus"
                                dangerouslySetInnerHTML={{ __html: window.FotoGridsIcons?.plus }}
                            />
                        </div>
                        {title    && <h4>{title}</h4>}
                        {subtitle && <p>{subtitle}</p>}
                        {hint     && <p className="fotogrids-upload-area__hint">{hint}</p>}
                    </>
                )}
            </div>

            {error && (
                <div className="fotogrids-upload-area__error notice notice-error">
                    <p>{error}</p>
                </div>
            )}
        </div>
    );
};

export default UploadArea;
