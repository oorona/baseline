'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/app/api-client';
import { UserPlus, Trash2 } from 'lucide-react';
import { UserSearch } from '@/app/components/UserSearch';

interface AuthorizedUser {
    user_id: string; // Updated to match API client (snowflake ID)
    username?: string;
    discriminator?: string;
    avatar_url?: string;
    permission_level: string;
    created_at: string;
}

export default function PermissionsPage() {
    const params = useParams();
    const guildId = params.guildId as string;

    const [users, setUsers] = useState<AuthorizedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newUserId, setNewUserId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [adding, setAdding] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, [guildId]);

    const fetchUsers = async () => {
        try {
            const data = await apiClient.getAuthorizedUsers(guildId);
            setUsers(data);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async () => {
        if (!newUserId.trim()) return;

        setAdding(true);
        setError(null);

        try {
            await apiClient.addAuthorizedUser(guildId, newUserId);
            // Clear both ID and Search Query on success
            setNewUserId('');
            setSearchQuery('');
            await fetchUsers();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to add user');
        } finally {
            setAdding(false);
        }
    };

    const handleRemoveUser = async (userId: string) => {
        // if (!confirm('Are you sure you want to remove this user?')) return;

        try {
            await apiClient.removeAuthorizedUser(guildId, userId.toString());
            await fetchUsers();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to remove user');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-gray-400">Loading permissions...</div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Permission Management</h1>
                <p className="text-gray-400">Manage who can access the dashboard</p>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500">
                    {error}
                </div>
            )}

            {/* Add user form */}
            <div className="bg-gray-800 rounded-lg p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Add Authorized User</h2>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <UserSearch
                            guildId={guildId}
                            value={searchQuery}
                            onChange={(val) => {
                                setSearchQuery(val);
                                // If user clears input, clear the ID too
                                if (!val) setNewUserId('');
                            }}
                            onSelect={(user) => {
                                setNewUserId(user.id);
                                setSearchQuery(user.username);
                            }}
                            placeholder="Search by username..."
                        />
                    </div>
                    <button
                        onClick={handleAddUser}
                        disabled={!newUserId || adding}
                        className="flex items-center space-x-2 px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <UserPlus size={16} />
                        <span>{adding ? 'Adding...' : 'Add User'}</span>
                    </button>
                </div>
            </div>

            {/* Users list */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="p-6 border-b border-gray-700">
                    <h2 className="text-xl font-semibold">Authorized Users</h2>
                </div>
                <div className="divide-y divide-gray-700">
                    {users.length === 0 ? (
                        <div className="p-6 text-center text-gray-400">
                            No authorized users found
                        </div>
                    ) : (
                        users.map((user) => (
                            <div key={user.user_id} className="flex items-center justify-between p-6 hover:bg-gray-700/50">
                                <div className="flex items-center">
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} alt={user.username} className="w-10 h-10 rounded-full mr-4" />
                                    ) : (
                                        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center mr-4">
                                            <span className="text-gray-400 text-sm">?</span>
                                        </div>
                                    )}
                                    <div>
                                        <div className="font-medium">{user.username || `User ID: ${user.user_id}`}</div>
                                        <div className="text-sm text-gray-400">
                                            {user.permission_level} • Added {new Date(user.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveUser(user.user_id)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-red-600/20 text-red-500 rounded-lg hover:bg-red-600/30 transition-colors"
                                >
                                    <Trash2 size={16} />
                                    <span>Remove</span>
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
