import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  turbopack: {},
  images: {
    unoptimized: true,
  },
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (!isServer) {
      // Fix: Cesium GLSL shaders contain octal escape sequences (\0) in strings.
      // If Terser or any minifier converts these to ES6 template literals,
      // browsers throw: "SyntaxError: Octal escape sequences are not allowed in template strings"
      // Solution: Set output ecma to 5 so template literals are never generated.
      const TerserPlugin = require("terser-webpack-plugin");
      config.optimization.minimizer = [
        new TerserPlugin({
          terserOptions: {
            ecma: 5,
            compress: {
              ecma: 5,
            },
            output: {
              ecma: 5,
              ascii_only: true,
            },
          },
        }),
      ];
    }

    return config;
  },
};

export default nextConfig;
