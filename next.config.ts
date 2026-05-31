import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    N8N_MCP_SERVER_URL: process.env.N8N_MCP_SERVER_URL,
    N8N_MCP_ENABLED: process.env.N8N_MCP_ENABLED,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
