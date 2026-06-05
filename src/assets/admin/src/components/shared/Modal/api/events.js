const PREFIX = 'fotogrids:admin:modal:';

export const emit = (name, detail = {}) => {
    if (typeof document === 'undefined') return;
    const event = new CustomEvent(`${ PREFIX }${ name }`, { detail, bubbles: true });
    document.dispatchEvent(event);
};

export const on = (name, handler) => {
    if (typeof document === 'undefined') return () => {};
    const full = `${ PREFIX }${ name }`;
    document.addEventListener(full, handler);
    return () => document.removeEventListener(full, handler);
};

export const off = (name, handler) => {
    if (typeof document === 'undefined') return;
    document.removeEventListener(`${ PREFIX }${ name }`, handler);
};
