import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { EmojiPicker } from "./src/picker.js";
import { Keybindings } from "./src/keybindings.js";
import { SETTING } from "./src/constants.js";

export default class EmojiPickerExtension extends Extension {
  enable() {
    this._settings = this.getSettings();
    this._picker = new EmojiPicker(this, this._settings);
    this._keybindings = new Keybindings(this._settings);
    this._keybindings.bind(SETTING.KEYBINDING, () => this._picker.toggle());
  }

  disable() {
    if (this._keybindings) {
      this._keybindings.destroy();
      this._keybindings = null;
    }
    if (this._picker) {
      this._picker.destroy();
      this._picker = null;
    }
    this._settings = null;
  }
}
