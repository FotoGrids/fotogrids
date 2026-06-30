import React from 'react';

const FormField = ({
    label,
    htmlFor,
    description,
    error,
    required = false,
    layout = 'row',
    className = '',
    children,
    ...rest
}) => {
    const classes = [
        'fg-form-field',
        `fg-form-field--layout-${ layout }`,
        error && 'fg-form-field--has-error',
        required && 'fg-form-field--required',
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={ classes } { ...rest }>
            { label !== undefined && (
                <label className="fg-form-field__label" htmlFor={ htmlFor }>
                    { label }
                    { required && <span className="fg-form-field__required" aria-hidden="true">*</span> }
                </label>
            ) }
            <div className="fg-form-field__control">
                { children }
            </div>
            { error ? (
                <p className="fg-form-field__error" role="alert">{ error }</p>
            ) : description ? (
                <p className="fg-form-field__description">{ description }</p>
            ) : null }
        </div>
    );
};

export default FormField;
