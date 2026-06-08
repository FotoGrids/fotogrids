const path = require('path');
const fs = require('fs');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

const ENTRY_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.scss'];

/**
 * Auto-discover per-tool entries.
 *
 * Convention: each tool lives at `src/includes/tools/<id>/` and exposes
 * its entry asset(s) as `assets/<id>.{js,jsx,ts,tsx,scss}`. Files in the
 * tool's `assets/` folder whose basename does NOT match `<id>` (e.g. React
 * component files like `ImportExportTool.jsx`) are treated as helpers and
 * imported by the entry - not built as standalone entries.
 *
 * Each match produces an entry named `tool-<id>` and is routed to
 * `dist/includes/tools/<id>/assets/<id>.{js,css}` by the output/CSS
 * filename callbacks below.
 */
function discoverToolEntries() {
    const entries = {};
    const toolsRoot = path.resolve(__dirname, 'src/includes/tools');
    if (!fs.existsSync(toolsRoot)) return entries;

    for (const toolId of fs.readdirSync(toolsRoot)) {
        const assetsDir = path.join(toolsRoot, toolId, 'assets');
        if (!fs.statSync(path.join(toolsRoot, toolId)).isDirectory()) continue;
        if (!fs.existsSync(assetsDir)) continue;

        for (const ext of ENTRY_EXTENSIONS) {
            const entryFile = path.join(assetsDir, toolId + ext);
            if (fs.existsSync(entryFile)) {
                entries[`tool-${toolId}`] = './' + path.relative(__dirname, entryFile).replace(/\\/g, '/');
                break; // first match wins; JS takes precedence over SCSS by ENTRY_EXTENSIONS order
            }
        }
    }
    return entries;
}

/**
 * Auto-discover per-module entries.
 *
 * Convention: each module lives at `src/includes/modules/<Name>/` and
 * exposes its entry assets at `assets/src/<surface>.{js,jsx,ts,tsx,scss}`.
 * Every top-level file in `assets/src/` is an entry. Helper files belong
 * in subfolders (`assets/src/components/`, `assets/src/utils/`, …).
 *
 * In addition to the canonical `<Name>/assets/src/` location, the
 * discovery also walks:
 *
 *   <Name>/core/assets/src/              -> entries `module-<Name>-<surface>`
 *   <Name>/builders/<B>/assets/src/      -> entries `module-<Name>-<B>-<surface>`
 *
 * This supports umbrella modules with a shared `core/` and per-builder
 * sub-modules (e.g. PageBuilders/{core,builders/Gutenberg}) without
 * forcing every umbrella to flatten its bundles into the top level.
 *
 * Each match produces an entry whose output is routed by the
 * `output.filename` and `MiniCssExtractPlugin.filename` callbacks below.
 *
 * If a code entry (.js/.jsx/.ts/.tsx) and an SCSS entry share the same
 * `<surface>` name within a discovery root, the SCSS file is treated as
 * styles for the code entry - the code file is expected to
 * `import './<surface>.scss'`, which causes MiniCssExtractPlugin to emit
 * the CSS alongside the code bundle. A standalone SCSS entry is only
 * registered when there is no matching code file.
 */
function discoverModuleEntries() {
    const entries = {};
    const modulesRoot = path.resolve(__dirname, 'src/includes/modules');
    if (!fs.existsSync(modulesRoot)) return entries;

    const codeExts = new Set(['.js', '.jsx', '.ts', '.tsx']);

    /**
     * Register every top-level entry in `srcDir` under the given entry
     * prefix.
     */
    const registerSrcDir = (srcDir, entryPrefix) => {
        if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) return;

        const files = fs.readdirSync(srcDir).filter((f) =>
            fs.statSync(path.join(srcDir, f)).isFile()
        );

        const codeSurfaces = new Set(
            files
                .filter((f) => codeExts.has(path.extname(f)))
                .map((f) => path.basename(f, path.extname(f)))
        );

        for (const file of files) {
            const ext = path.extname(file);
            const surface = path.basename(file, ext);
            const isCode = codeExts.has(ext);
            const isStyle = ext === '.scss';

            if (!isCode && !isStyle) continue;
            if (isStyle && codeSurfaces.has(surface)) continue;

            const entryName = `${entryPrefix}-${surface}`;
            const rel = './' + path.relative(__dirname, path.join(srcDir, file)).replace(/\\/g, '/');
            entries[entryName] = rel;
        }
    };

    for (const moduleName of fs.readdirSync(modulesRoot)) {
        const moduleRoot = path.join(modulesRoot, moduleName);
        if (!fs.statSync(moduleRoot).isDirectory()) continue;

        // 1. Canonical: <Name>/assets/src/
        registerSrcDir(
            path.join(moduleRoot, 'assets', 'src'),
            `module-${moduleName}`
        );

        // 2. Umbrella core: <Name>/core/assets/src/
        registerSrcDir(
            path.join(moduleRoot, 'core', 'assets', 'src'),
            `module-${moduleName}`
        );

        // 3. Per-builder: <Name>/builders/<B>/assets/src/
        const buildersDir = path.join(moduleRoot, 'builders');
        if (fs.existsSync(buildersDir) && fs.statSync(buildersDir).isDirectory()) {
            for (const builderName of fs.readdirSync(buildersDir)) {
                const builderRoot = path.join(buildersDir, builderName);
                if (!fs.statSync(builderRoot).isDirectory()) continue;
                registerSrcDir(
                    path.join(builderRoot, 'assets', 'src'),
                    `module-${moduleName}-${builderName}`
                );
            }
        }
    }
    return entries;
}

const mainConfig = {
    name: 'main',
    entry: {
        'admin': './src/assets/admin/src/index.js',
        'metabox': './src/assets/admin/src/metabox.js',
        'fotogrids-runtime': './src/public/render/internal/runtime/runtime.js',
        'deep-linking': './src/assets/frontend/src/deep-linking.js',
        'fg-tooltip': './src/public/render/fg-tooltip/fg-tooltip.js',
        'loading-icon': './src/public/render/features/loading-icon/loading-icon.js',
        'loading-icon-styles': './src/public/render/features/loading-icon/loading-icon.scss',
        'lightbox': './src/public/render/features/lightbox/lightbox.js',
        'lightbox-styles': './src/public/render/features/lightbox/lightbox.scss',
        'filter-ui': './src/public/render/filters/features/ui/filter-ui.js',
        'filter-ui-styles': './src/public/render/filters/features/ui/filter-ui.scss',
        'sharing': './src/public/render/decorators/sharing/sharing.js',
        'image-zoom': './src/public/render/decorators/image-zoom/image-zoom.js',
        'password-gate': './src/public/render/gates/password/password-gate.js',
        'lazy-load': './src/public/render/features/lazy-load/lazy-load.js',
        'layout-justified': './src/public/render/layouts/justified/justified.js',
        'layout-masonry': './src/public/render/layouts/masonry/masonry.js',
        'layout-slider': './src/public/render/layouts/slider/slider.js',
        'stats': './src/public/render/features/stats/stats.js',
        'video-inline': './src/public/render/video/video-inline.js',
        'video-lightbox-mini': './src/public/render/video/video-lightbox-mini.js',
        'lightbox-mini': './src/public/render/lightbox-mini/lightbox-mini.js',
        'album-to-gallery-ajax': './src/public/render/decorators/album-to-gallery-ajax/album-to-gallery-ajax.js',
        'collection-header': './src/public/render/features/collection-header/collection-header.js',
        'pagination-core': './src/public/render/features/pagination/pagination-core.js',
        'endless-scroll': './src/public/render/features/pagination/endless-scroll/endless-scroll.js',
        'load-more': './src/public/render/features/pagination/load-more/load-more.js',
        'page-buttons': './src/public/render/features/pagination/page-buttons/page-buttons.js',
        'collection-state-manager': './src/assets/admin/src/collection-state-manager.js',
        'ajax-save': './src/assets/admin/src/ajax-save.js',
        'album-assignment': './src/assets/admin/src/album-assignment.js',
        'album-galleries': './src/assets/admin/src/album-galleries.js',
        'global-modal-init': './src/assets/admin/src/global-modal-init.js',
        'admin-header': './src/assets/admin/src/admin-header.js',
        'upgrade-modal': './src/assets/admin/src/styles/upgrade-modal.scss',
        // Aggregated shared-component stylesheet for every surface that
        // uses FG components outside the FotoGrids admin pages
        // (Gutenberg + Elementor editors today, Divi/Bricks tomorrow).
        // Registered once as the `fotogrids-fg-shared` WP handle by
        // PageBuilders\Module so every editor declares a single style
        // dep and gets Modal + Button + Checkbox + FormField + Icon
        // styling. The `admin` bundle still includes the same partials
        // via admin.scss for FotoGrids admin pages.
        'fg-shared-styles': './src/assets/admin/src/styles/fg-shared/fg-shared.scss',
        'codemirror-init': './src/assets/admin/src/codemirror-init.js',
        'dashboard-widget': './src/assets/admin/src/dashboard-widget.js',
        'dashboard-widget-styles': './src/assets/admin/src/styles/dashboard-widget.scss',
        'toast-init': './src/assets/admin/src/toast-init.js',
        'shortcode-column-init': './src/assets/admin/src/shortcode-column-init.js',
        'ui-state-manager': './src/assets/admin/src/utils/ui-state-manager.js',
        // Per-tool and per-module entries are discovered automatically from the
        // filesystem. The routing for these chunks lives in the output.filename
        // and MiniCssExtractPlugin.filename callbacks below.
        ...discoverToolEntries(),
        ...discoverModuleEntries(),
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        // Route tool-* and module-* entries to their feature folder; everything
        // else to assets/js/.
        filename: (pathData) => {
            const name = pathData.chunk.name;
            if (name && name.startsWith('tool-')) {
                const toolId = name.slice('tool-'.length);
                return `includes/tools/${toolId}/assets/${toolId}.js`;
            }
            if (name && name.startsWith('module-')) {
                const rest = name.slice('module-'.length);   // '<Name>-<surface>' or '<Name>-<Builder>-<surface>'
                const parts = rest.split('-');
                // 'PageBuilders-Gutenberg-block' -> module=PageBuilders, builder=Gutenberg, asset=block
                // 'PageBuilders-preview-asset-wiring' -> module=PageBuilders, asset=preview-asset-wiring
                // Heuristic: builder names are PascalCase (start uppercase). Three-or-more-part names
                // with a PascalCase second segment are treated as <module>-<builder>-<asset...>.
                if (parts.length >= 3 && /^[A-Z]/.test(parts[1])) {
                    const moduleName = parts[0];
                    const builderName = parts[1];
                    const asset = parts.slice(2).join('-');
                    return `includes/modules/${moduleName}/builders/${builderName}/assets/${asset}.js`;
                }
                const moduleName = parts[0];
                const asset = parts.slice(1).join('-');
                return `includes/modules/${moduleName}/assets/${asset}.js`;
            }
            return 'assets/js/[name].js';
        },
        publicPath: 'auto',
        clean: false, // managed manually; 'true' causes EPERM in sandboxed environments
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.jsx'],
        alias: {
            '@': path.resolve(__dirname, 'src/assets'),
            '@modules': path.resolve(__dirname, 'src/includes/modules'),
        },
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env', '@babel/preset-react'],
                    },
                },
            },
            {
                test: /\.s[ac]ss$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                    {
                        loader: 'sass-loader',
                        options: {
                            api: 'modern',
                            implementation: require('sass'),
                        },
                    },
                ],
            },
            {
                test: /\.css$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                ],
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/items/[name][ext]',
                },
            },
            {
                test: /\.(woff|woff2|eot|ttf|otf)$/i,
                type: 'asset/resource',
                generator: {
                    filename: 'assets/fonts/[name][ext]',
                },
            },
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            // Route tool-* and module-* CSS to their feature folder; everything
            // else to assets/css/.
            filename: (pathData) => {
                const name = pathData.chunk.name;
                if (name && name.startsWith('tool-')) {
                    const toolId = name.slice('tool-'.length);
                    return `includes/tools/${toolId}/assets/${toolId}.css`;
                }
                if (name && name.startsWith('module-')) {
                    const rest = name.slice('module-'.length);
                    const parts = rest.split('-');
                    if (parts.length >= 3 && /^[A-Z]/.test(parts[1])) {
                        const moduleName = parts[0];
                        const builderName = parts[1];
                        const asset = parts.slice(2).join('-');
                        return `includes/modules/${moduleName}/builders/${builderName}/assets/${asset}.css`;
                    }
                    const moduleName = parts[0];
                    const asset = parts.slice(1).join('-');
                    return `includes/modules/${moduleName}/assets/${asset}.css`;
                }
                return 'assets/css/[name].css';
            },
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'src/**/*.php',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                    globOptions: {
                        // The native Divi 5 bundle's BUILD-ARTIFACT dirs
                        // (build/, styles/, modules-json/) are written into
                        // dist/ exclusively by the `divi-native` config's
                        // afterEmit mirror — including their index.php silence
                        // files. Excluding them here guarantees a SINGLE writer
                        // to those dist dirs. Two writers targeting the same
                        // native/build dir is what broke the build: the copy
                        // collided with the mirror's rmSync/cpSync, webpack
                        // exited non-zero, and the dist sync to the live plugin
                        // never completed — leaving stale frontend JS (items
                        // stuck in data-fg-media-state="loading") and 404s on
                        // the native bundle. The native PHP render classes
                        // (native/php/*.php) and native/index.php are NOT
                        // excluded — those still ship via this pattern.
                        ignore: [
                            '**/Divi/native/build/**',
                            '**/Divi/native/styles/**',
                            '**/Divi/native/modules-json/**',
                        ],
                    },
                },
                {
                    // Bundled watermark fonts (TTF + licences). Referenced at
                    // runtime by a PHP-emitted @font-face and by the server-side
                    // watermark engine, so they are copied verbatim rather than
                    // resolved through a webpack url() import.
                    from: 'src/assets/fonts/**/*',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                },
                {
                    from: 'src/includes/rest/templates/templates/**/*.json',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                },
                {
                    // Block.json metadata for the PageBuilders Gutenberg sub-module
                    // (and any future module that ships Gutenberg blocks). Copied
                    // verbatim into dist/; register_block_type() reads them from
                    // the runtime dist path.
                    from: 'src/includes/modules/**/blocks/**/block.json',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                },
                {
                    from: 'src/config/**/*.json',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                    // loading-icons-waapi.json stores one self-contained
                    // `function animate(svg){...}` source string per icon, each
                    // carrying the full shared helper block with its JSDoc and
                    // inline comments. PHP emits the selected icon's string
                    // verbatim as inline frontend JS, so those comments are dead
                    // weight on both disk and the page. In production builds we
                    // run each function string through Terser (comments off,
                    // whitespace collapsed) before it lands in dist/. The
                    // committed src/config copy is left untouched and readable.
                    // Identifiers are preserved (no mangle/compress) so the
                    // emitted JS stays one safe step from the source — the only
                    // change is comment/whitespace removal.
                    async transform(content, absoluteFilename) {
                        if (
                            !isProduction ||
                            !absoluteFilename.endsWith('loading-icons-waapi.json')
                        ) {
                            return content;
                        }

                        const terser = require('terser');
                        let map;
                        try {
                            map = JSON.parse(
                                Buffer.isBuffer(content)
                                    ? content.toString('utf8')
                                    : String(content)
                            );
                        } catch (e) {
                            console.warn(
                                'loading-icons-waapi: parse failed, copying verbatim:',
                                e.message
                            );
                            return content;
                        }

                        const out = {};
                        for (const [name, fnSource] of Object.entries(map)) {
                            try {
                                const result = await terser.minify(String(fnSource), {
                                    compress: false,
                                    mangle: false,
                                    format: { comments: false },
                                });
                                out[name] =
                                    result && result.code ? result.code : fnSource;
                            } catch (e) {
                                console.warn(
                                    'loading-icons-waapi: minify failed for',
                                    name,
                                    '- keeping original:',
                                    e.message
                                );
                                out[name] = fnSource;
                            }
                        }

                        return Buffer.from(JSON.stringify(out, null, 2), 'utf8');
                    },
                },
                // NOTE: the native Divi 5 VB bundle (build/, styles/,
                // modules-json/) is intentionally NOT copied here. It's built
                // and mirrored into dist/ by the separate `divi-native`
                // webpack config (see the second config in this array's
                // export). Keeping it out of the `main` config means a
                // native-side issue can never interfere with the front-end
                // build — see the long note on `diviNativeConfig` for why
                // that isolation matters (stuck `data-fg-media-state` bug).
                {
                    from: 'src/fotogrids.php',
                    to: 'fotogrids.php',
                },
                {
                    from: 'src/readme.txt',
                    to: 'readme.txt',
                },
                {
                    from: 'src/index.php',
                    to: 'index.php',
                },
                {
                    from: 'src/uninstall.php',
                    to: 'uninstall.php',
                },
                {
                    // Freemius SDK non-PHP assets (CSS, JS, fonts, images, languages).
                    from: 'src/freemius/**/*',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                    globOptions: {
                        ignore: [
                            '**/*.php',
                            // Pricing page is disabled in our Freemius config
                            // ('pricing' => false), so its React widget (~488KB)
                            // is dead weight in the release zip.
                            '**/freemius/assets/js/pricing/**',
                            // .pot is a translation source artifact, not runtime;
                            // compiled .mo locales are kept.
                            '**/freemius/languages/*.pot',
                        ],
                    },
                },
                {
                    from: 'src/assets/admin/plain/**/*',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                    filter: (resourcePath) => {
                        return !resourcePath.includes('ajax-save.js') && !resourcePath.includes('meta-boxes.js');
                    },
                    transform(content, absoluteFilename) {
                        if (isProduction && absoluteFilename.endsWith('.js')) {
                            if (!content || content.length === 0) {
                                console.warn('Empty content for', absoluteFilename);
                                return content;
                            }

                            const terser = require('terser');

                            try {
                                const sourceCode = Buffer.isBuffer(content) ? content.toString('utf8') : String(content);

                                if (!sourceCode.trim()) {
                                    console.warn('Empty source code for', absoluteFilename);
                                    return content;
                                }

                                const result = terser.minify(sourceCode, {
                                    compress: {
                                        drop_console: true,
                                        drop_debugger: true,
                                        pure_funcs: ['console.log', 'console.info', 'console.debug'],
                                    },
                                    mangle: {
                                        toplevel: false,
                                        reserved: ['jQuery', '$', 'wp', 'ajaxurl'],
                                        properties: false,
                                    },
                                    format: {
                                        comments: false,
                                    },
                                });

                                if (result.error) {
                                    console.warn('Terser error for', absoluteFilename, ':', result.error);
                                    return content;
                                }

                                if (!result.code) {
                                    console.info('No minified code generated for', absoluteFilename);
                                    return content;
                                }

                                return Buffer.from(result.code, 'utf8');
                            } catch (error) {
                                console.warn('Failed to minify', absoluteFilename, ':', error.message);
                                return content;
                            }
                        }
                        return content;
                    },
                },
                {
                    from: 'src/assets/admin/images/**/*',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                },
                {
                    from: 'src/public/assets/**/*',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                },
                {
                    from: 'src/public/render/**/*',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                    globOptions: {
                        // .php and .scss are excluded because webpack handles them (PHP via
                        // the php copy patterns above; SCSS via MiniCssExtractPlugin).
                        // fg-tooltip.js and runtime.js are also excluded because they're
                        // webpack entry points — the built output lands in assets/js/.
                        ignore: [
                            '**/*.php',
                            '**/*.scss',
                            '**/*.md',
                            '**/fg-tooltip/fg-tooltip.js',
                            '**/internal/runtime/runtime.js',
                            '**/decorators/sharing/sharing.js',
                            '**/decorators/image-zoom/image-zoom.js',
                            '**/gates/password/password-gate.js',
                            '**/features/lazy-load/lazy-load.js',
                            '**/layouts/justified/justified.js',
                            '**/layouts/masonry/masonry.js',
                            '**/layouts/slider/slider.js',
                            '**/layouts/_helpers/**',
                            '**/features/stats/stats.js',
                            '**/video/video-inline.js',
                            '**/video/video-lightbox-mini.js',
                            '**/lightbox-mini/lightbox-mini.js',
                            '**/decorators/album-to-gallery-ajax/album-to-gallery-ajax.js',
                            '**/features/collection-header/collection-header.js',
                            '**/features/pagination/pagination-core.js',
                            '**/features/pagination/endless-scroll/endless-scroll.js',
                            '**/features/pagination/load-more/load-more.js',
                            '**/features/pagination/page-buttons/page-buttons.js',
                        ],
                    },
                },
                {
                    from: 'src/languages/**/*',
                    to: 'languages/[name][ext]',
                    noErrorOnMissing: true,
                },
            ],
        }),
    ],
    externals: {
        'react': 'React',
        'react-dom': 'ReactDOM',
        '@wordpress/element': 'wp.element',
        '@wordpress/components': 'wp.components',
        '@wordpress/data': 'wp.data',
        '@wordpress/api-fetch': 'wp.apiFetch',
        '@wordpress/i18n': 'wp.i18n',
        '@wordpress/blocks': 'wp.blocks',
        '@wordpress/block-editor': 'wp.blockEditor',
        '@wordpress/media-utils': 'wp.mediaUtils',
        '@wordpress/hooks': 'wp.hooks',
        '@wordpress/compose': 'wp.compose',
        '@wordpress/notices': 'wp.notices',
        '@wordpress/rich-text': 'wp.richText',
        '@wordpress/primitives': 'wp.primitives',
        '@wordpress/dom': 'wp.dom',
        '@wordpress/dom-ready': 'wp.domReady',
        '@wordpress/keyboard-shortcuts': 'wp.keyboardShortcuts',
        '@wordpress/keycodes': 'wp.keycodes',
        '@wordpress/html-entities': 'wp.htmlEntities',
        '@wordpress/url': 'wp.url',
        '@wordpress/deprecated': 'wp.deprecated',
        '@wordpress/warning': 'wp.warning',
        '@wordpress/escape-html': 'wp.escapeHtml',
        '@wordpress/private-apis': 'wp.privateApis',
        '@wordpress/icons': 'wp.icons',
        '@wordpress/a11y': 'wp.a11y',
        '@wordpress/date': 'wp.date',
        '@wordpress/preferences': 'wp.preferences',
        '@wordpress/plugins': 'wp.plugins',
        '@wordpress/core-data': 'wp.coreData',
        '@wordpress/block-serialization-default-parser': 'wp.blockSerializationDefaultParser',
        '@wordpress/autop': 'wp.autop',
        '@wordpress/shortcode': 'wp.shortcode',
        '@wordpress/server-side-render': 'wp.serverSideRender',
        '@wordpress/style-engine': 'wp.styleEngine',
        '@wordpress/is-shallow-equal': 'wp.isShallowEqual',
        'jquery': 'jQuery',
    },
    optimization: {
        minimize: isProduction,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    compress: {
                        drop_console: isProduction,
                        drop_debugger: true,
                        pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
                    },
                    mangle: {
                        toplevel: false,
                        reserved: ['jQuery', '$', 'wp', 'ajaxurl'],
                        properties: false,
                    },
                    format: {
                        comments: false,
                    },
                },
                extractComments: false,
            }),
        ],
        splitChunks: {
            // Exclude bundles loaded standalone by WordPress (no awareness of
            // sibling chunk files): metabox, per-tool, per-module, per-layout,
            // and global-modal-init. Splitting them causes a silent runtime
            // failure — the dynamic import for the split-out chunk file fails
            // because WP never enqueued it, and webpack's __webpack_require__.O
            // defers the entry indefinitely with no console error.
            chunks: (chunk) =>
                chunk.name !== 'metabox' &&
                chunk.name !== 'global-modal-init' &&
                !chunk.name?.startsWith('tool-') &&
                !chunk.name?.startsWith('module-') &&
                !chunk.name?.startsWith('layout-'),
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: (chunk) =>
                        chunk.name !== 'metabox' &&
                        chunk.name !== 'global-modal-init' &&
                        !chunk.name?.startsWith('tool-') &&
                        !chunk.name?.startsWith('module-') &&
                        !chunk.name?.startsWith('layout-'),
                },
            },
        },
    },
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    mode: isProduction ? 'production' : 'development',
    watch: isDevelopment,
    watchOptions: {
        ignored: /node_modules/,
        poll: 1000,
    },
};

/**
 * Native Divi 5 module bundle.
 *
 * The native module package (PageBuilders/builders/Divi/native/) is built
 * as part of the plugin's own `npm run dev` / `npm run build` — there is no
 * separate build step. Its VB bundle is fundamentally different from every
 * other entry: it consumes Divi's own runtime (`@divi/*`), React, and a
 * couple of WordPress packages off the `window.divi` / `vendor` / `wp`
 * globals that Divi enqueues in the Visual Builder, so all of those are
 * webpack `externals` and never bundled. Because they're externals, the
 * `@divi/*` type packages are only needed for type-checking — we transpile
 * with `transpileOnly` and skip them at build time.
 *
 * Output lands directly in the package's committed artifact dirs under
 * `src/.../native/{build,styles,modules-json}`, and an afterEmit hook
 * mirrors those into `dist/`.
 *
 * IMPORTANT: this config is intentionally INDEPENDENT of the `main` config
 * — there is no `dependencies: ['divi-native']` coupling. webpack-cli runs
 * a multi-config array as a multi-compiler, and if one config errors the
 * whole run is treated as failed; with a dependency link, a failure (or
 * even a transient dist permission error) in this native config would leave
 * the main config's frontend bundles UNWRITTEN/STALE — which manifested as
 * gallery items stuck in `data-fg-media-state="loading"` because the
 * loading-icon JS never refreshed. Keeping the two configs decoupled means
 * a native-side problem can never break the front-end build. The dist
 * mirror below also makes this config self-sufficient, so it doesn't rely
 * on the main config's copy pass or any build ordering.
 */
const diviNativeBase = path.resolve(
    __dirname,
    'src/includes/modules/PageBuilders/builders/Divi/native'
);
const diviNativeDistBase = path.resolve(
    __dirname,
    'dist/includes/modules/PageBuilders/builders/Divi/native'
);

const diviNativeConfig = {
    name: 'divi-native',
    context: diviNativeBase,
    entry: {
        bundle: './src/index.ts',
    },
    externals: {
        // Third-party globals Divi already enqueues in the VB.
        jquery: 'jQuery',
        underscore: '_',
        lodash: 'lodash',
        react: ['vendor', 'React'],
        'react-dom': ['vendor', 'ReactDOM'],

        // WordPress runtime (read off Divi's `vendor.wp`).
        '@wordpress/i18n': ['vendor', 'wp', 'i18n'],
        '@wordpress/hooks': ['vendor', 'wp', 'hooks'],

        // Divi runtime packages (read off `window.divi`).
        '@divi/rest': ['divi', 'rest'],
        '@divi/data': ['divi', 'data'],
        '@divi/module': ['divi', 'module'],
        '@divi/module-utils': ['divi', 'moduleUtils'],
        '@divi/modal': ['divi', 'modal'],
        '@divi/field-library': ['divi', 'fieldLibrary'],
        '@divi/icon-library': ['divi', 'iconLibrary'],
        '@divi/module-library': ['divi', 'moduleLibrary'],
        '@divi/style-library': ['divi', 'styleLibrary'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        // The `@divi/*` types aren't installed (they're only
                        // needed for type-checking, and the runtime is an
                        // external), so transpile without type-checking.
                        transpileOnly: true,
                        compilerOptions: {
                            // Self-contained: don't depend on the package's
                            // tsconfig (which referenced the example repo).
                            jsx: 'react',
                            target: 'es2018',
                            module: 'esnext',
                            moduleResolution: 'node',
                            allowJs: true,
                            resolveJsonModule: true,
                            esModuleInterop: true,
                            allowSyntheticDefaultImports: true,
                            noImplicitAny: false,
                            skipLibCheck: true,
                        },
                    },
                },
            },
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env', '@babel/preset-react'],
                    },
                },
            },
            {
                test: /\.s?css$/i,
                use: [
                    MiniCssExtractPlugin.loader,
                    { loader: 'css-loader', options: { url: false, importLoaders: 2 } },
                    { loader: 'sass-loader', options: { api: 'modern', implementation: require('sass') } },
                ],
            },
        ],
    },
    optimization: {
        minimize: isProduction,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    compress: { drop_console: isProduction, drop_debugger: true },
                    format: { comments: false },
                },
                extractComments: false,
            }),
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '../styles/[name].css',
        }),
        // Emit `vb-bundle.css` as an identical sibling of `bundle.css`. The
        // runtime enqueues a separate VB stylesheet handle; here the VB and
        // front-end CSS are the same rules, so we duplicate the emitted asset
        // rather than maintain a second source file. If the two ever diverge,
        // split them into `style.scss` (VB) + `module.scss` (front end) and
        // route via MiniCssExtractPlugin filenames instead.
        {
            apply(compiler) {
                const { RawSource } = compiler.webpack.sources;
                compiler.hooks.thisCompilation.tap('FgDuplicateVbCss', (compilation) => {
                    compilation.hooks.processAssets.tap(
                        {
                            name: 'FgDuplicateVbCss',
                            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
                        },
                        (assets) => {
                            const src = '../styles/bundle.css';
                            const dst = '../styles/vb-bundle.css';
                            if (assets[src] && !assets[dst]) {
                                compilation.emitAsset(
                                    dst,
                                    new RawSource(assets[src].source())
                                );
                            }
                        }
                    );
                });
            },
        },
        new CopyWebpackPlugin({
            patterns: [
                {
                    // Compiled module metadata: copied from each component's
                    // module.json into modules-json/<name>/module.json, which
                    // is what the PHP side passes to register_module().
                    from: '**/module.json',
                    context: 'src/components',
                    to: path.resolve(diviNativeBase, 'modules-json'),
                },
            ],
        }),
        // Mirror the freshly-built artifacts from src/ into dist/ so the
        // plugin folder a Local site serves is self-contained, including
        // under `webpack --watch`. Runs on afterEmit (assets already on
        // disk). Failures here are swallowed with a warning so a dist
        // permission hiccup can never fail this config (which, in a
        // multi-compiler run, must never be allowed to take the front-end
        // build down with it).
        {
            apply(compiler) {
                compiler.hooks.afterEmit.tapPromise('FgMirrorNativeToDist', async () => {
                    for (const relDir of ['build', 'styles', 'modules-json']) {
                        const from = path.resolve(diviNativeBase, relDir);
                        const to = path.resolve(diviNativeDistBase, relDir);
                        if (!fs.existsSync(from)) continue;
                        try {
                            fs.rmSync(to, { recursive: true, force: true });
                            fs.mkdirSync(to, { recursive: true });
                            fs.cpSync(from, to, { recursive: true });
                        } catch (e) {
                            console.warn(
                                '[divi-native] could not mirror',
                                relDir,
                                'to dist (non-fatal):',
                                e.message
                            );
                        }
                    }
                });
            },
        },
    ],
    resolve: {
        extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    },
    output: {
        filename: '[name].js',
        path: path.resolve(diviNativeBase, 'build'),
        clean: false,
    },
    devtool: isProduction ? false : 'source-map',
    mode: isProduction ? 'production' : 'development',
    watch: isDevelopment,
    watchOptions: {
        ignored: /node_modules/,
        poll: 1000,
    },
    stats: { errorDetails: true },
};

module.exports = [mainConfig, diviNativeConfig];
