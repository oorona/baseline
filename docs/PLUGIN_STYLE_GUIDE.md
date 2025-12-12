# Plugin Style Guide

To ensure a seamless user experience, all plugins MUST adhere to the following styling guidelines.

## 1. Zero Hardcoded Colors
**NEVER** use hardcoded hex codes or generic color names (e.g., `bg-white`, `text-black`, `bg-gray-800`).
Always use the semantic tokens provided by the design system. This ensures your plugin supports:
- Light Mode
- Dark Mode
- Future Themes

| Element | Use This Token | Do NOT Use |
| :--- | :--- | :--- |
| **Page Background** | `bg-background` | `bg-white`, `bg-gray-900` |
| **Card/Panel** | `bg-card` | `bg-white`, `bg-zinc-800` |
| **Main Text** | `text-foreground` | `text-black`, `text-white` |
| **Secondary Text** | `text-muted-foreground` | `text-gray-500`, `text-gray-400` |
| **Borders** | `border-border` | `border-gray-200`, `border-gray-700` |
| **Primary Action** | `bg-primary`, `text-primary-foreground` | `bg-blue-600`, `text-white` |
| **Destructive Action** | `bg-destructive`, `text-destructive-foreground` | `bg-red-600`, `text-white` |
| **Input Fields** | `bg-background`, `border-input`, `ring-ring` | `bg-gray-50`, `border-gray-300` |

## 2. Layout & Structure
- **Page Container**: Use `p-8` padding for main views.
- **Section Headers**: Use `text-2xl font-bold mb-4` for page titles.
- **Cards**: Use `bg-card rounded-xl border border-border p-6` for content grouping.
- **Grids**: Use `grid grid-cols-1 md:grid-cols-2 gap-6` for responsive layouts.

## 3. UI Components
### Buttons
```tsx
// Primary
<button className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg">
  Save
</button>

// Secondary/Outline
<button className="border border-input bg-background hover:bg-accent hover:text-accent-foreground px-4 py-2 rounded-lg">
  Cancel
</button>

// Destructive
<button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2 rounded-lg">
  Delete
</button>
```

### Alerts
```tsx
<div className="bg-destructive/15 text-destructive p-4 rounded-lg flex items-center gap-2">
  <AlertCircle className="w-5 h-5" />
  <span>Error message here</span>
</div>
```

## 4. Icons
Use `lucide-react` for all icons.
- Size: Default to `w-5 h-5` or 20px.
- Color: Inherit from text color (e.g. `text-muted-foreground`).

## 5. Typography
- **Headings**: `font-bold` tracking-tight.
- **Body**: `tex-sm` or `text-base` leading-relaxed.
- **Code**: `font-mono text-xs bg-muted p-1 rounded`.

## Checklist Before Commit
- [ ] No hex codes found in source.
- [ ] Dark mode toggle works and looks correct.
- [ ] Light mode contrast is sufficient.
- [ ] Components resize correctly on mobile.
