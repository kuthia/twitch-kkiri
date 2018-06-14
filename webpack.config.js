const path = require('path')
var srcPath = path.join(__dirname, 'src')

module.exports = {
		module: {
			rules: [
				{
					test: /\.js$/,
					exclude: /node_modules/,
					loader: 'babel-loader',

					options: {
						presets: ['env', 'es2015']
					}
				},
				{
					test: /\.css$/,

					use: [
						{
							loader: 'css-loader',

							options: {
								sourceMap: true
							}
						}
					]
				}
			]
		},

		devServer: {
			hot: true,
			filename: 'bundle.js',
			publicPath: '/',
			historyApiFallback: true,
			contentBase: path.join(srcPath, 'public')
		},

		plugins: [
		],

		optimization: {
			minimize: true,
			runtimeChunk: true,
			splitChunks: {
				chunks: "async",
				minSize: 1000,
				minChunks: 2,
				maxAsyncRequests: 5,
				maxInitialRequests: 3,
				name: true,
				cacheGroups: {
					default: {
						minChunks: 1,
						priority: -20,
						reuseExistingChunk: true,
					},
					vendors: {
						test: /[\\/]node_modules[\\/]/,
						priority: -10
					}
				}
			}
		},

		entry: {
			public: path.join(__dirname, 'public', 'js', 'app.js')
		},

		output: {
			filename: '[name].[chunkhash].js',
			path: path.resolve(__dirname, 'dist')
		},

		mode: 'production',
		devtool: '#source-map'
	};
