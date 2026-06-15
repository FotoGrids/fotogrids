// Custom type declarations for WordPress packages

declare module '@wordpress/blocks' {
	export interface BlockAttributes {
		[key: string]: any;
	}

	export interface BlockEditProps<T = BlockAttributes> {
		attributes: T;
		setAttributes: (attributes: Partial<T>) => void;
		clientId: string;
		className?: string;
	}

	export interface BlockSaveProps<T = BlockAttributes> {
		attributes: T;
		className?: string;
	}

	export interface BlockConfiguration {
		title: string;
		icon: string;
		category: string;
		attributes: Record<string, any>;
		edit: (props: BlockEditProps) => JSX.Element;
		save: (props: BlockSaveProps) => JSX.Element;
	}

	export function registerBlockType(
		name: string,
		config: BlockConfiguration,
	): void;
}

declare module '@wordpress/block-editor' {
	export const InspectorControls: React.ComponentType<{
		children: React.ReactNode;
	}>;
	export const useBlockProps: () => any;
}

declare module '@wordpress/components' {
	export interface ButtonProps {
		children: React.ReactNode;
		variant?: 'primary' | 'secondary' | 'tertiary';
		onClick?: () => void;
		disabled?: boolean;
		className?: string;
	}

	export const Button: React.ComponentType<ButtonProps>;

	export interface PanelBodyProps {
		title: string;
		children: React.ReactNode;
		initialOpen?: boolean;
	}

	export const PanelBody: React.ComponentType<PanelBodyProps>;

	export interface SelectControlProps {
		label: string;
		value: string;
		options: Array<{ label: string; value: string; disabled?: boolean }>;
		onChange: (value: string) => void;
	}

	export const SelectControl: React.ComponentType<SelectControlProps>;

	export interface ToggleControlProps {
		label: string;
		checked: boolean;
		onChange: (checked: boolean) => void;
	}

	export const ToggleControl: React.ComponentType<ToggleControlProps>;

	export interface SpinnerProps {
		className?: string;
	}

	export const Spinner: React.ComponentType<SpinnerProps>;

	export interface PlaceholderProps {
		icon?: React.ReactNode;
		label?: string;
		children: React.ReactNode;
	}

	export const Placeholder: React.ComponentType<PlaceholderProps>;

	export interface NoticeProps {
		status: 'success' | 'error' | 'warning' | 'info';
		children: React.ReactNode;
		isDismissible?: boolean;
		onRemove?: () => void;
	}

	export const Notice: React.ComponentType<NoticeProps>;
}

declare module '@wordpress/element' {
	export const useState: typeof React.useState;
	export const useEffect: typeof React.useEffect;
	export const createElement: typeof React.createElement;
	export const Fragment: typeof React.Fragment;
}

declare module '@wordpress/data' {
	export function useSelect<T>(selector: (select: any) => T): T;
	export function useDispatch(storeName: string): any;
}

declare module '@wordpress/api-fetch' {
	interface ApiFetchOptions {
		path?: string;
		url?: string;
		method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
		data?: any;
		headers?: Record<string, string>;
	}

	function apiFetch<T = any>(options: ApiFetchOptions): Promise<T>;
	export default apiFetch;
}

declare module '@wordpress/i18n' {
	export function __<T = string>(text: T, domain?: string): T;
	export function _x<T = string>(
		text: T,
		context: string,
		domain?: string,
	): T;
	export function _n(
		single: string,
		plural: string,
		number: number,
		domain?: string,
	): string;
}
