/** @type {import('next').NextConfig} */
const nextConfig = {
    // instrumentationHook is enabled by default in Next.js 16 — no config needed
    async rewrites() {
        return [
            {
                source: '/api/v1/:path*',
                destination: 'http://backend:8000/api/v1/:path*' // Proxy to Backend Service
            }
        ];
    }
};

export default nextConfig;
