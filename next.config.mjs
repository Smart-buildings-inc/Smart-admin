/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three.js ships ESM; transpile its react bindings for the App Router.
  transpilePackages: ["three", "@phosphor-icons/react"],
};

export default nextConfig;
