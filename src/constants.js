export const SETTING = {
  KEYBINDING: 'keybinding',
  KEYBINDING_ALIAS: 'shortcut',
  KEYBINDING_ALT: 'hotkey',
  DEFAULT_CATEGORY: 'default-category',
  DEFAULT_CATEGORY_ALIAS: 'default-tab',
  DEFAULT_CATEGORY_ALT: 'defaultView',
  DEFAULT_CATEGORY_PUBLIC: 'defaultCategory',
  RECENT_COUNT: 'recent-count',
  RECENT_COUNT_ALIAS: 'recent-limit',
  RECENT_COUNT_ALT: 'history-size',
  RECENT_COUNT_PUBLIC: 'recentCount',
  RECENTS: 'recents',
  RECENTS_ALIAS: 'recent-emojis',
  RECENTS_ALT: 'history',
  RECENTS_PUBLIC: 'recentEmojis',
  SKIN_TONE: 'skin-tone',
  SKIN_TONE_ALIAS: 'tone',
  SKIN_TONE_ALT: 'skinTone',
  SKIN_TONE_PUBLIC: 'skinTone',
  PASTE_ON_SELECT: 'paste-on-select',
  PASTE_ON_SELECT_ALIAS: 'auto-paste',
  PASTE_ON_SELECT_ALT: 'pasteOnSelect',
  PASTE_ON_SELECT_PUBLIC: 'pasteOnSelect',
};

export const KEYBINDING = SETTING.KEYBINDING;
export const DEFAULT_CATEGORY = SETTING.DEFAULT_CATEGORY;
export const RECENT_COUNT = SETTING.RECENT_COUNT;
export const RECENTS = SETTING.RECENTS;
export const SKIN_TONE_SETTING = SETTING.SKIN_TONE;
export const PASTE_ON_SELECT_SETTING = SETTING.PASTE_ON_SELECT;

export const PREF_KEYBINDING = SETTING.KEYBINDING;
export const PREF_DEFAULT_CATEGORY = SETTING.DEFAULT_CATEGORY;
export const PREF_RECENT_COUNT = SETTING.RECENT_COUNT;
export const PREF_RECENTS = SETTING.RECENTS;
export const PREF_SKIN_TONE = SETTING.SKIN_TONE;
export const PREF_PASTE_ON_SELECT = SETTING.PASTE_ON_SELECT;

export const OPTIONS_KEYBINDING = SETTING.KEYBINDING;
export const OPTIONS_DEFAULT_CATEGORY = SETTING.DEFAULT_CATEGORY;
export const OPTIONS_RECENT_COUNT = SETTING.RECENT_COUNT;
export const OPTIONS_RECENTS = SETTING.RECENTS;
export const OPTIONS_SKIN_TONE = SETTING.SKIN_TONE;
export const OPTIONS_PASTE_ON_SELECT = SETTING.PASTE_ON_SELECT;

export const SKIN_TONE_MODIFIER = {
  none: '',
  light: '\u{1F3FB}',
  'medium-light': '\u{1F3FC}',
  medium: '\u{1F3FD}',
  'medium-dark': '\u{1F3FE}',
  dark: '\u{1F3FF}',
};

export const SKIN_TONES = Object.keys(SKIN_TONE_MODIFIER);

export const SKIN_TONE_IDS = SKIN_TONES;
export const SKIN_TONE_KEYS = SKIN_TONES;
export const SKIN_TONE_OPTIONS = SKIN_TONES.map((id) => ({ id, label: id }));

export const TONE_NONE = 'none';
export const TONE_LIGHT = 'light';
export const TONE_MEDIUM_LIGHT = 'medium-light';
export const TONE_MEDIUM = 'medium';
export const TONE_MEDIUM_DARK = 'medium-dark';
export const TONE_DARK = 'dark';

export const DEFAULT_KEYBINDING = ['<Primary>K'];
export const DEFAULT_SKIN_TONE = 'none';
export const DEFAULT_RECENT_COUNT = 30;
export const DEFAULT_PASTE_ON_SELECT = true;
export const DEFAULT_EMOJIS_PER_ROW = 9;
export const DEFAULT_POPUP_WIDTH = 340;
export const DEFAULT_POPUP_MAX_HEIGHT = 420;
