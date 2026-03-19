/** @type {import('next').NextConfig} */
const nextConfig = {
    // instrumentationHook is enabled by default in Next.js 16 — no config needed
    // Prevents Next.js from 308-redirecting /api/v1/foo/ → /api/v1/foo before
    // the rewrite proxy can handle it. Without this, FastAPI's trailing-slash
    // redirect sends the browser to http://backend:8000/... (internal hostname).
    skipTrailingSlashRedirect: true,
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
