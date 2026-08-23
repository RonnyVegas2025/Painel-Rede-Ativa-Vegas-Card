import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
  // typedRoutes fica desligado: NAV_ITEMS monta href dinamicamente e o tipo Route
  // exigiria literais. Reavaliar quando as rotas estiverem estaveis.
};

export default nextConfig;
