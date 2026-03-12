/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        instrumentationHook: true,
    },
    // Increase API route body size limits
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
        responseLimit: '10mb',
    },
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
