# Security Model & Plugin Development Guide

This document outlines the security architecture for the platform, defining how access control works from the database level up to the frontend UI. It also provides guidelines for developers and LLMs on how to create new pages and plugins that adhere to this security model.

## Security Levels (0-5)

We use a granular 6-level security model to manage access to guilds and features.

| Level | Name | Description | Example Usage |
| :--- | :--- | :--- | :--- |
| **0** | **Public** | Accessible by anyone, no login required. | Landing Page, Login Page. |
| **1** | **Public Data** | Accessible by anyone via specific link, no login required. | Shared Charts, Status Widgets. |
| **2** | **User (Login Required)** | Requires login. Access determined by Guild Settings (Default: Everyone allowed). | Basic Dashboard, Leaderboards. |
| **3** | **Authorized** | specialized access. Requires specific Authorization (Role or User). **Strictly Controlled**. | Bot Settings, Moderation Tools. |
| **4** | **Owner** | Guild Owner only. | Permission Management, Sensitive Config. |
| **5** | **Developer** | Platform Administrators. Full access to everything. | Debug Tools, System Config. |

### Level 2 (User) Behavior
- By default, `level_2_allow_everyone` is **TRUE** for a guild. This means any member of the guild can view Level 2 pages.
- Owners can toggle this to **FALSE** and specify `level_2_roles`. Only users with these roles will have access.

### Level 3 (Authorized) Behavior
- Requires explicit authorization.
- Users can be authorized directly (Authorized Users).
- Roles can be authorized (Authorized Roles).
- **Constraint**: The `@everyone` role cannot be authorized for Level 3 access.

---

## Developing Plugins & Pages

When creating new pages or plugins, you must explicitly define the required security level.

### 1. Frontend Implementation

We use a High-Order Component (HOC) `withPermission` to protect pages.

**Example: Creating a Level 2 Page (General Dashboard)**
```typescript
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';

function MyDashboardPage() {
    return <div>My Dashboard Content</div>;
}

// Wrap export
export default withPermission(MyDashboardPage, PermissionLevel.USER);
```

**Example: Creating a Level 3 Page (Settings)**
```typescript
import { withPermission } from '@/lib/components/with-permission';
import { PermissionLevel } from '@/lib/permissions';

function MySettingsPage() {
    return <div>Sensitive Settings</div>;
}

// Wrap export
export default withPermission(MySettingsPage, PermissionLevel.AUTHORIZED);
```

### 2. Sidebar / Navigation

When adding items to the Sidebar, specify the `level` property in the navigation item.

```typescript
const navigation = [
    { 
        name: 'My Page', 
        href: '/dashboard/[guildId]/my-page', 
        icon: MyIcon, 
        level: PermissionLevel.USER // determines visibility
    }
];
```

### 3. Backend Endpoints

Ensure your backend endpoints also enforce permissions. The `read_guild` logic automatically calculates `permission_level` for the context, but specific actions should verify it.

**Example (FastAPI):**
```python
@router.post("/my-action")
async def my_action(
    guild_id: int, 
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify permission
    # (Implementation of helper function `check_permission` is recommended)
    pass
```

## Troubleshooting

- **403 Access Denied**: Check if the user has the required role.
- **Sidebar item missing**: Check if the `level` matches the user's calculated permission level.
- **"Loading permissions..."**: The `usePermissions` hook is fetching guild data.

## Best Practices

- **Default to strict**: If unsure, use Level 3 (Authorized).
- **Use Level 2 for read-only**: Dashboards, stats, and logs are good candidates for Level 2.
- **Use Level 3 for write**: Settings changes, moderation actions.
