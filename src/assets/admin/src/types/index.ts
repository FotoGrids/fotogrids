// Global types for FotoGrids admin interface

export interface Gallery {
    id: number;
    title: string;
    description: string;
    meta: {
        layout: string;
        columns: number;
        album_id?: number;
    };
    images: GalleryImage[];
    shortcode: string;
}

export interface GalleryImage {
    id: number;
    gallery_id: number;
    position: number;
    caption?: string;
    description?: string;
    location?: string;
    url: string;
    thumbnail: string;
    medium: string;
    large: string;
    full: string;
    alt: string;
    title: string;
}

export interface Album {
    id: number;
    title: string;
    description: string;
    meta: {
        layout: string;
        featured_gallery?: number;
    };
    galleries: Gallery[];
    shortcode: string;
}

export interface Template {
    id: string;
    name: string;
    description: string;
    type: 'free' | 'starter' | 'expert' | 'commerce';
    preview: string;
}

export interface Statistics {
    views: number;
    shares: number;
    last_viewed?: string;
    created_at?: string;
    updated_at?: string;
}

export interface AdminSettings {
    general: {
        default_layout: string;
        lazy_load: boolean;
        retina_support: boolean;
    };
    permissions: {
        roles_manage: string[];
        roles_edit: string[];
        roles_view_stats: string[];
    };
    integrations: {
        elementor: boolean;
        divi: boolean;
        beaver: boolean;
    };
}

export interface License {
    id?: number;
    license_key: string;
    license_type: 'starter' | 'expert' | 'commerce' | 'lifetime';
    status: 'active' | 'expired' | 'disabled';
    user_email?: string;
    expiry_date?: string;
}

// WordPress globals
declare global {
    interface Window {
        fotogridsAdmin: {
            nonce: string;
            restUrl: string;
            pluginUrl: string;
            currentUser: any;
            capabilities: {
                manage_fotogrids: boolean;
                edit_fotogrids: boolean;
                view_fotogrids_stats: boolean;
            };
        };
        wp: {
            element: any;
            components: any;
            data: any;
            apiFetch: any;
            i18n: any;
            mediaUtils: any;
        };
    }
}

export {};
