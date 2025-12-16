'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePermissions } from '../hooks/use-permissions';
import { PermissionLevel } from '../permissions';
import { useAuth } from '@/lib/auth-context';

export function withPermission<P extends object>(
    Component: React.ComponentType<P>,
    requiredLevel: PermissionLevel
) {
    return function WithPermissionComponent(props: P) {
        const params = useParams();
        const router = useRouter();
        const guildId = params?.guildId as string | undefined;

        // Use hook
        const { hasAccess, loading, error } = usePermissions(guildId);
        const { user, loading: authLoading } = useAuth();

        useEffect(() => {
            if (!loading && !authLoading) {
                // If level is public, we are fine.
                if (requiredLevel <= PermissionLevel.PUBLIC_DATA) return;

                // If user not logged in and L2+ required -> Redirect Login
                if (!user) {
                    router.push('/login');
                    return;
                }

                // If logged in but no access -> Redirect Access Denied
                if (!hasAccess(requiredLevel)) {
                    // Check if it was an error (403) or just level mismatch
                    // API returns 403 if totally denied.
                    // If we have "LEVEL_2" but need "AUTHORIZED", hasAccess returns false.
                    router.push('/access-denied');
                }
            }
        }, [loading, authLoading, hasAccess, requiredLevel, router, user]);

        if (loading || authLoading) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                    <div className="animate-pulse">Checking Permissions...</div>
                </div>
            );
        }

        // If we have access, render
        // Note: useEffect handles redirect, but we might render briefly.
        // If we want strict guard, return null if no access.
        if (requiredLevel > PermissionLevel.PUBLIC_DATA && !user) return null;
        if (requiredLevel > PermissionLevel.PUBLIC_DATA && !hasAccess(requiredLevel)) return null;

        return <Component {...props} />;
    };
}
