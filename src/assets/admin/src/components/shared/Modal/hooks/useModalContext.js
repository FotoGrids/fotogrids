import { createContext, useContext } from 'react';

export const ModalContext = createContext(null);

export const useModalContext = () => {
	const ctx = useContext(ModalContext);
	if (!ctx && process.env.NODE_ENV !== 'production') {
		console.warn('[Modal] Modal sub-component used outside <Modal>.');
	}
	return ctx;
};
