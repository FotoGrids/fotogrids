/**
 * FileUpload - reads a local file with FileReader and returns its text content.
 *
 * No network calls. Intended for import file selection (e.g. .json / .xml
 * FotoGrids export files). Renders via the UploadArea visual template.
 *
 * Calls onFileReady({ name, size, text }) when the file has been read
 * successfully. Calls onFileError(message) on read failure.
 *
 * @param {Function} props.onFileReady          Called with { name, size, text }.
 * @param {string}   [props.accept]             File input accept attr, e.g. ".json,.xml".
 * @param {string}   [props.title]              Upload zone title text.
 * @param {string}   [props.subtitle]           Upload zone subtitle text.
 * @param {string}   [props.hint]               Upload zone hint text (muted, small).
 * @param {string}   [props.inputId]            HTML id for the hidden file input.
 */
import React, { useState, useRef } from 'react';
import UploadArea from './UploadArea';

const { __ } = wp.i18n;

const FileUpload = ({
    onFileReady,
    accept,
    title    = __('Select file to import', 'fotogrids'),
    subtitle = __('or drag and drop your file here', 'fotogrids'),
    hint,
    inputId  = 'fotogrids-file-upload-input',
}) => {
    const [isDragging, setIsDragging]   = useState(false);
    const [isReading, setIsReading]     = useState(false);
    const [error, setError]             = useState(null);
    const inputRef = useRef(null);

    const handleFiles = (fileList) => {
        const file = fileList[0];
        if (!file) return;

        setIsReading(true);
        setError(null);

        const reader = new FileReader();

        reader.onload = (e) => {
            setIsReading(false);
            if (onFileReady) {
                onFileReady({
                    name: file.name,
                    size: file.size,
                    text: e.target.result,
                });
            }
        };

        reader.onerror = () => {
            setIsReading(false);
            setError(__('Could not read the file. Please try again.', 'fotogrids'));
        };

        reader.readAsText(file);
    };

    return (
        <UploadArea
            isDragging={isDragging}
            isUploading={isReading}
            uploadProgress={isReading ? 50 : 0}
            error={error}
            title={title}
            subtitle={subtitle}
            hint={hint}
            accept={accept}
            multiple={false}
            onFiles={handleFiles}
            onDragChange={setIsDragging}
            inputRef={inputRef}
            inputId={inputId}
        />
    );
};

export default FileUpload;
