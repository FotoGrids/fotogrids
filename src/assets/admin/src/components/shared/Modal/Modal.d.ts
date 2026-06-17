/**
 * FotoGrids Admin Modal - public API types.
 *
 * Pro and 3rd-party plugins consume the modal system either through
 * `window.FotoGridsAdmin.modal` (imperative) or by importing the React
 * components from this module. These types describe the stable public
 * contract - treat changes here as breaking.
 */

import type { ComponentType, ReactNode, MutableRefObject } from 'react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'cover' | 'full';

export type ConfirmVariant =
	| 'info'
	| 'question'
	| 'warning'
	| 'danger'
	| 'success';

export type ModalCloseReason =
	| 'overlay'
	| 'esc'
	| 'close-button'
	| 'confirm'
	| 'cancel'
	| 'programmatic';

interface ModalCommonOptions {
	title?: string;
	message?: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	busy?: boolean;
	onClose?: (reason: ModalCloseReason) => void;
}

export interface ConfirmOptions extends ModalCommonOptions {
	type?: 'confirm';
	variant?: ConfirmVariant;
	requireText?: string | null;
	onConfirm?: () => void | Promise<void>;
}

export interface PromptOptions extends ModalCommonOptions {
	type?: 'prompt';
	variant?: ConfirmVariant;
	inputLabel?: string;
	inputPlaceholder?: string;
	initialValue?: string;
	required?: boolean;
	submitLabel?: string;
	onSubmit?: (value: string) => void | Promise<void>;
}

export interface AlertOptions extends ModalCommonOptions {
	type?: 'alert';
	variant?: ConfirmVariant;
}

export interface CustomModalOptions {
	type: 'custom';
	size?: ModalSize;
	hasSidebar?: boolean;
	sidebarCollapsible?: boolean;
	closeOnOverlay?: boolean;
	closeOnEsc?: boolean;
	preventClose?: boolean;
	className?: string;
	render?: (ctx: { close: () => void }) => ReactNode;
	children?: ReactNode;
	onClose?: (reason: ModalCloseReason) => void;
}

export type ModalOpenOptions =
	| ConfirmOptions
	| PromptOptions
	| AlertOptions
	| CustomModalOptions;

export interface ModalHandle {
	id: string;
	close: (reason?: ModalCloseReason) => void;
	update: (next: Partial<ModalOpenOptions>) => void;
}

export interface ModalOpenedEvent {
	id: string;
	type?: string;
	size?: ModalSize;
}

export interface ModalClosedEvent {
	id: string;
	type?: string;
	reason: ModalCloseReason;
}

export interface ModalConfirmedEvent {
	id: string | null;
	type: string;
	variant?: ConfirmVariant;
}

export interface ModalTabChangedEvent {
	modalId: string;
	fromTab: string;
	toTab: string;
}

export type ModalEventName = 'opened' | 'closed' | 'confirmed' | 'tab-changed';

export interface ModalProps {
	isOpen: boolean;
	onClose: (reason: ModalCloseReason) => void;
	size?: ModalSize;
	hasSidebar?: boolean;
	sidebarCollapsible?: boolean;
	sidebarInitiallyCollapsed?: boolean;
	closeOnOverlay?: boolean;
	closeOnEsc?: boolean;
	preventClose?: boolean;
	initialFocusRef?: MutableRefObject<HTMLElement | null> | null;
	className?: string;
	type?: string;
	children?: ReactNode;
}

export interface ModalTab {
	id: string;
	label: ReactNode;
	badge?: ReactNode;
	disabled?: boolean;
}

export interface ModalTabsProps {
	tabs: ModalTab[];
	activeId: string;
	onChange: (id: string) => void;
	disabled?: boolean;
	emitEvents?: boolean;
	className?: string;
}

export interface ModalTabsPanelProps {
	id: string;
	activeId: string;
	className?: string;
	children?: ReactNode;
}

export interface ModalSubcomponents {
	Header: ComponentType<{
		divider?: boolean;
		closeButton?: boolean;
		size?: 'sm' | 'md';
		className?: string;
		children?: ReactNode;
	}>;
	HeaderTitle: ComponentType<{
		level?: 1 | 2 | 3;
		as?: keyof JSX.IntrinsicElements;
		className?: string;
		children?: ReactNode;
	}>;
	HeaderLogo: ComponentType<{ className?: string; children?: ReactNode }>;
	HeaderActions: ComponentType<{ className?: string; children?: ReactNode }>;
	HeaderClose: ComponentType<{
		icon?: string;
		ariaLabel?: string;
		onClick?: () => void;
		className?: string;
	}>;
	Body: ComponentType<{
		padding?: boolean;
		scroll?: boolean;
		className?: string;
		children?: ReactNode;
	}>;
	Sidebar: ComponentType<{ className?: string; children?: ReactNode }>;
	Main: ComponentType<{ className?: string; children?: ReactNode }>;
	Tabs: ComponentType<ModalTabsProps>;
	TabsPanel: ComponentType<ModalTabsPanelProps>;
	Footer: ComponentType<{
		align?: 'left' | 'right' | 'between';
		divider?: boolean;
		className?: string;
		children?: ReactNode;
	}>;
	Nav: ComponentType<{
		direction: 'prev' | 'next';
		onClick?: () => void;
		disabled?: boolean;
		ariaLabel?: string;
		className?: string;
	}>;
}

export type ModalComponent = ComponentType<ModalProps> & ModalSubcomponents;

export interface ConfirmProps extends ConfirmOptions {
	isOpen: boolean;
	onClose: (reason: ModalCloseReason) => void;
	showCancel?: boolean;
	children?: ReactNode;
}

export interface PromptProps extends PromptOptions {
	isOpen: boolean;
	onClose: (reason: ModalCloseReason) => void;
}

export interface AlertProps extends AlertOptions {
	isOpen: boolean;
	onClose: (reason: ModalCloseReason) => void;
	children?: ReactNode;
}

export interface UseModalReturn {
	open: (opts: ModalOpenOptions) => ModalHandle;
	close: (id?: string | null) => void;
	closeAll: () => void;

	confirm: (opts: ConfirmOptions) => Promise<boolean>;
	prompt: (opts: PromptOptions) => Promise<string | null>;
	alert: (opts: AlertOptions) => Promise<void>;

	info: (opts: AlertOptions) => Promise<void>;
	success: (opts: AlertOptions) => Promise<void>;
	warning: (opts: ConfirmOptions) => Promise<boolean>;
	danger: (opts: ConfirmOptions) => Promise<boolean>;
	question: (opts: ConfirmOptions) => Promise<boolean>;
}

export interface ModalContextValue {
	id: string;
	titleId: string;
	requestClose: (reason: ModalCloseReason) => void;
	sidebarCollapsible: boolean;
	sidebarCollapsed: boolean;
	toggleSidebar: () => void;
	type?: string;
}

export interface FotoGridsAdminModalApi {
	open: (opts: ModalOpenOptions) => ModalHandle;
	close: (id: string) => void;
	closeAll: () => void;

	confirm: (opts: ConfirmOptions) => Promise<boolean>;
	prompt: (opts: PromptOptions) => Promise<string | null>;
	alert: (opts: AlertOptions) => Promise<void>;

	info: (opts: AlertOptions) => Promise<void>;
	success: (opts: AlertOptions) => Promise<void>;
	warning: (opts: ConfirmOptions) => Promise<boolean>;
	danger: (opts: ConfirmOptions) => Promise<boolean>;
	question: (opts: ConfirmOptions) => Promise<boolean>;

	on: <K extends ModalEventName>(
		event: K,
		handler: (e: CustomEvent) => void,
	) => () => void;
	off: <K extends ModalEventName>(
		event: K,
		handler: (e: CustomEvent) => void,
	) => void;
	emit: (event: ModalEventName, detail?: Record<string, unknown>) => void;

	hooks: {
		useModal: () => UseModalReturn;
		useModalContext: () => ModalContextValue | null;
	};
}

export interface FotoGridsAdminGlobal {
	modal?: FotoGridsAdminModalApi;
	registerMetadataType?: (registration: {
		key: string;
		serialize: (metadata: Record<string, unknown>) => unknown;
		deserialize: (data: Record<string, unknown>) => unknown;
	}) => void;
}

declare module '@fotogrids/admin/fg-modal' {
	export const Modal: ModalComponent;
	export const Confirm: ComponentType<ConfirmProps>;
	export const Prompt: ComponentType<PromptProps>;
	export const Alert: ComponentType<AlertProps>;

	export const useModal: () => UseModalReturn;
	export const useModalContext: () => ModalContextValue | null;

	export function emit(
		event: ModalEventName,
		detail?: Record<string, unknown>,
	): void;
	export function on(
		event: ModalEventName,
		handler: (e: CustomEvent) => void,
	): () => void;
	export function off(
		event: ModalEventName,
		handler: (e: CustomEvent) => void,
	): void;
}

declare global {
	interface Window {
		FotoGridsAdmin?: FotoGridsAdminGlobal;
	}

	interface DocumentEventMap {
		'fotogrids:admin:modal:opened': CustomEvent<ModalOpenedEvent>;
		'fotogrids:admin:modal:closed': CustomEvent<ModalClosedEvent>;
		'fotogrids:admin:modal:confirmed': CustomEvent<ModalConfirmedEvent>;
		'fotogrids:admin:modal:tab-changed': CustomEvent<ModalTabChangedEvent>;
	}
}

export {};
