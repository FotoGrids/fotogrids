const path = require('path');
const fs = require('fs');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';

const terserOptions = (compress = {}) => ({
    compress: {
        drop_console: isProduction,
        drop_debugger: true,
        pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
        ...compress,
    },
    mangle: {
        toplevel: false,
        reserved: ['jQuery', '$', 'wp', 'ajaxurl', '__', '_x', '_n', '_nx'],
        properties: false,
    },
    format: {
        comments: /translators:/i,
    },
});

const PLAIN_ADMIN_SCRIPTS = /assets[\\/]admin[\\/]plain[\\/]/;

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
        'featured-image-picker': './src/assets/admin/src/featured-image-picker.js',
        'fotogrids-runtime': './src/public/render/internal/runtime/runtime.js',
        'deep-linking': './src/assets/frontend/src/deep-linking.js',
        'fg-tooltip': './src/public/render/fg-tooltip/fg-tooltip.js',
        'loading-icon': './src/public/render/features/loading-icon/loading-icon.js',
        'loading-icon-styles': './src/public/render/features/loading-icon/loading-icon.scss',
        'lightbox': './src/public/render/lightbox/classic/lightbox.js',
        'lightbox-styles': './src/public/render/lightbox/classic/lightbox.scss',
        'filter-ui': './src/public/render/filters/features/ui/filter-ui.js',
        'filter-ui-styles': './src/public/render/filters/features/ui/filter-ui.scss',
        'sharing': './src/public/render/decorators/sharing/sharing.js',
        'image-zoom': './src/public/render/decorators/image-zoom/image-zoom.js',
        'captions': './src/public/render/decorators/captions/captions.js',
        'password-gate': './src/public/render/gates/password/password-gate.js',
        'lazy-load': './src/public/render/features/lazy-load/lazy-load.js',
        'random-sort': './src/public/render/sorters/random/random-sort.js',
        'layout-justified': './src/public/render/layouts/justified/justified.js',
        'layout-masonry': './src/public/render/layouts/masonry/masonry.js',
        'layout-slider': './src/public/render/layouts/slider/slider.js',
        'layout-image-viewer': './src/public/render/layouts/image-viewer/image-viewer.js',
        'layout-single-item': './src/public/render/layouts/single-item/single-item.js',
        'stats': './src/public/render/features/stats/stats.js',
        'video-inline': './src/public/render/video/video-inline.js',
        'video-lightbox-mini': './src/public/render/video/video-lightbox-mini.js',
        'lightbox-mini': './src/public/render/lightbox/mini/lightbox-mini.js',
        'lightbox-grid': './src/public/render/lightbox/grid/lightbox-grid.js',
        'lightbox-mini-viewer': './src/public/render/lightbox/mini-viewer/lightbox-mini-viewer.js',
        'formatted-text': './src/public/render/formatted-text/formatted-text.js',
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
        'error-boundary': './src/assets/admin/src/styles/error-boundary.scss',
        // Shared component styles for page-builder editors (the `fotogrids-fg-shared` handle).
        'fg-shared-styles': './src/assets/admin/src/styles/fg-shared/fg-shared.scss',
        'dashboard-widget': './src/assets/admin/src/dashboard-widget.js',
        'dashboard-widget-styles': './src/assets/admin/src/styles/dashboard-widget.scss',
        'toast-init': './src/assets/admin/src/toast-init.js',
        'shortcode-column-init': './src/assets/admin/src/shortcode-column-init.js',
        'ui-state-manager': './src/assets/admin/src/utils/ui-state-manager.js',
        'deactivation-feedback': './src/assets/admin/src/deactivation/deactivation-feedback.js',
        'fg-modal-styles': './src/assets/admin/src/styles/fg-modal-standalone.scss',
        // Per-tool and per-module entries are discovered from the filesystem.
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
            '@shared': path.resolve(__dirname, 'src/shared'),
        },
    },
    module: {
        rules: [
            {
                // Type checking runs separately (npm run type-check).
                test: /\.tsx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                        compilerOptions: {
                            noEmit: false,
                            declaration: false,
                            declarationMap: false,
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
                        presets: ['@babel/preset-env', ['@babel/preset-react', { runtime: 'classic' }]],
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
                        // The native Divi build dirs are written to dist/ only by the `divi-native` config.
                        ignore: [
                            '**/.DS_Store',
                            '**/Divi/native/build/**',
                            '**/Divi/native/styles/**',
                            '**/Divi/native/modules-json/**',
                        ],
                    },
                },
                {
                    // Bundled watermark fonts (TTF + licences), copied verbatim.
                    from: 'src/assets/fonts/**/*',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                    globOptions: {
                        ignore: ['**/.DS_Store'],
                    },
                },
                {
                    // Formatting rules shared by the PHP and browser formatters.
                    from: 'src/shared/formatted-text/schema.json',
                    to: 'shared/formatted-text/schema.json',
                },
                {
                    from: 'src/includes/rest/templates/templates/**/*.json',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                },
                {
                    // Standalone diagnostics scripts, enqueued directly by PHP.
                    from: 'src/includes/diagnostics/assets/**/*.js',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                },
                {
                    // block.json metadata, read by register_block_type() from dist/.
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
                    // Production builds strip comments and whitespace from each icon's
                    // function string. Identifiers are preserved.
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
                {
                    from: 'src/fotogrids.php',
                    to: 'fotogrids.php',
                },
                {
                    from: 'src/readme.txt',
                    to: 'readme.txt',
                },
                {
                    from: 'src/license.txt',
                    to: 'license.txt',
                },
                {
                    from: 'src/index.php',
                    to: 'index.php',
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
                            '**/.DS_Store',
                            '**/*.php',
                            // The pricing page is disabled in the Freemius config.
                            '**/freemius/assets/js/pricing/**',
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
                },
                {
                    from: 'src/assets/admin/images/**/*',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                },
                {
                    // Bundled third-party admin vendor scripts (e.g. Chart.js), with their source maps.
                    from: 'src/assets/admin/vendor/**/*',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                },
                {
                    // Self-hosted admin web fonts (Poppins and JetBrains Mono).
                    from: 'src/assets/admin/fonts/**/*',
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
                    // No .js: every file under public/render is a webpack entry, or
                    // imported by one, and its output lands in assets/js/.
                    from: 'src/public/render/**/*.{css,svg,json}',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
                    },
                },
                {
                    from: 'src/languages/**/*',
                    to: 'languages/[name][ext]',
                    noErrorOnMissing: true,
                    globOptions: {
                        ignore: ['**/.DS_Store'],
                    },
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
                // Vendored libraries ship with their upstream source maps and are not re-minified.
                exclude: [/assets[\\/]admin[\\/]vendor[\\/]/, PLAIN_ADMIN_SCRIPTS],
                terserOptions: terserOptions(),
                extractComments: false,
            }),
            new TerserPlugin({
                include: PLAIN_ADMIN_SCRIPTS,
                terserOptions: terserOptions({ conditionals: false }),
                extractComments: false,
            }),
        ],
        splitChunks: {
            // Bundles WordPress enqueues standalone are never split: their split chunks
            // would not be enqueued.
            chunks: (chunk) =>
                chunk.name !== 'metabox' &&
                chunk.name !== 'featured-image-picker' &&
                chunk.name !== 'global-modal-init' &&
                chunk.name !== 'deactivation-feedback' &&
                chunk.name !== 'formatted-text' &&
                !chunk.name?.startsWith('tool-') &&
                !chunk.name?.startsWith('module-') &&
                !chunk.name?.startsWith('layout-'),
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: (chunk) =>
                        chunk.name !== 'metabox' &&
                        chunk.name !== 'featured-image-picker' &&
                        chunk.name !== 'global-modal-init' &&
                        chunk.name !== 'deactivation-feedback' &&
                        chunk.name !== 'formatted-text' &&
                        !chunk.name?.startsWith('tool-') &&
                        !chunk.name?.startsWith('module-') &&
                        !chunk.name?.startsWith('layout-'),
                },
            },
        },
    },
    devtool: isProduction ? false : 'eval-source-map',
    mode: isProduction ? 'production' : 'development',
    watchOptions: {
        ignored: /node_modules/,
        poll: 1000,
    },
};

/**
 * Native Divi 5 module bundle.
 *
 * Output lands directly in the package's committed artifact dirs under
 * `src/.../native/{build,styles,modules-json}`, and an afterEmit hook
 * mirrors those into `dist/`.
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
                        // The `@divi/*` types are not installed, so transpile without type-checking.
                        transpileOnly: true,
                        compilerOptions: {
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
                        presets: ['@babel/preset-env', ['@babel/preset-react', { runtime: 'classic' }]],
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
        // Emit `vb-bundle.css` as an identical copy of `bundle.css`.
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
                    // Each component's module.json, copied to modules-json/<name>/module.json.
                    from: '**/module.json',
                    context: 'src/components',
                    to: path.resolve(diviNativeBase, 'modules-json'),
                },
            ],
        }),
        // Mirror the built artifacts from src/ into dist/. Failures only warn.
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
        alias: {
            '@': path.resolve(__dirname, 'src/assets'),
        },
    },
    output: {
        filename: '[name].js',
        path: path.resolve(diviNativeBase, 'build'),
        clean: false,
    },
    devtool: isProduction ? false : 'source-map',
    mode: isProduction ? 'production' : 'development',
    watchOptions: {
        ignored: /node_modules/,
        poll: 1000,
    },
    stats: { errorDetails: true },
};

module.exports = [mainConfig, diviNativeConfig];
