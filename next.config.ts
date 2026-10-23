import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["onnxruntime-node", "sharp"],
  outputFileTracingIncludes: {
    "/api/diagnose": [
      "./public/model/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**/*",
    ],
  },
  outputFileTracingExcludes: {
    "/api/diagnose": [
      "./node_modules/onnxruntime-node/bin/napi-v6/win32/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v6/darwin/**/*",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/arm64/**/*",
    ],
  },
};

export default nextConfig;