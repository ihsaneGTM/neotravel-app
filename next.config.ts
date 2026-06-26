import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit charge ses polices AFM depuis node_modules au runtime : ne pas le bundler.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
