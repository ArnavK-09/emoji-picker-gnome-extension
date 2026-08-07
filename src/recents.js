import { SETTING } from './constants.js';

export class RecentStore {
  constructor(settings) {
    this._settings = settings;
  }

  list() {
    return this._settings.get_strv(SETTING.RECENTS);
  }

  add(char) {
    const existing = this.list().filter((item) => item !== char);
    existing.unshift(char);
    const capped = existing.slice(0, this._settings.get_int(SETTING.RECENT_COUNT));
    this._settings.set_strv(SETTING.RECENTS, capped);
  }
}