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
    loginFailed: '¡Error de inicio de sesión!',
    rateLimitError:
      'Límite de velocidad de Discord: Demasiados intentos. Espera 5 minutos e intenta de nuevo.',
    discordError: 'Error al iniciar sesión con Discord. Por favor, intenta de nuevo.',
    unexpectedError: 'Ocurrió un error inesperado durante el inicio de sesión.',
    detailsLabel: 'Detalles: {details}',
    loggingIn: 'Iniciando sesión...',
    loginButton: 'Iniciar sesión con Discord (Redirigir)',
    switchAccount: 'Cambiar cuenta',
    signInPrompt: 'Inicia sesión con tu cuenta de Discord para gestionar tus bots',
    popupBlocked:
      'La ventana emergente fue bloqueada. Permite ventanas emergentes para este sitio.',
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

  // ── /access-denied ────────────────────────────────────────────────────────
  accessDenied: {
    title: 'Acceso denegado',
    cancelledMsg: 'Cancelaste el inicio de sesión o denegaste el acceso al bot.',
    noPermissionMsg:
      'No tienes permiso para acceder a este recurso. Si crees que esto es un error, contacta a un administrador.',
    errorLabel: 'Error: {error}',
    returnHome: 'Volver al inicio',
    tryAgain: 'Intentar de nuevo',
    loading: 'Cargando...',
  },
};
