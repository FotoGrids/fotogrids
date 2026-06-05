<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}


class FotoGrids_Admin_Header {

    public function __construct() {
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
        add_action( 'wp_ajax_fotogrids_dismiss_notice', array( $this, 'dismiss_notice' ) );
        add_action( 'in_admin_header', array( $this, 'render' ) );
        add_action( 'admin_head', array( $this, 'modify_page_structure' ) );
    }

    public function enqueue_assets( $hook ) {
        if ( ! \FotoGrids\Admin\Admin_Screen::is_fotogrids( $hook ) ) {
            return;
        }

        wp_enqueue_style(
            'fotogrids-admin-header',
            FOTOGRIDS_PLUGIN_URL . 'assets/css/admin.css',
            array(),
            FOTOGRIDS_VERSION
        );

        wp_enqueue_script(
            'fotogrids-admin-header',
            FOTOGRIDS_PLUGIN_URL . 'assets/js/admin-header.js',
            array(),
            FOTOGRIDS_VERSION,
            true
        );

        wp_localize_script(
            'fotogrids-admin-header',
            'fotogridsAdminHeader',
            array(
                'ajaxUrl' => admin_url( 'admin-ajax.php' ),
                'nonce' => wp_create_nonce( 'fotogrids_dismiss_notice' ),
            )
        );
    }

    public function render() {
        if ( ! \FotoGrids\Admin\Admin_Screen::is_fotogrids() ) {
            return;
        }

        $this->render_notice_bar();
        $this->render_screen_meta();
        $this->render_header();
    }

    private function render_notice_bar() {
        if ( get_option( 'fotogrids_notice_bar_dismissed', false ) ) {
            return;
        }

        ?>
        <div id="fotogrids-notice-bar" class="fotogrids-dismiss-container">
            <span class="fotogrids-notice-bar__message">
                <strong><?php esc_html_e( "You're using FotoGrids Free.", 'fotogrids' ); ?></strong>
                <?php
                printf(
                    /* translators: %s: upgrade link */
                    esc_html__( 'To unlock more features consider %s with up to 40%% off.', 'fotogrids' ),
                    sprintf(
                        '<a href="%s" target="_blank" rel="noopener noreferrer">%s</a>',
                        esc_url( 'https://go.fotogrids.com/upgrade/?utm_campaign=liteplugin&utm_source=WordPress&utm_medium=notice-bar&utm_content=Upgrade%20to%20FotoGrids%20Pro&utm_locale=' . get_locale() ),
                        esc_html__( 'upgrading to PRO', 'fotogrids' )
                    )
                );
                ?>
            </span>
            <button type="button" class="fotogrids-dismiss-button" title="<?php esc_attr_e( 'Dismiss this message.', 'fotogrids' ); ?>" data-section="admin-notice-bar"></button>
        </div>
        <?php
    }

    private function render_screen_meta() {
        ?>
        <div id="fotogrids-screen-meta"></div>
        <?php
    }

    private function render_header() {
        $logo_svg = $this->get_logo_svg();
        ?>
        <div id="fotogrids-header" class="fotogrids-header">
            <div class="fotogrids-header-logo">
                <?php echo $logo_svg; ?>
            </div>
            <div class="fotogrids-links">
                <a href="<?php echo esc_url( 'https://go.fotogrids.com/docs/?utm_campaign=liteplugin&utm_source=WordPress&utm_medium=header_links&utm_content=about_docs&utm_locale=' . get_locale() ); ?>" target="_blank" rel="noopener noreferrer" class="fotogrids-link fotogrids-link-docs">
                    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 9.5V6.8C20 5.11984 20 4.27976 19.673 3.63803C19.3854 3.07354 18.9265 2.6146 18.362 2.32698C17.7202 2 16.8802 2 15.2 2H8.8C7.11984 2 6.27976 2 5.63803 2.32698C5.07354 2.6146 4.6146 3.07354 4.32698 3.63803C4 4.27976 4 5.11984 4 6.8V17.2C4 18.8802 4 19.7202 4.32698 20.362C4.6146 20.9265 5.07354 21.3854 5.63803 21.673C6.27976 22 7.11984 22 8.8 22H14M14 11H8M10 15H8M16 7H8M16.5 15.0022C16.6762 14.5014 17.024 14.079 17.4817 13.81C17.9395 13.5409 18.4777 13.4426 19.001 13.5324C19.5243 13.6221 19.999 13.8942 20.3409 14.3004C20.6829 14.7066 20.87 15.2207 20.8692 15.7517C20.8692 17.2506 18.6209 18 18.6209 18M18.6499 21H18.6599" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <?php esc_html_e( 'Docs', 'fotogrids' ); ?>
                </a>
                <a href="<?php echo esc_url( 'https://wordpress.org/support/plugin/fotogrids/' ); ?>" target="_blank" rel="noopener noreferrer" class="fotogrids-link fotogrids-link-support">
                    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 15L6.92474 18.1137C6.49579 18.548 6.28131 18.7652 6.09695 18.7805C5.93701 18.7938 5.78042 18.7295 5.67596 18.6076C5.55556 18.4672 5.55556 18.162 5.55556 17.5515V15.9916C5.55556 15.444 5.10707 15.0477 4.5652 14.9683V14.9683C3.25374 14.7762 2.22378 13.7463 2.03168 12.4348C2 12.2186 2 11.9605 2 11.4444V6.8C2 5.11984 2 4.27976 2.32698 3.63803C2.6146 3.07354 3.07354 2.6146 3.63803 2.32698C4.27976 2 5.11984 2 6.8 2H14.2C15.8802 2 16.7202 2 17.362 2.32698C17.9265 2.6146 18.3854 3.07354 18.673 3.63803C19 4.27976 19 5.11984 19 6.8V11M19 22L16.8236 20.4869C16.5177 20.2742 16.3647 20.1678 16.1982 20.0924C16.0504 20.0255 15.8951 19.9768 15.7356 19.9474C15.5558 19.9143 15.3695 19.9143 14.9969 19.9143H13.2C12.0799 19.9143 11.5198 19.9143 11.092 19.6963C10.7157 19.5046 10.4097 19.1986 10.218 18.8223C10 18.3944 10 17.8344 10 16.7143V14.2C10 13.0799 10 12.5198 10.218 12.092C10.4097 11.7157 10.7157 11.4097 11.092 11.218C11.5198 11 12.0799 11 13.2 11H18.8C19.9201 11 20.4802 11 20.908 11.218C21.2843 11.4097 21.5903 11.7157 21.782 12.092C22 12.5198 22 13.0799 22 14.2V16.9143C22 17.8462 22 18.3121 21.8478 18.6797C21.6448 19.1697 21.2554 19.5591 20.7654 19.762C20.3978 19.9143 19.9319 19.9143 19 19.9143V22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <?php esc_html_e( 'Support Forum', 'fotogrids' ); ?>
                </a>
                <a href="#" target="_self" rel="noopener noreferrer" class="fotogrids-link fotogrids-link-whats-new fotogrids-splash-modal-open">
                    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22 7.99992V11.9999M10.25 5.49991H6.8C5.11984 5.49991 4.27976 5.49991 3.63803 5.82689C3.07354 6.11451 2.6146 6.57345 2.32698 7.13794C2 7.77968 2 8.61976 2 10.2999L2 11.4999C2 12.4318 2 12.8977 2.15224 13.2653C2.35523 13.7553 2.74458 14.1447 3.23463 14.3477C3.60218 14.4999 4.06812 14.4999 5 14.4999V18.7499C5 18.9821 5 19.0982 5.00963 19.1959C5.10316 20.1455 5.85441 20.8968 6.80397 20.9903C6.90175 20.9999 7.01783 20.9999 7.25 20.9999C7.48217 20.9999 7.59826 20.9999 7.69604 20.9903C8.64559 20.8968 9.39685 20.1455 9.49037 19.1959C9.5 19.0982 9.5 18.9821 9.5 18.7499V14.4999H10.25C12.0164 14.4999 14.1772 15.4468 15.8443 16.3556C16.8168 16.8857 17.3031 17.1508 17.6216 17.1118C17.9169 17.0756 18.1402 16.943 18.3133 16.701C18.5 16.4401 18.5 15.9179 18.5 14.8736V5.1262C18.5 4.08191 18.5 3.55976 18.3133 3.2988C18.1402 3.05681 17.9169 2.92421 17.6216 2.88804C17.3031 2.84903 16.8168 3.11411 15.8443 3.64427C14.1772 4.55302 12.0164 5.49991 10.25 5.49991Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <?php esc_html_e( "What's New", 'fotogrids' ); ?>
                </a>
            </div>
        </div>
        <?php
    }

    private function get_logo_svg() {
        return '<svg id="fotogrids-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 351.5 59.53">
            <rect x="1.42" y="1.42" width="56.69" height="14.17" style="fill:#3c46f0;"/>
            <rect x="1.42" y="22.68" width="35.43" height="14.17" style="fill:#f01e32;"/>
            <rect x="1.42" y="43.94" width="14.17" height="14.17" style="fill:#ffb914;"/>
            <rect x="22.68" y="43.94" width="14.17" height="14.17" style="fill:#323232;"/>
            <rect x="43.94" y="22.68" width="14.17" height="35.43" style="fill:#323232;"/>
            <rect x="282.15" y="22.68" width="4.25" height="35.43" style="fill:#323232;"/>
            <polygon points="167.24 22.68 138.9 22.68 138.9 31.18 147.4 31.18 147.4 58.11 158.74 58.11 158.74 31.18 167.24 31.18 167.24 22.68" style="fill:#323232;"/>
            <polygon points="97.8 31.18 97.8 22.68 72.28 22.68 72.28 58.11 83.62 58.11 83.62 46.77 94.96 46.77 94.96 38.27 83.62 38.27 83.62 31.18 97.8 31.18" style="fill:#323232;"/>
            <path d="M119.06,33.31c3.91,0,7.09,3.18,7.09,7.09s-3.18,7.09-7.09,7.09-7.09-3.18-7.09-7.09,3.18-7.09,7.09-7.09M119.06,21.97c-10.18,0-18.43,8.25-18.43,18.43s8.25,18.43,18.43,18.43,18.43-8.25,18.43-18.43-8.25-18.43-18.43-18.43h0Z" style="fill:#323232;"/>
            <path d="M187.09,33.31c3.91,0,7.09,3.18,7.09,7.09s-3.18,7.09-7.09,7.09-7.09-3.18-7.09-7.09,3.18-7.09,7.09-7.09M187.09,21.97c-10.18,0-18.43,8.25-18.43,18.43s8.25,18.43,18.43,18.43,18.43-8.25,18.43-18.43-8.25-18.43-18.43-18.43h0Z" style="fill:#323232;"/>
            <path d="M338.84,58.82c-6.25,0-11.34-5.09-11.34-11.34h4.25c0,3.91,3.18,7.09,7.09,7.09,3.43,0,7.09-1.49,7.09-5.67,0-2.93-2.99-4.43-7.93-6.55-4.92-2.12-10.5-4.51-10.5-10.46s4.56-9.92,11.34-9.92c6.25,0,11.34,5.09,11.34,11.34h-4.25c0-3.91-3.18-7.09-7.09-7.09-3.43,0-7.09,1.49-7.09,5.67,0,2.93,2.99,4.43,7.93,6.55,4.92,2.12,10.5,4.51,10.5,10.46s-4.56,9.92-11.34,9.92Z" style="fill:#323232;"/>
            <path d="M226.77,40.39v4.25h16.35c-1.81,5.74-7.19,9.92-13.52,9.92-7.82,0-14.17-6.36-14.17-14.17s6.36-14.17,14.17-14.17c5.23,0,9.8,2.86,12.26,7.09h4.75c-2.78-6.66-9.34-11.34-17.01-11.34-10.18,0-18.43,8.25-18.43,18.43s8.25,18.43,18.43,18.43,18.43-8.25,18.43-18.43h-21.26Z" style="fill:#323232;"/>
            <path d="M305.54,22.68h-12.05v35.43h12.05c9.78,0,17.72-7.93,17.72-17.72s-7.93-17.72-17.72-17.72ZM305.54,53.86h0s-7.8,0-7.8,0v-26.93h7.8c7.42,0,13.46,6.04,13.46,13.46s-6.04,13.46-13.46,13.46Z" style="fill:#323232;"/>
            <path d="M276.38,33.66c0-6.07-4.92-10.98-10.98-10.98h-13.11v35.43h4.25v-13.46h6.9l7.77,13.46h4.91l-7.98-13.82c4.74-1.22,8.24-5.51,8.24-10.63ZM265.39,40.39h-8.86v-13.46h8.86c3.71,0,6.73,3.02,6.73,6.73s-3.02,6.73-6.73,6.73h0Z" style="fill:#323232;"/>
        </svg>';
    }

    public function dismiss_notice() {
        if ( ! wp_verify_nonce( $_POST['nonce'], 'fotogrids_dismiss_notice' ) ) {
            wp_die( esc_html__( 'Security check failed.', 'fotogrids' ) );
        }

        update_option( 'fotogrids_notice_bar_dismissed', true );
        wp_die();
    }

    /**
     * Modify page structure using CSS and minimal JavaScript
     */
    public function modify_page_structure() {
        if ( ! \FotoGrids\Admin\Admin_Screen::is_fotogrids() ) {
            return;
        }

        $screen = get_current_screen();
        if ( ! $screen || ! in_array( $screen->post_type, array( 'fotogrids_gallery', 'fotogrids_album' ) ) ) {
            return;
        }

        ?>
        <style>
        body.post-type-fotogrids_gallery .wrap,
        body.post-type-fotogrids_album .wrap {
            opacity: 0;
            transition: opacity 0.1s ease-in;
        }

        body.post-type-fotogrids_gallery .wrap.fotogrids-structured,
        body.post-type-fotogrids_album .wrap.fotogrids-structured {
            opacity: 1;
        }
        </style>

        <script>
        (function() {
            'use strict';

            function restructurePage() {
                const body = document.body;
                if (!body.classList.contains('post-type-fotogrids_gallery') &&
                    !body.classList.contains('post-type-fotogrids_album')) {
                    return;
                }

                const wrap = document.querySelector('.wrap');
                if (!wrap) {
                    return;
                }

                const headingInline = wrap.querySelector('.wp-heading-inline');
                if (!headingInline) {
                    wrap.classList.add('fotogrids-structured');
                    return;
                }

                headingInline.classList.remove('wp-heading-inline');
                headingInline.classList.add('fotogrids-heading-inline');

                const promotionalSelectors = [
                    '.promotion',
                    '.promo',
                    '.notice',
                    '.notice-info',
                    '.notice-warning',
                    '.notice-error',
                    '.notice-success',
                    '.updated',
                    '.error',
                    '.admin-notice',
                    '.plugin-update-tr',
                    '.update-message',
                    '.wp-header-end + .notice',
                    '.wp-header-end + .updated',
                    '.wp-header-end + .error',
                    '[class*="promotion"]',
                    '[class*="promo"]',
                    '[class*="banner"]',
                    '[class*="upgrade"]',
                    '[class*="premium"]'
                ];

                function isInsideUpgradeModal(element) {
                    // Always skip the FotoGrids modal system. Modal portals
                    // mount these directly under <body>, not inside the legacy
                    // #fotogrids-upgrade-modal container, so the contains()
                    // check below would otherwise remove them as "promotional".
                    if (element.classList && (
                        element.classList.contains('fg-modal') ||
                        element.classList.contains('fg-confirm') ||
                        element.classList.contains('fg-prompt') ||
                        element.classList.contains('fg-alert')
                    )) {
                        return true;
                    }
                    if (element.closest && element.closest('.fg-modal, #fotogrids-modal-root')) {
                        return true;
                    }
                    if (element.id === 'fotogrids-modal-root') {
                        return true;
                    }

                    const upgradeModalContainer = document.getElementById('fotogrids-upgrade-modal');
                    if (!upgradeModalContainer) {
                        return false;
                    }

                    return (
                        (element.parentNode === upgradeModalContainer) ||
                        (element.id === 'fotogrids-upgrade-modal') ||
                        (upgradeModalContainer.contains && upgradeModalContainer.contains(element)) ||
                        (element.closest && element.closest('#fotogrids-upgrade-modal')) ||
                        element.classList.contains('fotogrids-upgrade-modal-overlay') ||
                        element.classList.contains('fotogrids-upgrade-modal')
                    );
                }

                const observer = new MutationObserver(function(mutations) {
                    mutations.forEach(function(mutation) {
                        if (mutation.type === 'childList') {
                            mutation.addedNodes.forEach(function(node) {
                                if (node.nodeType === Node.ELEMENT_NODE) {
                                    if (isInsideUpgradeModal(node)) {
                                        return;
                                    }

                                    const matchesPromo = promotionalSelectors.some(function(selector) {
                                        try {
                                            return node.matches && node.matches(selector);
                                        } catch (e) {
                                            return false;
                                        }
                                    });

                                    if (matchesPromo) {
                                        node.remove();
                                    }

                                    promotionalSelectors.forEach(function(selector) {
                                        try {
                                            const childElements = node.querySelectorAll && node.querySelectorAll(selector);
                                            if (childElements && childElements.length > 0) {
                                                childElements.forEach(function(childElement) {
                                                    if (!isInsideUpgradeModal(childElement)) {
                                                        childElement.remove();
                                                    }
                                                });
                                            }
                                        } catch (e) {
                                        }
                                    });
                                }
                            });
                        }
                    });
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });

                const headerEnd = wrap.querySelector('.wp-header-end');
                if (!headerEnd) {
                    wrap.classList.add('fotogrids-structured');
                    return;
                }

                const headerElements = [];
                let current = headingInline;

                while (current && current !== headerEnd) {
                    headerElements.push(current);
                    current = current.nextElementSibling;
                }

                if (current === headerEnd) {
                    headerEnd.remove();
                }

                const screenMeta = document.getElementById('screen-meta');
                const screenMetaLinks = document.getElementById('screen-meta-links');

                if (screenMeta || screenMetaLinks) {
                    const fotogridsScreenMeta = document.getElementById('fotogrids-screen-meta');
                    if (fotogridsScreenMeta) {
                        if (screenMeta) {
                            fotogridsScreenMeta.appendChild(screenMeta);
                        }
                        if (screenMetaLinks) {
                            fotogridsScreenMeta.appendChild(screenMetaLinks);
                        }
                    }
                }

                const pageHeader = document.createElement('div');
                pageHeader.className = 'fotogrids-page-header';

                headingInline.parentNode.insertBefore(pageHeader, headingInline);

                headerElements.forEach(function(element) {
                    pageHeader.appendChild(element);
                });

                const pageTitleAction = pageHeader.querySelector('.page-title-action');
                if (pageTitleAction) {
                    pageTitleAction.className = 'fg-button fg-button--variant-primary fg-button--size-sm';
                }

                const remainingElements = Array.from(wrap.children).filter(function(child) {
                    return child !== pageHeader;
                });

                if (remainingElements.length > 0) {
                    const pageBody = document.createElement('div');
                    pageBody.className = 'fotogrids-page-body';
                    wrap.appendChild(pageBody);

                    remainingElements.forEach(function(element) {
                        pageBody.appendChild(element);
                    });
                }

                wrap.classList.add('fotogrids-structured');
            }

            // Run immediately if DOM is ready, otherwise wait
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', restructurePage);
            } else {
                restructurePage();
            }
        })();
        </script>
        <?php
    }
}

new FotoGrids_Admin_Header();
