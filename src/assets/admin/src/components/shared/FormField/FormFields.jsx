import React from 'react';

const FormFields = ({ className = '', children, ...rest }) => (
    <div className={ `fg-form-fields ${ className }`.trim() } { ...rest }>
        { children }
    </div>
);

export default FormFields;
