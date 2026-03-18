/**
 * English (en) translations — source of truth for all translatable strings.
 *
 * DEVELOPER NOTE:
 *   Every user-visible string in the app must have an entry here AND in every
 *   other language file (e.g. es.ts).  The Spanish file mirrors this structure
 *   exactly.  If you add a key here you MUST add it to all other language files
 *   or the fallback will silently display the English string.
 *
 *   Keys are organised by page/feature namespace.  Use dot-notation when
 *   calling `t()`:  t('welcome.addToServer', { botName: '...' })
 *
 *   Interpolation placeholders use curly-brace syntax: {variableName}
 */
export const en = {
  // ── Shared across multiple pages ──────────────────────────────────────────
  common: {
    loading: 'Loading...',
    loadingDashboard: 'Loading dashboard...',
    checkingPermissions: 'Checking Permissions...',
    dashboard: 'Dashboard',
    saving: 'Saving...',
  },

  // ── Top navigation bar ────────────────────────────────────────────────────
  header: {
    admin: 'Admin',
    user: 'User',
    logoutTitle: 'Logout',
  },

  // ── /welcome (public landing page) ───────────────────────────────────────
  welcome: {
    addToServer: 'Add {botName} to Your Server',
    freeToUse: 'Free to use',
    easySetup: 'Easy setup',
    powerfulFeatures: 'Powerful features',
    operatorPrompt: 'Bot operator? Access the dashboard',
    loginWithDiscord: 'Login with Discord',
    noServersMessage:
      "Welcome, {username}! You don't have access to any configured servers yet. Add the bot to a server you own, or ask a server owner to authorize you.",
    goToDashboard: 'Go to Dashboard',
    openDashboard: 'Open Dashboard',
  },

  // ── /login ────────────────────────────────────────────────────────────────
  login: {
    loginFailed: 'Login Failed',
    rateLimitError: 'Too many login attempts. Please wait 5 minutes and try again.',
    discordError: 'Discord could not complete the login. Please try again.',
    unexpectedError: 'Something went wrong. Please try again in a moment.',
    serviceUnavailable: 'The service is temporarily unavailable. Please try again in a moment.',
    detailsLabel: 'Details: {details}',
    loggingIn: 'Logging in...',
    loginButton: 'Login with Discord',
    switchAccount: 'Switch Account',
    signInPrompt: 'Sign in with your Discord account to manage your server',
    popupBlocked: 'Popup was blocked. Please allow popups for this site and try again.',
    loading: 'Loading...',
  },

  // ── / (dashboard home — cards, permission sections) ──────────────────────
  dashboard: {
    manageServer: 'Manage {serverName}',
    welcomeUser: 'Welcome, {username}',
    selectTool:
      'Select a tool below to manage your server or view platform status.',
    currentPermission: 'Current Permission:',
    permDeveloper: 'Developer',
    permOwner: 'Owner',
    permAdministrator: 'Administrator',
    permAuthorized: 'Authorized',
    permUser: 'User',
    permGuest: 'Guest',
    accessRestricted: 'Access Restricted',
    noAccessBody: 'You do not have access to any tools for this server.',
    currentAccessLevel: 'Current Access Level: {level}',

    // Permission section headers + descriptions
    sectionPublicLabel: 'Public',
    sectionPublicDesc: 'Available to everyone, no account needed',
    sectionPublicDataLabel: 'Public Data',
    sectionPublicDataDesc: 'Public information — no login required',
    sectionUserLabel: 'User',
    sectionUserDesc: 'Available to logged-in server members',
    sectionAuthorizedLabel: 'Authorized',
    sectionAuthorizedDesc: 'Requires explicit server authorization',
    sectionAdministratorLabel: 'Administrator',
    sectionAdministratorDesc: 'Guild administrators — manage authorized users and roles',
    sectionOwnerLabel: 'Owner',
    sectionOwnerDesc: 'Server owner only',
    sectionDeveloperLabel: 'Developer',
    sectionDeveloperDesc: 'Platform administrator — full system access',

    // Dashboard card titles & descriptions
    // NOTE FOR DEVELOPERS: When you add a new card, add its title and
    // description keys here and in every language file.
    cardBotOverviewTitle: 'Bot Overview',
    cardBotOverviewDesc:
      'Learn what this bot can do — features, commands, and how to get started.',
    cardCommandRefTitle: 'Command Reference',
    cardCommandRefDesc:
      'Browse all available bot commands, their usage, parameters, and examples.',
    cardBotSettingsTitle: 'Bot Settings',
    cardBotSettingsDesc:
      'Configure general bot behavior, command prefix, and language settings.',
    cardPermissionsTitle: 'Permissions',
    cardPermissionsDesc:
      'Manage access levels, authorize users and roles for this server.',
    cardBotHealthTitle: 'Bot Health',
    cardBotHealthDesc:
      'Check if the bot is online — backend, database, and Discord gateway status.',
    cardAccountSettingsTitle: 'Account Settings',
    cardAccountSettingsDesc:
      'Manage your personal preferences, theme, and profile details.',
    cardAuditLogsTitle: 'Audit Logs',
    cardAuditLogsDesc:
      'Track all configuration changes and administrative actions in this server.',
    cardAiAnalyticsTitle: 'AI Analytics',
    cardAiAnalyticsDesc:
      'View LLM usage statistics, token consumption, and cost breakdowns.',
    cardSystemConfigTitle: 'System Configuration',
    cardSystemConfigDesc:
      'Manage all framework settings. Apply dynamic changes at runtime or configure static parameters.',
    cardDatabaseTitle: 'Database Management',
    cardDatabaseDesc:
      'Monitor connections, apply schema migrations, and validate database integrity.',
    cardInstrumentationTitle: 'Instrumentation',
    cardInstrumentationDesc:
      'Performance metrics, guild growth, card usage stats, and bot command analytics across all servers.',
    cardLlmConfigsTitle: 'LLM Configs',
    cardLlmConfigsDesc:
      'Manage output schemas and function sets for Gemini API calls. View call logs with token stats and cost.',
    cardPluginDesc: 'Plugin module',
    cardCardVisibilityTitle: 'Card Visibility',
    cardCardVisibilityDesc: 'Choose which cards are visible to users on this server. Customize the dashboard experience per server.',
  },

  // ── /dashboard/account ────────────────────────────────────────────────────
  account: {
    title: 'Account Settings',
    subtitle: 'Manage your personal preferences.',
    savedSuccess: 'Preferences saved successfully',
    savedError: 'Failed to save settings',
    loadingProfile: 'Loading profile...',
    sectionProfile: 'Profile',
    sectionDefaultServer: 'Default Server',
    startupServerLabel: 'Startup Server',
    noDefaultServer: 'No default server',
    startupServerHint:
      'This server will be selected automatically when you enter the dashboard.',
    sectionAppearance: 'Appearance',
    themeLabel: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    sectionLanguage: 'Language',
    interfaceLanguageLabel: 'Interface Language',
    langHintEs: 'La interfaz cambiará a español.',
    langHintEn: 'The interface will change to English.',
    saveButton: 'Save Preferences',
    saving: 'Saving...',
    firstLoginTitle: 'Welcome! Choose your language',
    firstLoginMessage:
      'This is your first time here. Select the language you want to use for the interface, then save to continue.',
    firstLoginSkip: 'Skip for now',
    continueButton: 'Continue to Dashboard',
  },

  // ── /commands ─────────────────────────────────────────────────────────────
  commands: {
    title: 'Command Reference',
    subtitle: 'All available bot commands, organized by module.',
    refreshButton: 'Refresh from Cogs',
    refreshing: 'Refreshing...',
    lastUpdated: 'Last synced: {date}',
    neverSynced: 'Never synced',
    noCommands: 'No commands found.',
    noCommandsHint: 'Developers: use the Refresh button to import commands from cog definitions.',
    usageLabel: 'Usage',
    examplesLabel: 'Examples',
    refreshSuccess: 'Commands refreshed successfully.',
    refreshError: 'Failed to refresh commands.',
    commandCount: '{count} commands',
  },

  // ── /dashboard/[guildId]/card-visibility ──────────────────────────────────
  cardVisibility: {
    title: 'Card Visibility',
    subtitle: 'Choose which cards users see in the dashboard for this server.',
    saveButton: 'Save Settings',
    saving: 'Saving...',
    savedSuccess: 'Visibility settings saved.',
    savedError: 'Failed to save settings.',
    loadingError: 'Failed to load visibility settings.',
    offByDefault: 'Off by default',
    enabled: 'Visible',
    disabled: 'Hidden',
    hint: 'Hidden cards are not shown to users on this server. You can always re-enable them.',
  },

  // ── GuildSwitcher component ───────────────────────────────────────────────
  guildSwitcher: {
    selectServer: 'Select a server',
    addBot: 'Add bot to server',
    noServers: 'No servers found.',
  },

  // ── /access-denied ────────────────────────────────────────────────────────
  accessDenied: {
    title: 'Access Denied',
    cancelledMsg: 'You cancelled the login. Click below to try again.',
    noPermissionMsg: "You don't have permission to access this page. Contact an administrator if you believe this is a mistake.",
    errorLabel: 'Error code: {error}',
    returnHome: 'Return Home',
    tryAgain: 'Try Again',
    loading: 'Loading...',
  },
} as const;

/**
 * Recursively converts all leaf string literal types to plain `string`.
 * This lets TranslationSchema enforce the correct key structure without
 * requiring every language file to use the exact same string literals as
 * the English source of truth.
 */
type DeepStringify<T> = T extends string
  ? string
  : { [K in keyof T]: DeepStringify<T[K]> };

export type TranslationSchema = DeepStringify<typeof en>;
