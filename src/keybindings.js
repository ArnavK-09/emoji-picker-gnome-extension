import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class Keybindings {
  constructor(settings) {
    this._settings = settings;
    this._names = [];
  }

  bind(name, callback) {
    Main.wm.addKeybinding(
      name,
      this._settings,
      Meta.KeyBindingFlags.NONE,
      Shell.ActionMode.ALL,
      callback,
    );
    this._names.push(name);
  }

  unbindAll() {
    for (const name of this._names) Main.wm.removeKeybinding(name);
    this._names = [];
  }

  destroy() {
    this.unbindAll();
    this._settings = null;
  }
}