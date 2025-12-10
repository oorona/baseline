'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function AccessDeniedContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get('error');

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white p-4">
            <div className="flex flex-col items-center max-w-md text-center space-y-6">
                <div className="rounded-full bg-red-500/10 p-6">
                    <ShieldAlert className="h-16 w-16 text-red-500" />
                </div>

                <h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>

                <p className="text-zinc-400 text-lg">
                    {error === 'access_denied'
                        ? "You cancelled the login or denied access to the bot."
                        : "You don't have permission to access this resource. If you believe this is an error, please contact an administrator."}
                </p>

                {error && error !== 'access_denied' && (
                    <p className="text-red-400 text-sm font-mono bg-red-950/30 px-2 py-1 rounded">
                        Error: {error}
                    </p>
                )}

                <div className="flex gap-4 pt-4">
                    <Link
                        href="/"
                        className="rounded-md bg-white px-6 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors"
                    >
                        Return Home
                    </Link>
                    <Link
                        href="/login"
                        className="rounded-md bg-zinc-800 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 transition-colors"
                    >
                        Try Again
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default function AccessDeniedPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AccessDeniedContent />
        </Suspense>
    );
}
