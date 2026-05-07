const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = !isProduction;

module.exports = {
    entry: {
        'admin': './src/assets/admin/src/index.js',
        'metabox': './src/assets/admin/src/metabox.js',
        'frontend': './src/assets/frontend/src/index.js',
        'lightbox': './src/assets/frontend/src/lightbox.js',
        'lightbox-styles': './src/assets/frontend/src/lightbox.scss',
        'collection-state-manager': './src/assets/admin/src/collection-state-manager.js',
        'ajax-save': './src/assets/admin/src/ajax-save.js',
        'album-assignment': './src/assets/admin/src/album-assignment.js',
        'album-galleries': './src/assets/admin/src/album-galleries.js',
        'templates-metabox': './src/assets/admin/src/templates-metabox.js',
        'global-modal-init': './src/assets/admin/src/global-modal-init.js',
        'admin-header': './src/assets/admin/src/admin-header.js',
        'upgrade-modal': './src/assets/admin/src/styles/upgrade-modal.scss',
        'codemirror-init': './src/assets/admin/src/codemirror-init.js',
        'dashboard-widget': './src/assets/admin/src/dashboard-widget.js',
        'dashboard-widget-styles': './src/assets/admin/src/styles/dashboard-widget.scss',
        'toast-init': './src/assets/admin/src/toast-init.js',
        'shortcode-column-init': './src/assets/admin/src/shortcode-column-init.js',
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'assets/js/[name].js',
        publicPath: 'auto',
        clean: true,
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js', '.jsx'],
        alias: {
            '@': path.resolve(__dirname, 'src/assets'),
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
            filename: 'assets/css/[name].css',
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: 'src/**/*.php',
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
                    from: 'src/config/**/*.json',
                    to: ({ context, absoluteFilename }) => {
                        const relativePath = path.relative(context, absoluteFilename);
                        return relativePath.replace('src/', '');
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
                        ignore: ['**/*.php'],
                    },
                },
                {
                    from: 'src/assets/admin/js/**/*',
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
        '@wordpress/media-utils': 'wp.mediaUtils',
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
            chunks: 'all',
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all',
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
