import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/app/api-client';
import { PermissionLevel } from '../permissions';
import { useQuery } from '@tanstack/react-query';

export function usePermissions(guildId?: string) {
    const { user, loading: authLoading } = useAuth();

    // Fetch Guild Info (which includes calculated permission_level)
    const { data: guild, isLoading: guildLoading, error: guildError } = useQuery({
        queryKey: ['guild', guildId],
        queryFn: () => guildId ? apiClient.getGuild(guildId) : null,
        enabled: !!guildId && !!user,
        retry: 1, // Don't retry too much on 403
    });

    const currentPermissionLevel = (() => {
        if (!user) return PermissionLevel.PUBLIC;

        // Platform Admin Override
        if (user.is_admin) return PermissionLevel.DEVELOPER;

        // Global Context (No Guild ID) -> Logged in User = Level 2
        if (!guildId) return PermissionLevel.USER;

        // Valid Guild Context but failed to load or User not in guild (should be handled by query error usually)
        if (!guild) return PermissionLevel.PUBLIC;

        // Map backend string to Level
        // Backend returns: "owner", "ADMIN", "USER", "LEVEL_2"
        const pLevel = (guild as any).permission_level;

        if (pLevel === 'owner') return PermissionLevel.OWNER;
        if (pLevel === 'admin' || pLevel === 'ADMIN') return PermissionLevel.AUTHORIZED;
        if (pLevel === 'user' || pLevel === 'USER') return PermissionLevel.AUTHORIZED;
        if (pLevel === 'level_2' || pLevel === 'LEVEL_2') return PermissionLevel.USER;

        return PermissionLevel.USER; // Fallback for guild members
    })();

    const hasAccess = (requiredLevel: PermissionLevel) => {
        if (requiredLevel <= PermissionLevel.PUBLIC_DATA) return true;
        if (!user) return false;

        // If developer, generally allow? (Not implemented in backend yet, but we can flag it if user.is_developer)
        // For now, rely on calculated level.
        return currentPermissionLevel >= requiredLevel;
    };

    return {
        permissionLevel: currentPermissionLevel,
        hasAccess,
        loading: authLoading || (!!guildId && guildLoading),
        error: guildError,
        guild
    };
}
