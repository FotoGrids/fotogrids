export { default as Modal }       from './Modal';
export { default as Confirm }     from './wrappers/Confirm';
export { default as Prompt }      from './wrappers/Prompt';
export { default as Alert }       from './wrappers/Alert';

export { default as ModalRoot }   from './api/ModalRoot';
export { modalRegistry }          from './api/modalRegistry';
export { installPublicApi }       from './api/publicApi';
export { emit, on, off }          from './api/events';

export { useModal }                       from './hooks/useModal';
export { useModalContext, ModalContext }  from './hooks/useModalContext';
