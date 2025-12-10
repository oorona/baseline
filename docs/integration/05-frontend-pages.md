# Adding Frontend Pages

This guide explains how to add new pages and components to the Next.js frontend.

## Overview

The frontend uses:
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **React Hooks** for state management

## Step 1: Create a New Page

Pages are created in the `frontend/app/` directory using the App Router structure.

### Simple Page

```typescript
// frontend/app/custom/page.tsx
'use client';

export default function CustomPage() {
    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold">Custom Feature</h1>
            <p className="text-gray-400">Your custom content here</p>
        </div>
    );
}
```

Access at: `http://localhost:3000/custom`

### Page with Data Fetching

```typescript
'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/app/api-client';

export default function FeaturesPage() {
    const [features, setFeatures] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFeatures = async () => {
            try {
                const data = await apiClient.getCustomFeatures();
                setFeatures(data);
            } catch (error) {
                console.error('Failed to load features:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchFeatures();
    }, []);

    if (loading) {
        return <div className="p-8">Loading...</div>;
    }

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-4">Features</h1>
            <ul>
                {features.map((feature) => (
                    <li key={feature.id} className="mb-2">
                        {feature.name}
                    </li>
                ))}
            </ul>
        </div>
    );
}
```

## Step 2: Add API Client Methods

Update `frontend/app/api-client.ts`:

```typescript
class APIClient {
    // ... existing methods ...
    
    async getCustomFeatures(guildId: string) {
        const response = await this.client.get(`/guilds/${guildId}/features`);
        return response.data;
    }
    
    async createCustomFeature(guildId: string, data: any) {
        const response = await this.client.post(`/guilds/${guildId}/features`, data);
        return response.data;
    }
    
    async deleteCustomFeature(guildId: string, featureId: string) {
        const response = await this.client.delete(`/guilds/${guildId}/features/${featureId}`);
        return response.data;
    }
}
```

## Step 3: Create Reusable Components

Create components in `frontend/components/` (you may need to create this directory):

```typescript
// frontend/components/FeatureCard.tsx
interface FeatureCardProps {
    name: string;
    description: string;
    onDelete: () => void;
}

export default function FeatureCard({ name, description, onDelete }: FeatureCardProps) {
    return (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-xl font-semibold mb-2">{name}</h3>
            <p className="text-gray-400 mb-4">{description}</p>
            <button
                onClick={onDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
            >
                Delete
            </button>
        </div>
    );
}
```

Use in your page:

```typescript
import FeatureCard from '@/components/FeatureCard';

export default function FeaturesPage() {
    const handleDelete = async (id: string) => {
        await apiClient.deleteCustomFeature(guildId, id);
        // Refresh features list
    };

    return (
        <div className="p-8">
            {features.map((feature) => (
                <FeatureCard
                    key={feature.id}
                    name={feature.name}
                    description={feature.description}
                    onDelete={() => handleDelete(feature.id)}
                />
            ))}
        </div>
    );
}
```

## Step 4: Add to Dashboard Navigation

Update `frontend/app/dashboard/layout.tsx` to add a link:

```typescript
{selectedGuild && (
    <div className="mt-4 pt-4 border-t border-gray-700">
        <Link
            href={`/dashboard/${selectedGuild}/custom-feature`}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700"
        >
            <Star className="w-5 h-5" />
            <span>Custom Feature</span>
        </Link>
    </div>
)}
```

## Step 5: Dynamic Routes

For guild-specific pages, use dynamic routes:

```typescript
// frontend/app/dashboard/[guildId]/custom/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function GuildCustomPage() {
    const params = useParams();
    const guildId = params.guildId as string;
    
    const [data, setData] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            const result = await apiClient.getCustomFeatures(guildId);
            setData(result);
        };
        
        if (guildId) {
            fetchData();
        }
    }, [guildId]);

    return (
        <div className="p-8">
            <h1>Custom Page for Guild {guildId}</h1>
            {/* Your content */}
        </div>
    );
}
```

## Advanced Patterns

### Form Handling

```typescript
'use client';

import { useState } from 'react';
import { Save } from 'lucide-react';

export default function CreateFeaturePage() {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            await apiClient.createCustomFeature(guildId, {
                name,
                description
            });
            
            setMessage('Feature created successfully!');
            setName('');
            setDescription('');
        } catch (error) {
            setMessage('Failed to create feature');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Create Feature</h1>
            
            {message && (
                <div className="p-4 rounded-lg mb-6 bg-green-500/10 text-green-400">
                    {message}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-2">
                        Feature Name
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">
                        Description
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3"
                    />
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {saving ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-5 h-5" />
                            Create Feature
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
```

### Protected Routes

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function ProtectedPage() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading || !user) {
        return <div>Loading...</div>;
    }

    return <div>Protected content</div>;
}
```

### Real-time Updates

```typescript
'use client';

import { useState, useEffect } from 'react';

export default function RealtimePage() {
    const [data, setData] = useState([]);

    useEffect(() => {
        // Poll for updates every 5 seconds
        const interval = setInterval(async () => {
            const updated = await apiClient.getCustomFeatures(guildId);
            setData(updated);
        }, 5000);

        return () => clearInterval(interval);
    }, [guildId]);

    return (
        <div className="p-8">
            {/* Your data display */}
        </div>
    );
}
```

## Styling with Tailwind

Common utility classes:

```typescript
// Layout
<div className="p-8">                    {/* Padding */}
<div className="max-w-2xl mx-auto">      {/* Centered container */}
<div className="space-y-6">              {/* Vertical spacing */}
<div className="grid grid-cols-2 gap-4"> {/* Grid layout */}

// Colors (dark theme)
<div className="bg-gray-800">            {/* Background */}
<div className="text-white">             {/* Text */}
<div className="border border-gray-700"> {/* Border */}

// Buttons
<button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">

// Forms
<input className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500">
```

## Best Practices

1. **Use TypeScript**: Define interfaces for your data
   ```typescript
   interface Feature {
       id: string;
       name: string;
       description: string;
       created_at: string;
   }
   ```

2. **Handle Loading States**: Show loading indicators
3. **Handle Errors**: Display error messages to users
4. **Use Client Components**: Add `'use client'` for interactive features
5. **Optimize Images**: Use Next.js `Image` component
6. **Keep Components Small**: Break down into reusable pieces
7. **Use Consistent Styling**: Follow the existing design patterns

## Next Steps

- See `docs/integration/04-backend-endpoints.md` to create APIs
- Review existing pages in `frontend/app/dashboard/`
- Read [Next.js documentation](https://nextjs.org/docs)
