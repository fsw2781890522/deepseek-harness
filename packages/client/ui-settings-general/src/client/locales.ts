/** Shell chrome, General-nav, and desktop-update dictionaries; feature rows own their copy. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'trigger': '设置',
  'title': '设置',
  'close': '关闭',
  'openDocument': '打开配置文件',
  'openDocument.error': '无法打开配置文件',
  'general.nav': '通用设置',
  'update.title': '检查更新',
  'update.check': '检查更新',
  'update.checking': '正在检查…',
  'update.install': '立即更新',
  'update.installing': '正在安装…',
  'update.idle': '可检查是否有新的安装包',
  'update.current': '已是最新版本',
  'update.currentVersion': '当前版本 {version}',
  'update.available': '发现新版本 {version}',
  'update.unavailable': '无法检查更新：{reason}',
} satisfies Record<string, string>

/** The settings namespace key union. */
export type SettingsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'trigger': 'Settings',
  'title': 'Settings',
  'close': 'Close',
  'openDocument': 'Open configuration file',
  'openDocument.error': 'Could not open configuration file',
  'general.nav': 'General',
  'update.title': 'Check for updates',
  'update.check': 'Check for updates',
  'update.checking': 'Checking…',
  'update.install': 'Install update',
  'update.installing': 'Installing…',
  'update.idle': 'Check whether a newer installer is published',
  'update.current': 'You are up to date',
  'update.currentVersion': 'Current version {version}',
  'update.available': 'Version {version} is available',
  'update.unavailable': 'Could not check for updates: {reason}',
} satisfies Record<SettingsKey, string>
