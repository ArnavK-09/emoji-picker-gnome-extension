import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const CLIPBOARD_PASTE_DELAY_MS = 50;
export const VIRTUAL_KEYBOARD_TYPE = Clutter.InputDeviceType.KEYBOARD_DEVICE;

export class Clipboard {
  constructor() {
    this._clipboard = St.Clipboard.get_default();
    this._device = Clutter.get_default_backend()
      .get_default_seat()
      .create_virtual_device(VIRTUAL_KEYBOARD_TYPE);
    this._contentPurpose = Main.inputMethod?.content_purpose ?? null;
    if (Main.inputMethod) {
      Main.inputMethod.connect('notify::content-purpose', (m) => {
        this._contentPurpose = m.content_purpose;
      });
    }
  }

  copy(text) {
    this._clipboard.set_text(St.ClipboardType.CLIPBOARD, text);
    this._clipboard.set_text(St.ClipboardType.PRIMARY, text);
  }

  triggerPaste() {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, CLIPBOARD_PASTE_DELAY_MS, () => {
      const t = Clutter.get_current_event_time() * 1000;
      const isTerminal =
        this._contentPurpose === Clutter.InputContentPurpose?.TERMINAL;
      this._device.notify_keyval(t, Clutter.KEY_Shift_L, Clutter.KeyState.PRESSED);
      if (isTerminal) {
        this._device.notify_keyval(t, Clutter.KEY_Control_L, Clutter.KeyState.PRESSED);
      }
      this._device.notify_keyval(t, Clutter.KEY_Insert, Clutter.KeyState.PRESSED);
      this._device.notify_keyval(t, Clutter.KEY_Insert, Clutter.KeyState.RELEASED);
      if (isTerminal) {
        this._device.notify_keyval(t, Clutter.KEY_Control_L, Clutter.KeyState.RELEASED);
      }
      this._device.notify_keyval(t, Clutter.KEY_Shift_L, Clutter.KeyState.RELEASED);
      return GLib.SOURCE_REMOVE;
    });
  }
}
