# Multilingual Framework Guide

This document is **required reading** for any developer adding new pages,
cards, or UI components to this project.  Every user-visible string must go
through the i18n system — hardcoded English text is considered a bug.

---

## Table of Contents

1. [How it works](#how-it-works)
2. [Language resolution order](#language-resolution-order)
3. [Using translations in a component](#using-translations-in-a-component)
4. [Adding new translation keys](#adding-new-translation-keys)
5. [Adding a new language](#adding-a-new-language)
6. [Adding a new dashboard card](#adding-a-new-dashboard-card)
7. [Interpolation (dynamic values)](#interpolation-dynamic-values)
8. [Fallback behaviour](#fallback-behaviour)
9. [File map](#file-map)
10. [Checklist for new features](#checklist-for-new-features)

---

## How it works

The i18n system is a lightweight, zero-dependency implementation built on React
Context.  It lives entirely in `frontend/lib/i18n/`.

```
lib/i18n/
  index.tsx                  ← LanguageProvider + useTranslation hook
  translations/
    en.ts                    ← English strings (source of truth)
    es.ts                    ← Spanish strings (mirrors en.ts exactly)
```

**`LanguageProvider`** wraps the entire application in `app/layout.tsx`.
It reads the active language from:
1. `user.preferences.language` (after login, from the backend database)
2. `localStorage['language']` (persisted across page reloads for guests)
3. Defaults to **`'es'`** (Spanish) for unauthenticated visitors

**`useTranslation()`** is a React hook available in any client component.
It returns `{ t, language, setLanguage }`.

---

## Language resolution order

| Situation | Language used |
|-----------|---------------|
| User not logged in, first visit | **Spanish** (default) |
| User not logged in, switched via header toggle | Stored language in localStorage |
| User just logged in | `user.preferences.language` from backend |
| User saves Account Settings | Saved preference (backend + localStorage) |

The header `EN | ES` toggle is always visible — even to guests — so users can
switch without logging in.

---

## Using translations in a component

```tsx
'use client';

import { useTranslation } from '@/lib/i18n';

export function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('myFeature.title')}</h1>
      <p>{t('myFeature.description')}</p>
      <p>{t('myFeature.greeting', { username: 'Alice' })}</p>
    </div>
  );
}
```

### Rules

- **Always** call `useTranslation()` at the top of the component, not inside
  loops or conditionals.
- **Never** concatenate translated strings with `+`.  Use interpolation
  placeholders (`{variable}`) instead so translators can reorder words.
- **Never** hardcode user-visible strings as JSX text or attribute values.
  `title`, `aria-label`, `placeholder`, `alt`, button text — all must use `t()`.

---

## Adding new translation keys

### 1. Add the key to `en.ts`

Open `frontend/lib/i18n/translations/en.ts` and add your key inside the
appropriate namespace object.  If no namespace fits, create a new one.

```ts
// en.ts
export const en = {
  // ... existing keys ...

  myFeature: {
    title: 'My New Feature',
    description: 'This feature does something useful.',
    greeting: 'Hello, {username}!',   // {variable} is interpolated at runtime
  },
} as const;
```

### 2. Add the same key to `es.ts`

Open `frontend/lib/i18n/translations/es.ts` and add the Spanish equivalent.
The TypeScript type `TranslationSchema` (imported from `en.ts`) will show a
**compile error** if the Spanish file is missing a key — this is intentional.

```ts
// es.ts
export const es: TranslationSchema = {
  // ... existing keys ...

  myFeature: {
    title: 'Mi nueva funcionalidad',
    description: 'Esta funcionalidad hace algo útil.',
    greeting: '¡Hola, {username}!',
  },
};
```

### 3. Use it in your component

```tsx
const { t } = useTranslation();
<h1>{t('myFeature.title')}</h1>
<p>{t('myFeature.greeting', { username: user.username })}</p>
```

---

## Adding a new language

1. Create `frontend/lib/i18n/translations/<lang>.ts`.
   Import `TranslationSchema` from `en.ts` and implement every key.

2. Import it in `frontend/lib/i18n/index.tsx` and add it to `translationMap`:
   ```ts
   import { fr } from './translations/fr';
   const translationMap: Record<Language, TranslationSchema> = { en, es, fr };
   ```

3. Extend the `Language` union type in the same file:
   ```ts
   export type Language = 'en' | 'es' | 'fr';
   ```

4. Add the language option to `LanguageSwitcher.tsx`:
   ```ts
   const LANGUAGES = [
     { code: 'en', label: 'EN' },
     { code: 'es', label: 'ES' },
     { code: 'fr', label: 'FR' },   // ← add here
   ];
   ```

5. Add the `<option>` to the language `<select>` in
   `app/dashboard/account/page.tsx`.

6. Update the backend `UserSettings.language` type if it uses an enum.

---

## Adding a new dashboard card

Dashboard cards are defined in `app/page.tsx`.  Each card has a `title` and
`description` that must be translated.

### 1. Add translation keys

```ts
// en.ts — inside the `dashboard` namespace
cardMyFeatureTitle: 'My Feature',
cardMyFeatureDesc: 'Short description of what this feature does.',

// es.ts — matching key
cardMyFeatureTitle: 'Mi funcionalidad',
cardMyFeatureDesc: 'Descripción breve de lo que hace esta funcionalidad.',
```

### 2. Reference keys in the card definition

```tsx
// app/page.tsx — inside the `cards` array
{
  id: 'my-feature',
  title: t('dashboard.cardMyFeatureTitle'),
  description: t('dashboard.cardMyFeatureDesc'),
  icon: MyIcon,
  href: `/dashboard/${activeGuildId}/my-feature`,
  level: PermissionLevel.AUTHORIZED,
  color: 'text-teal-500',
  bgColor: 'bg-teal-500/10',
  borderColor: 'group-hover:border-teal-500/50',
  isAdminOnly: false,
},
```

---

## Interpolation (dynamic values)

Use `{variableName}` placeholders inside translation strings.

```ts
// en.ts
greeting: 'Welcome, {username}! You have {count} notifications.',
```

```tsx
// component
t('greeting', { username: user.username, count: String(notifCount) })
```

All interpolation values must be strings.  Convert numbers with `String()`.

> **Do not** build translated sentences by concatenating `t()` calls:
> ```tsx
> // ❌ Wrong — breaks word order in other languages
> t('you') + ' ' + t('are') + ' ' + t('authorised')
>
> // ✅ Correct — one key, interpolation for dynamic parts
> t('auth.authorised', { role: 'Owner' })
> ```

---

## Fallback behaviour

| Condition | Result |
|-----------|--------|
| Key exists in active language | Translated string |
| Key missing in active language | Falls back to English |
| Key missing in both | Returns the raw key string (visible as a bug signal) |

The raw-key fallback makes missing translations immediately visible during
development.  Always fix missing keys before shipping.

---

## File map

| File | Purpose |
|------|---------|
| `lib/i18n/index.tsx` | Context, provider, `useTranslation` hook |
| `lib/i18n/translations/en.ts` | English strings — source of truth |
| `lib/i18n/translations/es.ts` | Spanish strings — mirrors en.ts |
| `app/components/LanguageSwitcher.tsx` | EN \| ES toggle in the header |
| `app/layout.tsx` | Mounts `<LanguageProvider>` |
| `app/dashboard/account/page.tsx` | Language preference settings (saved to backend) |

---

## Checklist for new features

Before submitting a PR, verify:

- [ ] All user-visible strings use `t('namespace.key')` — no hardcoded text
- [ ] New keys added to **both** `en.ts` and `es.ts`
- [ ] `es.ts` compiles without TypeScript errors (it enforces `TranslationSchema`)
- [ ] Interpolation used for all dynamic values (usernames, counts, names)
- [ ] `aria-label`, `title`, `placeholder`, `alt` attributes also translated
- [ ] No translated strings are concatenated with `+`
- [ ] Tested with both `EN` and `ES` active via the header switcher
