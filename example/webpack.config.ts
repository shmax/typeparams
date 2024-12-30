import { Configuration } from "webpack";
import path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import "webpack-dev-server"; // For types

const config: Configuration = {
    mode: "development",
    entry: "./src/index.ts", // Entry point
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "dist"),
        clean: true,
    },
    devtool: "inline-source-map", // Helpful for debugging
    devServer: {
        static: "./dist",
        port: 3000, // Local server port
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [
                    {
                        loader: "babel-loader",
                        options: {
                            presets: ["@babel/preset-env", "@babel/preset-typescript"],
                            sourceMaps: true,
                        },
                    },
                ],
                include: [
                    path.resolve(__dirname, "src"), // Include example files
                    path.resolve(__dirname, "../src"), // Include shared code
                ],
                exclude: /node_modules/,
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: "index.html", // Use an HTML template
        }),
    ],
};

export default config;