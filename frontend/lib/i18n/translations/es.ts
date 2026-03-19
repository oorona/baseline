/**
 * Spanish (es) translations.
 *
 * This file mirrors the structure of en.ts exactly.
 * Every key present in en.ts must also exist here.
 * If a key is missing the i18n system will automatically fall back to English.
 *
 * DEVELOPER NOTE:
 *   When you add a new key to en.ts you MUST add the Spanish equivalent here.
 *   Keep both files structurally identical so the TypeScript compiler catches
 *   missing keys via the TranslationSchema type.
 */
import type { TranslationSchema } from './en';

export const es: TranslationSchema = {
  // ── Shared across multiple pages ──────────────────────────────────────────
  common: {
    loading: 'Cargando...',
    loadingDashboard: 'Cargando panel...',
    checkingPermissions: 'Verificando permisos...',
    dashboard: 'Panel',
    saving: 'Guardando...',
  },

  // ── Top navigation bar ────────────────────────────────────────────────────
  header: {
    admin: 'Administrador',
    user: 'Usuario',
    logoutTitle: 'Cerrar sesión',
    accountSettings: 'Configuración de Cuenta',
  },

  // ── /welcome (public landing page) ───────────────────────────────────────
  welcome: {
    addToServer: 'Agregar {botName} a tu servidor',
    freeToUse: 'Gratis',
    easySetup: 'Fácil configuración',
    powerfulFeatures: 'Funciones potentes',
    operatorPrompt: '¿Operador del bot? Accede al panel',
    loginWithDiscord: 'Iniciar sesión con Discord',
    noServersMessage:
      '¡Bienvenido, {username}! Aún no tienes acceso a ningún servidor configurado. Agrega el bot a un servidor tuyo o pide al propietario del servidor que te autorice.',
    goToDashboard: 'Ir al Panel',
    openDashboard: 'Abrir Panel',
  },

  // ── /login ────────────────────────────────────────────────────────────────
  login: {
    loginFailed: 'Error al iniciar sesión',
    rateLimitError: 'Demasiados intentos. Por favor espera 5 minutos e intenta de nuevo.',
    discordError: 'Discord no pudo completar el inicio de sesión. Por favor, intenta de nuevo.',
    unexpectedError: 'Algo salió mal. Por favor, intenta de nuevo en un momento.',
    serviceUnavailable: 'El servicio no está disponible temporalmente. Intenta de nuevo en un momento.',
    detailsLabel: 'Detalles: {details}',
    loggingIn: 'Iniciando sesión...',
    loginButton: 'Iniciar sesión con Discord',
    switchAccount: 'Cambiar cuenta',
    signInPrompt: 'Inicia sesión con tu cuenta de Discord para gestionar tu servidor',
    popupBlocked: 'La ventana emergente fue bloqueada. Permite ventanas emergentes para este sitio e intenta de nuevo.',
    loading: 'Cargando...',
  },

  // ── / (dashboard home — cards, permission sections) ──────────────────────
  dashboard: {
    manageServer: 'Gestionar {serverName}',
    welcomeUser: 'Bienvenido, {username}',
    selectTool:
      'Selecciona una herramienta para gestionar tu servidor o ver el estado de la plataforma.',
    currentPermission: 'Permiso actual:',
    permDeveloper: 'Desarrollador',
    permOwner: 'Propietario',
    permAdministrator: 'Administrador',
    permAuthorized: 'Autorizado',
    permUser: 'Usuario',
    permGuest: 'Invitado',
    accessRestricted: 'Acceso restringido',
    noAccessBody: 'No tienes acceso a ninguna herramienta para este servidor.',
    currentAccessLevel: 'Nivel de acceso actual: {level}',

    // Permission section headers + descriptions
    sectionPublicLabel: 'Público',
    sectionPublicDesc: 'Disponible para todos, sin necesidad de cuenta',
    sectionPublicDataLabel: 'Datos públicos',
    sectionPublicDataDesc: 'Información pública — no se requiere inicio de sesión',
    sectionUserLabel: 'Usuario',
    sectionUserDesc: 'Disponible para miembros del servidor con sesión iniciada',
    sectionAuthorizedLabel: 'Autorizado',
    sectionAuthorizedDesc: 'Requiere autorización explícita del servidor',
    sectionAdministratorLabel: 'Administrador',
    sectionAdministratorDesc: 'Administradores del servidor — gestionar usuarios y roles autorizados',
    sectionOwnerLabel: 'Propietario',
    sectionOwnerDesc: 'Solo para el propietario del servidor',
    sectionDeveloperLabel: 'Desarrollador',
    sectionDeveloperDesc: 'Administrador de la plataforma — acceso completo al sistema',

    // Dashboard card titles & descriptions
    cardBotOverviewTitle: 'Vista general del bot',
    cardBotOverviewDesc:
      'Aprende qué puede hacer este bot: características, comandos y cómo comenzar.',
    cardCommandRefTitle: 'Referencia de comandos',
    cardCommandRefDesc:
      'Explora todos los comandos disponibles del bot, su uso, parámetros y ejemplos.',
    cardBotSettingsTitle: 'Configuración del bot',
    cardBotSettingsDesc:
      'Configura el comportamiento general del bot, prefijo de comandos y ajustes de idioma.',
    cardPermissionsTitle: 'Permisos',
    cardPermissionsDesc:
      'Administra niveles de acceso, autoriza usuarios y roles para este servidor.',
    cardBotHealthTitle: 'Estado del bot',
    cardBotHealthDesc:
      'Verifica si el bot está en línea: estado del backend, base de datos y puerta de enlace de Discord.',
    cardAccountSettingsTitle: 'Configuración de cuenta',
    cardAccountSettingsDesc:
      'Administra tus preferencias personales, tema y detalles del perfil.',
    cardAuditLogsTitle: 'Registros de auditoría',
    cardAuditLogsDesc:
      'Rastrea todos los cambios de configuración y acciones administrativas en este servidor.',
    cardAiAnalyticsTitle: 'Analíticas de IA',
    cardAiAnalyticsDesc:
      'Visualiza estadísticas de uso de LLM, consumo de tokens y desglose de costos.',
    cardSystemConfigTitle: 'Configuración del sistema',
    cardSystemConfigDesc:
      'Administra todos los ajustes del framework. Aplica cambios dinámicos en tiempo de ejecución o configura parámetros estáticos.',
    cardDatabaseTitle: 'Gestión de base de datos',
    cardDatabaseDesc:
      'Monitorea conexiones, aplica migraciones de esquema y valida la integridad de la base de datos.',
    cardInstrumentationTitle: 'Instrumentación',
    cardInstrumentationDesc:
      'Métricas de rendimiento, crecimiento de servidores, estadísticas de uso de tarjetas y analíticas de comandos del bot.',
    cardLlmConfigsTitle: 'Configuraciones LLM',
    cardLlmConfigsDesc:
      'Administra esquemas de salida y conjuntos de funciones para la API de Gemini. Visualiza registros de llamadas con estadísticas de tokens y costos.',
    cardPluginDesc: 'Módulo de plugin',
    cardCardVisibilityTitle: 'Visibilidad de tarjetas',
    cardCardVisibilityDesc: 'Elige qué tarjetas son visibles para los usuarios en este servidor. Personaliza la experiencia del panel por servidor.',
  },

  // ── /dashboard/account ────────────────────────────────────────────────────
  account: {
    title: 'Configuración de cuenta',
    subtitle: 'Administra tus preferencias personales.',
    savedSuccess: 'Preferencias guardadas exitosamente',
    savedError: 'Error al guardar la configuración',
    loadingProfile: 'Cargando perfil...',
    sectionProfile: 'Perfil',
    sectionDefaultServer: 'Servidor predeterminado',
    startupServerLabel: 'Servidor de inicio',
    noDefaultServer: 'Sin servidor predeterminado',
    startupServerHint:
      'Este servidor se seleccionará automáticamente al acceder al panel.',
    sectionAppearance: 'Apariencia',
    themeLabel: 'Tema',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
    themeSystem: 'Sistema',
    sectionLanguage: 'Idioma',
    interfaceLanguageLabel: 'Idioma de la interfaz',
    langHintEs: 'La interfaz cambiará a español.',
    langHintEn: 'La interfaz cambiará a inglés.',
    saveButton: 'Guardar preferencias',
    saving: 'Guardando...',
    firstLoginTitle: '¡Bienvenido! Elige tu idioma',
    firstLoginMessage:
      'Es tu primera vez aquí. Selecciona el idioma que quieres usar para la interfaz y guarda para continuar.',
    firstLoginSkip: 'Omitir por ahora',
    continueButton: 'Ir al Panel',
  },

  // ── /commands ─────────────────────────────────────────────────────────────
  commands: {
    title: 'Referencia de comandos',
    subtitle: 'Todos los comandos disponibles del bot, organizados por módulo.',
    refreshButton: 'Actualizar desde Cogs',
    refreshing: 'Actualizando...',
    lastUpdated: 'Última sincronización: {date}',
    neverSynced: 'Nunca sincronizado',
    noCommands: 'No se encontraron comandos.',
    noCommandsHint: 'Desarrolladores: usa el botón Actualizar para importar comandos desde las definiciones de cogs.',
    usageLabel: 'Uso',
    examplesLabel: 'Ejemplos',
    refreshSuccess: 'Comandos actualizados exitosamente.',
    refreshError: 'Error al actualizar los comandos.',
    commandCount: '{count} comandos',
  },

  // ── /dashboard/[guildId]/card-visibility ──────────────────────────────────
  cardVisibility: {
    title: 'Visibilidad de tarjetas',
    subtitle: 'Elige qué tarjetas ven los usuarios en el panel de este servidor.',
    saveButton: 'Guardar configuración',
    saving: 'Guardando...',
    savedSuccess: 'Configuración de visibilidad guardada.',
    savedError: 'Error al guardar la configuración.',
    loadingError: 'Error al cargar la configuración de visibilidad.',
    offByDefault: 'Oculto por defecto',
    enabled: 'Visible',
    disabled: 'Oculto',
    hint: 'Las tarjetas ocultas no se muestran a los usuarios en este servidor. Puedes volver a activarlas en cualquier momento.',
  },

  // ── GuildSwitcher component ───────────────────────────────────────────────
  guildSwitcher: {
    selectServer: 'Selecciona un servidor',
    addBot: 'Agregar bot al servidor',
    noServers: 'No se encontraron servidores.',
  },

  // ── /access-denied ────────────────────────────────────────────────────────
  accessDenied: {
    title: 'Acceso denegado',
    cancelledMsg: 'Cancelaste el inicio de sesión. Haz clic abajo para intentar de nuevo.',
    noPermissionMsg: 'No tienes permiso para acceder a esta página. Contacta a un administrador si crees que esto es un error.',
    errorLabel: 'Código de error: {error}',
    returnHome: 'Volver al inicio',
    tryAgain: 'Intentar de nuevo',
    loading: 'Cargando...',
  },

  // ── /dashboard/bot-health ─────────────────────────────────────────────────
  botHealth: {
    title: 'Estado del Bot',
    subtitle: 'Disponibilidad actual de los servicios — ¿el bot está funcionando?',
    checking: 'Verificando el estado del bot...',
    refreshTitle: 'Actualizar',
    updatedAt: 'Actualizado {time}',
    autoRefresh: 'Se actualiza automáticamente cada 30 segundos. Para diagnósticos detallados, contacta a un administrador de plataforma.',
    statusOperational: 'Operacional',
    statusDegraded: 'Degradado',
    statusIssues: 'Problemas Detectados',
    serviceBackend: 'API Backend',
    serviceBackendDesc: 'Servicios API principales',
    serviceDatabase: 'Base de datos',
    serviceDatabaseDesc: 'Persistencia de datos',
    serviceDiscord: 'Gateway de Discord',
    serviceDiscordDesc: 'Eventos en tiempo real',
  },

  // ── /dashboard/[guildId]/audit-logs ───────────────────────────────────────
  auditLogs: {
    title: 'Registros de Auditoría',
    subtitle: 'Rastrea cambios y acciones en este servidor.',
    loading: 'Cargando registros de auditoría...',
    loadError: 'Error al cargar los registros de auditoría',
    noLogs: 'No se encontraron registros de auditoría.',
    colAction: 'Acción',
    colUser: 'ID de usuario',
    colDetails: 'Detalles',
    colTime: 'Hora',
  },

  // ── /dashboard/ai-analytics ───────────────────────────────────────────────
  aiAnalytics: {
    title: 'Analíticas de IA',
    loading: 'Cargando analíticas...',
    loadError: 'Error al cargar datos analíticos. Asegúrate de tener permisos de desarrollador.',
    noData: 'Sin datos disponibles.',
    statTotalTokens: 'Tokens totales',
    statEstimatedCost: 'Costo estimado',
    statTotalRequests: 'Solicitudes totales',
    sectionByProvider: 'Uso por proveedor',
    sectionRecentLogs: 'Registros recientes',
    colProvider: 'Proveedor',
    colRequests: 'Solicitudes',
    colCost: 'Costo',
    colTime: 'Hora',
    colUser: 'Usuario',
    colModel: 'Modelo',
    colTokens: 'Tokens',
    colType: 'Tipo',
    colLatency: 'Latencia',
  },

  // ── /dashboard/instrumentation ────────────────────────────────────────────
  instrumentation: {
    title: 'Instrumentación',
    subtitle: 'Métricas de rendimiento, analíticas de uso y seguimiento de crecimiento',
    filterByGuild: 'Filtrar por ID de servidor',
    refresh: 'Actualizar',
    loading: 'Cargando...',
    noData: 'Sin datos',
    noDataPeriod: 'Sin datos para este período',
    noCommandData: 'Sin datos de comandos para este período',
    statGuildJoins: 'Entradas de servidores',
    statGuildLeaves: 'Salidas de servidores',
    statCardClicks: 'Clics en tarjetas',
    statCommandsRun: 'Comandos ejecutados',
    lastRange: 'Últimas {range}',
    sectionGuildGrowth: 'Crecimiento de servidores',
    sectionCardUsage: 'Uso de tarjetas del panel',
    sectionApiPerf: 'Rendimiento de endpoints API',
    sectionBotCommands: 'Analíticas de comandos del bot',
    apiPerfLegend: 'Verde <100ms · Ámbar <500ms · Rojo ≥500ms',
    colCard: 'Tarjeta',
    colClicks: 'Clics',
    colUniqueUsers: 'Usuarios únicos',
    colEndpoint: 'Endpoint',
    colMethod: 'Método',
    colRequests: 'Solicitudes',
    colCommand: 'Comando',
    colCog: 'Módulo',
    colInvocations: 'Invocaciones',
    colSuccess: 'Éxito',
    colAvg: 'Promedio',
    chartJoins: 'Entradas',
    chartLeaves: 'Salidas',
  },

  // ── /dashboard/[guildId]/settings ─────────────────────────────────────────
  guildSettings: {
    title: 'Configuración del Bot',
    subtitle: 'Configura cómo se comporta el bot en tu servidor.',
    loading: 'Cargando configuración…',
    saveButton: 'Guardar configuración',
    saving: 'Guardando…',
    savedSuccess: 'Configuración guardada exitosamente.',
    saveError: 'Error al guardar la configuración.',
    loadError: 'Error al cargar la configuración.',
    noSchemas: 'No hay configuraciones disponibles.',
    noSchemasHint: 'El bot aún no ha reportado esquemas de configuración. Asegúrate de que el bot esté en línea.',
    readOnlyBanner: 'Tienes acceso de solo lectura a esta configuración. Contacta a un administrador para realizar cambios.',
  },

  // ── /dashboard/[guildId]/permissions ──────────────────────────────────────
  permissions: {
    title: 'Gestión de Permisos',
    subtitle: 'Controla los niveles de acceso para tu servidor.',
    loading: 'Cargando permisos...',
    loadError: 'Error al cargar los datos de permisos',
    sectionL2Title: 'Acceso al Panel',
    sectionL2Desc: 'Controla qué miembros pueden iniciar sesión y ver el panel. Se aplica a todos los miembros del servidor.',
    allowEveryone: 'Permitir a todos',
    allowEveryoneDesc: 'Si está activado, cualquier miembro del servidor puede acceder al panel.',
    allowedRolesTitle: 'Roles permitidos',
    allowedRolesDesc: 'Selecciona los roles que pueden acceder al panel.',
    sectionL3RolesTitle: 'Acceso Elevado — Roles',
    sectionL3RolesDesc: 'Los roles listados aquí obtienen acceso elevado: pueden gestionar configuraciones y ver información detallada. No incluye @everyone.',
    selectRolePlaceholder: 'Selecciona un rol para autorizar...',
    authorizeButton: 'Autorizar',
    authorizingButton: 'Agregando...',
    noRoles: 'No hay roles autorizados configurados.',
    sectionL3UsersTitle: 'Acceso Elevado — Usuarios',
    sectionL3UsersDesc: 'Los miembros listados aquí obtienen acceso elevado: pueden gestionar configuraciones y ver información detallada.',
    elevatedAccess: 'Acceso Elevado',
    searchUserPlaceholder: 'Buscar usuario para autorizar...',
    noUsers: 'No se encontraron usuarios autorizados.',
    confirmRemove: '¿Estás seguro?',
    confirmButton: 'Confirmar',
    cancelButton: 'Cancelar',
    successUserAdded: 'Usuario agregado exitosamente',
    successUserRemoved: 'Usuario eliminado exitosamente',
    successRoleAdded: 'Rol autorizado exitosamente',
    successRoleRemoved: 'Rol eliminado exitosamente',
    successSettingsUpdated: 'Configuración actualizada',
    errorAddUser: 'Error al agregar usuario',
    errorRemoveUser: 'Error al eliminar usuario',
    errorAddRole: 'Error al autorizar rol',
    errorRemoveRole: 'Error al eliminar rol',
    errorUpdateSettings: 'Error al actualizar la configuración',
  },

  // ── /dashboard/status ─────────────────────────────────────────────────────
  status: {
    title: 'Estado del Sistema',
    subtitle: 'Telemetría e diagnósticos de infraestructura en tiempo real',
    analyzing: 'Analizando métricas del sistema...',
    refreshTitle: 'Actualizar estado',
    updatedAt: 'Actualizado {time}',
    statusOperational: 'Operacional',
    statusDegraded: 'Degradado',
    statusIssues: 'Problemas Detectados',
    serviceBackend: 'API Backend',
    serviceBackendDesc: 'Servicios API principales',
    serviceDatabase: 'Base de datos',
    serviceDatabaseDesc: 'Persistencia de datos',
    serviceDiscord: 'Gateway de Discord',
    serviceDiscordDesc: 'Eventos en tiempo real',
    sectionShards: 'Estado de Shards',
    shardSubtitle: 'Salud de la conexión al gateway de Discord',
    totalShards: 'Shards totales: {count}',
    noShards: 'No se detectaron shards activos.',
    colId: 'ID',
    colStatus: 'Estado',
    colLatency: 'Latencia',
    colGuilds: 'Servidores',
    colLastHeartbeat: 'Último latido',
    sectionDataStore: 'Salud del almacén de datos',
    sectionPostgres: 'PostgreSQL',
    sectionRedis: 'Redis',
    sectionNodes: 'Nodos de infraestructura',
    sectionBackendInstances: 'Instancias de backend',
    sectionFrontendInstances: 'Instancias de frontend',
    noBackends: 'Sin backends activos',
    noFrontends: 'Sin frontends activos',
    nodeType: 'Nodo {type}',
    uptimeLabel: 'Tiempo activo',
    metricStatus: 'Estado',
    metricVersion: 'Versión',
    metricConnections: 'Conexiones',
    metricCacheHit: 'Ratio de caché',
    metricMemory: 'Memoria usada',
    metricClients: 'Clientes',
    metricUptime: 'Tiempo activo',
    metricUptimeDays: '{days} días',
    metricActiveIdle: '{active} activas / {idle} inactivas',
    naValue: 'N/D',
  },

  // ── /dashboard/platform ───────────────────────────────────────────────────
  platform: {
    title: 'Configuración de plataforma',
    subtitle: 'Configuración global para todos los bots.',
    loading: 'Cargando configuración...',
    savedSuccess: 'Configuración guardada exitosamente',
    saveError: 'Error al guardar la configuración',
    loadError: 'Error al cargar la configuración o acceso denegado',
    sectionGlobal: 'Configuración global',
    sectionGlobalDesc: 'Estas configuraciones se aplican globalmente y son gestionadas por el propietario de la plataforma.',
    systemPromptLabel: 'Prompt del sistema',
    systemPromptPlaceholder: 'Eres un asistente útil...',
    modelLabel: 'Modelo LLM',
    saveButton: 'Guardar configuración',
    saving: 'Guardando...',
  },

  // ── /dashboard/platform/bot-report ────────────────────────────────────────
  botReport: {
    title: 'Informe de desarrollador',
    subtitle: 'Datos de introspección interna del bot',
    loading: 'Cargando informe...',
    loadError: 'Error al cargar los datos del informe',
    noReport: 'No hay informe disponible',
    lastUpdated: 'Última actualización: {time}',
    sectionCommands: 'Comandos Slash',
    sectionListeners: 'Oyentes de eventos',
    sectionPermissions: 'Permisos',
    subsectionIntents: 'Intents',
    subsectionBotPerms: 'Permisos del bot (ejemplo)',
    noDescription: 'Sin descripción',
  },
};
