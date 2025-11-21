import axios, { AxiosError, AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

    // Permission endpoints
    async getAuthorizedUsers(guildId: string) {
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

    // Shard endpoints
    async getShards() {
        const response = await this.client.get('/shards');
        return response.data;
    }

    async getShardForGuild(guildId: string) {
        const response = await this.client.get(`/shards/${guildId}`);
        return response.data;
    }

    // Health check
    async healthCheck() {
        const response = await this.client.get('/health');
        return response.data;
    }
}

export const apiClient = new APIClient();
