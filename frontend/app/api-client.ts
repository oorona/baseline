import axios, { AxiosError, AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface DiscordUser {
    id: string;
    username: string;
    discriminator: string;
    avatar_url: string;
    bot?: boolean;
    preferences?: UserSettings;
}

export interface UserSettings {
    theme?: 'light' | 'dark' | 'system';
    language?: 'en' | 'es';
    default_guild_id?: string;
}

export interface DiscordMember {
    id: string;
    username: string;
    discriminator: string;
    avatar_url: string | null;
    roles: string[];
}

export interface AuthorizedUser {
    user_id: string;
    permission_level: string;
    created_at: string;
}

class APIClient {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: `${API_BASE_URL}/api/v1`,
            headers: {
                'Content-Type': 'application/json',
            },
            withCredentials: true, // For session cookies
        });

        // Request interceptor
        this.client.interceptors.request.use(
            (config) => {
                // Get token from localStorage if it exists
                const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor
        this.client.interceptors.response.use(
            (response) => {
                // If login response contains session_id, store it
                if (response.config.url?.includes('/auth/discord/callback') && response.data.session_id) {
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('access_token', response.data.session_id);
                    }
                }
                return response;
            },
            async (error: AxiosError) => {
                if (error.response?.status === 401) {
                    // Unauthorized - clear token and redirect to login
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('access_token');
                        if (window.location.pathname !== '/login') {
                            window.location.href = '/login';
                        }
                    }
                } else if (error.response?.status === 403) {
                    // Forbidden - redirect to access denied page
                    if (typeof window !== 'undefined') {
                        if (window.location.pathname !== '/access-denied') {
                            window.location.href = '/access-denied';
                        }
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    // Auth endpoints
    async getCurrentUser() {
        const response = await this.client.get('/auth/me');
        return response.data;
    }

    async logout() {
        const response = await this.client.post('/auth/logout');
        if (typeof window !== 'undefined') {
            localStorage.removeItem('access_token');
        }
        return response.data;
    }

    // User Settings
    async getUserSettings() {
        const response = await this.client.get('/users/me/settings');
        return response.data;
    }

    async updateUserSettings(settings: UserSettings) {
        const response = await this.client.put('/users/me/settings', settings);
        return response.data;
    }

    // Guild endpoints
    async getGuilds() {
        const response = await this.client.get('/guilds');
        return response.data;
    }

    async getGuild(guildId: string) {
        const response = await this.client.get(`/guilds/${guildId}`);
        return response.data;
    }

    // Settings endpoints
    async getGuildSettings(guildId: string) {
        const response = await this.client.get(`/guilds/${guildId}/settings`);
        return response.data;
    }

    async updateGuildSettings(guildId: string, settings: Record<string, any>) {
        const response = await this.client.put(`/guilds/${guildId}/settings`, { settings });
        return response.data;
    }

    async getPlatformSettings() {
        const response = await this.client.get('/platform/settings');
        return response.data;
    }

    async updatePlatformSettings(settings: Record<string, any>) {
        const response = await this.client.put('/platform/settings', { settings });
        return response.data;
    }

    async getDbStatus() {
        const response = await this.client.get('/platform/db-status');
        return response.data;
    }

    async getFrontendStatus() {
        const response = await this.client.get('/platform/frontend-status');
        return response.data;
    }

    async getBackendStatus() {
        const response = await this.client.get('/platform/backend-status');
        return response.data;
    }

    async getGuildChannels(guildId: string) {
        const response = await this.client.get(`/guilds/${guildId}/channels`);
        return response.data;
    }

    async getGuildRoles(guildId: string): Promise<any[]> {
        const response = await this.client.get(`/guilds/${guildId}/roles`);
        return response.data;
    }

    async searchGuildMembers(guildId: string, query: string): Promise<any[]> {
        const response = await this.client.get(`/guilds/${guildId}/members/search`, {
            params: { query }
        });
        return response.data;
    }

    // Permission endpoints
    async getAuthorizedUsers(guildId: string): Promise<AuthorizedUser[]> {
        const response = await this.client.get(`/guilds/${guildId}/authorized-users`);
        return response.data;
    }

    async addAuthorizedUser(guildId: string, userId: string) {
        const response = await this.client.post(`/guilds/${guildId}/authorized-users`, { user_id: userId });
        return response.data;
    }

    async removeAuthorizedUser(guildId: string, userId: string) {
        const response = await this.client.delete(`/guilds/${guildId}/authorized-users/${userId}`);
        return response.data;
    }

    async getDiscordConfig(): Promise<{ client_id: string; redirect_uri: string }> {
        const response = await this.client.get('/auth/discord-config');
        return response.data;
    }

    async getAuditLogs(guildId: string) {
        const response = await this.client.get(`/guilds/${guildId}/audit-logs`);
        return response.data;
    }

    // Shard endpoints
    async getShards() {
        const response = await this.client.get('/shards');
        return response.data;
    }

    async getShardForGuild(guildId: string) {
        const response = await this.client.get(`/shards/${guildId}`);
        return response.data;
    }

    // Bot endpoints
    async getBotReport() {
        const response = await this.client.get('/bot/report');
        return response.data;
    }

    // Health check
    async healthCheck() {
        const response = await this.client.get('/health');
        return response.data;
    }
}

export const apiClient = new APIClient();
