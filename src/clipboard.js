import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/**
 * Clipboard writes to both CLIPBOARD and PRIMARY so the emoji is pasteable
 * from terminal emulators (which read from PRIMARY on middle-click) as well
 * as from regular apps (which read from CLIPBOARD on Ctrl+V).
 *
 * `triggerPaste` synthesises a Shift+Insert keystroke (or Ctrl+Shift+Insert
 * for terminals) on a virtual keyboard device, which causes the focused
 * text field to insert the clipboard contents. The 50ms delay lets the
 * popup finish closing and focus return to the user's text field before
 * the keystroke fires — without it, the popup swallows the synthetic key.
 *
 * Pattern is borrowed from the clipboard-gnome-extension-demo project
 * (PR #189 from khaled-0 at maoschanz/emoji-selector-for-gnome).
 */
export class Clipboard {
  constructor() {
    this._clipboard = St.Clipboard.get_default();
    this._device = Clutter.get_default_backend()
      .get_default_seat()
      .create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
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
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
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
