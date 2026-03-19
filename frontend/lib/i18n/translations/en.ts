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
    cancel: 'Cancel',
  },

  // ── Top navigation bar ────────────────────────────────────────────────────
  header: {
    admin: 'Admin',
    user: 'User',
    logoutTitle: 'Logout',
    accountSettings: 'Account Settings',
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

  // ── /dashboard/bot-health ─────────────────────────────────────────────────
  botHealth: {
    title: 'Bot Health',
    subtitle: 'Current service availability — is the bot working?',
    checking: 'Checking bot health...',
    refreshTitle: 'Refresh',
    updatedAt: 'Updated {time}',
    autoRefresh: 'Auto-refreshes every 30 seconds. For detailed infrastructure diagnostics, contact a platform administrator.',
    statusOperational: 'Operational',
    statusDegraded: 'Degraded',
    statusIssues: 'Issues Detected',
    serviceBackend: 'Backend API',
    serviceBackendDesc: 'Core API Services',
    serviceDatabase: 'Database',
    serviceDatabaseDesc: 'Data Persistence',
    serviceDiscord: 'Discord Gateway',
    serviceDiscordDesc: 'Real-time Events',
  },

  // ── /dashboard/[guildId]/audit-logs ───────────────────────────────────────
  auditLogs: {
    title: 'Audit Logs',
    subtitle: 'Track changes and actions within this server.',
    loading: 'Loading audit logs...',
    loadError: 'Failed to load audit logs',
    noLogs: 'No audit logs found.',
    colAction: 'Action',
    colUser: 'User ID',
    colDetails: 'Details',
    colTime: 'Time',
    purgeButton: 'Purge Logs',
    purgeTitle: 'Purge Audit Logs',
    purgeWarning: 'This action is permanent and cannot be undone.',
    purgeAll: 'Delete all logs',
    purgeOlderThan: 'Older than',
    purgeDays: 'days',
    purgeDateRange: 'Date range',
    purgeBefore: 'Before',
    purgeAfter: 'After',
    purgeConfirm: 'Purge',
    purgeSuccess: 'Deleted {count} log(s).',
    purgeError: 'Failed to purge logs.',
    purging: 'Purging…',
  },

  // ── /dashboard/ai-analytics ───────────────────────────────────────────────
  aiAnalytics: {
    title: 'AI Analytics',
    loading: 'Loading analytics...',
    loadError: 'Failed to load analytics data. Ensure you have developer permissions.',
    noData: 'No data available.',
    statTotalTokens: 'Total Tokens',
    statEstimatedCost: 'Estimated Cost',
    statTotalRequests: 'Total Requests',
    sectionByProvider: 'Usage by Provider',
    sectionRecentLogs: 'Recent Logs',
    colProvider: 'Provider',
    colRequests: 'Requests',
    colCost: 'Cost',
    colTime: 'Time',
    colUser: 'User',
    colModel: 'Model',
    colTokens: 'Tokens',
    colType: 'Type',
    colLatency: 'Latency',
    purgeButton: 'Purge Usage Data',
    purgeTitle: 'Purge AI Usage Logs',
    purgeWarning: 'This permanently deletes usage logs and aggregated summaries.',
    purgeAll: 'Delete all records',
    purgeOlderThan: 'Older than',
    purgeDays: 'days',
    purgeDateRange: 'Date range',
    purgeBefore: 'Before',
    purgeAfter: 'After',
    purgeConfirm: 'Purge',
    purgeSuccess: 'Deleted {count} record(s) and {summaries} summary row(s).',
    purgeError: 'Failed to purge usage data.',
    purging: 'Purging…',
  },

  // ── /dashboard/instrumentation ────────────────────────────────────────────
  instrumentation: {
    title: 'Instrumentation',
    subtitle: 'Performance metrics, usage analytics, and growth tracking',
    filterByGuild: 'Filter by guild ID',
    refresh: 'Refresh',
    loading: 'Loading...',
    noData: 'No data',
    noDataPeriod: 'No data for this period',
    noCommandData: 'No command data for this period',
    statGuildJoins: 'Guild Joins',
    statGuildLeaves: 'Guild Leaves',
    statCardClicks: 'Card Clicks',
    statCommandsRun: 'Commands Run',
    lastRange: 'Last {range}',
    sectionGuildGrowth: 'Guild Growth',
    sectionCardUsage: 'Dashboard Card Usage',
    sectionApiPerf: 'API Endpoint Performance',
    sectionBotCommands: 'Bot Command Analytics',
    apiPerfLegend: 'Green <100ms · Amber <500ms · Red ≥500ms',
    colCard: 'Card',
    colClicks: 'Clicks',
    colUniqueUsers: 'Unique Users',
    colEndpoint: 'Endpoint',
    colMethod: 'Method',
    colRequests: 'Requests',
    colCommand: 'Command',
    colCog: 'Cog',
    colInvocations: 'Invocations',
    colSuccess: 'Success',
    colAvg: 'Avg',
    chartJoins: 'Joins',
    chartLeaves: 'Leaves',
    purgeButton: 'Purge Data',
    purgeTitle: 'Purge Instrumentation Data',
    purgeWarning: 'This permanently deletes the selected metric records.',
    purgeAll: 'Delete all records',
    purgeOlderThan: 'Older than',
    purgeDays: 'days',
    purgeDateRange: 'Date range',
    purgeBefore: 'Before',
    purgeAfter: 'After',
    purgeTablesLabel: 'Tables to purge',
    purgeTableGuildEvents: 'Guild Events',
    purgeTableCardUsage: 'Card Usage',
    purgeTableBotCommands: 'Bot Commands',
    purgeTableRequestMetrics: 'Request Metrics',
    purgeConfirm: 'Purge',
    purgeSuccess: 'Purged: {summary}',
    purgeError: 'Failed to purge data.',
    purging: 'Purging…',
  },

  // ── /dashboard/[guildId]/settings ─────────────────────────────────────────
  guildSettings: {
    title: 'Bot Settings',
    subtitle: 'Configure how the bot behaves in your server.',
    loading: 'Loading settings…',
    saveButton: 'Save Settings',
    saving: 'Saving…',
    savedSuccess: 'Settings saved successfully.',
    saveError: 'Failed to save settings.',
    loadError: 'Failed to load settings.',
    noSchemas: 'No configurable settings available.',
    noSchemasHint: "The bot hasn't reported any settings schemas yet. Make sure the bot is online.",
    readOnlyBanner: 'You have read-only access to these settings. Contact an admin to make changes.',
  },

  // ── /dashboard/[guildId]/permissions ──────────────────────────────────────
  permissions: {
    title: 'Permission Management',
    subtitle: 'Control access levels for your guild.',
    loading: 'Loading permissions...',
    loadError: 'Failed to load permission data',
    sectionL2Title: 'Dashboard Access',
    sectionL2Desc: 'Controls which members can log in and view the dashboard. Applies to all guild members.',
    allowEveryone: 'Allow Everyone',
    allowEveryoneDesc: 'If enabled, any member of the guild can access the dashboard.',
    allowedRolesTitle: 'Allowed Roles',
    allowedRolesDesc: 'Select roles that are allowed to access the dashboard.',
    sectionL3RolesTitle: 'Elevated Access — Roles',
    sectionL3RolesDesc: 'Roles listed here gain elevated access: they can manage settings and view detailed information. Does not include @everyone.',
    selectRolePlaceholder: 'Select a role to authorize...',
    authorizeButton: 'Authorize',
    authorizingButton: 'Adding...',
    noRoles: 'No authorized roles configured.',
    sectionL3UsersTitle: 'Elevated Access — Users',
    sectionL3UsersDesc: 'Individual members listed here gain elevated access: they can manage settings and view detailed information.',
    elevatedAccess: 'Elevated Access',
    searchUserPlaceholder: 'Search user to authorize...',
    noUsers: 'No authorized users found.',
    confirmRemove: 'Are you sure?',
    confirmButton: 'Confirm',
    cancelButton: 'Cancel',
    successUserAdded: 'User added successfully',
    successUserRemoved: 'User removed successfully',
    successRoleAdded: 'Role authorized successfully',
    successRoleRemoved: 'Role removed successfully',
    successSettingsUpdated: 'Settings updated',
    errorAddUser: 'Failed to add user',
    errorRemoveUser: 'Failed to remove user',
    errorAddRole: 'Failed to authorize role',
    errorRemoveRole: 'Failed to remove role',
    errorUpdateSettings: 'Failed to update settings',
  },

  // ── /dashboard/status ─────────────────────────────────────────────────────
  status: {
    title: 'System Status',
    subtitle: 'Real-time infrastructure telemetry & diagnostics',
    analyzing: 'Analyzing system metrics...',
    refreshTitle: 'Refresh Status',
    updatedAt: 'Updated {time}',
    statusOperational: 'Operational',
    statusDegraded: 'Degraded',
    statusIssues: 'Issues Detected',
    serviceBackend: 'Backend API',
    serviceBackendDesc: 'Core API Services',
    serviceDatabase: 'Database',
    serviceDatabaseDesc: 'Data Persistence',
    serviceDiscord: 'Discord Gateway',
    serviceDiscordDesc: 'Real-time Events',
    sectionShards: 'Shard Status',
    shardSubtitle: 'Discord gateway connection health',
    totalShards: 'Total Shards: {count}',
    noShards: 'No active shards detected.',
    colId: 'ID',
    colStatus: 'Status',
    colLatency: 'Latency',
    colGuilds: 'Guilds',
    colLastHeartbeat: 'Last Heartbeat',
    sectionDataStore: 'Data Store Health',
    sectionPostgres: 'PostgreSQL',
    sectionRedis: 'Redis',
    sectionNodes: 'Infrastructure Nodes',
    sectionBackendInstances: 'Backend Instances',
    sectionFrontendInstances: 'Frontend Instances',
    noBackends: 'No active backends',
    noFrontends: 'No active frontends',
    nodeType: '{type} Node',
    uptimeLabel: 'Uptime',
    metricStatus: 'Status',
    metricVersion: 'Version',
    metricConnections: 'Connections',
    metricCacheHit: 'Cache Hit Ratio',
    metricMemory: 'Memory Used',
    metricClients: 'Clients',
    metricUptime: 'Uptime',
    metricUptimeDays: '{days} days',
    metricActiveIdle: '{active} active / {idle} idle',
    naValue: 'N/A',
  },

  // ── /dashboard/platform ───────────────────────────────────────────────────
  platform: {
    title: 'Platform Settings',
    subtitle: 'Global configuration for all bots.',
    loading: 'Loading settings...',
    savedSuccess: 'Settings saved successfully',
    saveError: 'Failed to save settings',
    loadError: 'Failed to load settings or Access Denied',
    sectionGlobal: 'Global Configuration',
    sectionGlobalDesc: 'These settings are applied globally and managed by the Platform Owner.',
    systemPromptLabel: 'System Prompt',
    systemPromptPlaceholder: 'You are a helpful assistant...',
    modelLabel: 'LLM Model',
    saveButton: 'Save Settings',
    saving: 'Saving...',
  },

  // ── /dashboard/platform/bot-report ────────────────────────────────────────
  botReport: {
    title: 'Developer Report',
    subtitle: 'Bot internal introspection data',
    loading: 'Loading report...',
    loadError: 'Failed to load report data',
    noReport: 'No report available',
    lastUpdated: 'Last Updated: {time}',
    sectionCommands: 'Slash Commands',
    sectionListeners: 'Event Listeners',
    sectionPermissions: 'Permissions',
    subsectionIntents: 'Intents',
    subsectionBotPerms: 'Bot Permissions (Example)',
    noDescription: 'No description',
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
