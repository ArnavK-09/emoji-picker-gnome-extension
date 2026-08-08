export const SETTING = {
  KEYBINDING: "keybinding",
  DEFAULT_CATEGORY: "default-category",
  RECENT_COUNT: "recent-count",
  RECENTS: "recents",
  SKIN_TONE: "skin-tone",
  PASTE_ON_SELECT: "paste-on-select",
};

export const KEYBINDING = SETTING.KEYBINDING;
export const DEFAULT_CATEGORY = SETTING.DEFAULT_CATEGORY;
export const RECENT_COUNT = SETTING.RECENT_COUNT;
export const RECENTS = SETTING.RECENTS;
export const SKIN_TONE_SETTING = SETTING.SKIN_TONE;
export const PASTE_ON_SELECT_SETTING = SETTING.PASTE_ON_SELECT;

export const SKIN_TONE_MODIFIER = {
  none: "",
  light: "\u{1F3FB}",
  "medium-light": "\u{1F3FC}",
  medium: "\u{1F3FD}",
  "medium-dark": "\u{1F3FE}",
  dark: "\u{1F3FF}",
};

export const SKIN_TONES = Object.keys(SKIN_TONE_MODIFIER);

export const DEFAULT_KEYBINDING = ["<Primary>K"];
export const DEFAULT_SKIN_TONE = "none";
export const DEFAULT_RECENT_COUNT = 30;
export const DEFAULT_PASTE_ON_SELECT = true;
