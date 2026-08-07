/*
 * EmojiPicker — keybind-only cursor-anchored popup.
 *
 * Pattern (modeled on clipboard-gnome-extension-demo and emoji-copy):
 * - A `PanelMenu.Button` is added to the panel status area so the shell's
 *   PopupMenuManager picks it up (this is what makes focus-out / click-out
 *   close the menu automatically). The button is sized to 0×0 and made
 *   invisible, so no tray icon is shown — only the popup itself appears.
 * - The popup is anchored to a 1×1 invisible `St.Widget` placed at the
 *   cursor's screen position when the keybind fires, so the menu opens
 *   right under the cursor and stays there.
 * - Width, max-height and padding are pinned so the popup never reflows,
 *   overflows the monitor, or grows past a sane size.
 *
 * UX:
 * - Search entry is NOT auto-focused on open; focus it only when the user
 *   clicks it or starts typing a letter.
 * - Categories are shown as a flat 9-column grid; search results are a
 *   flat deduplicated grid.
 * - Picking an emoji (click or Enter) copies to clipboard, optionally
 *   pastes into the focused field, and closes the menu.
 */

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import { CATEGORIES, EMOJI_BY_CHAR, applySkinTone } from './emojiData.js';
import { Clipboard } from './clipboard.js';
import { RecentStore } from './recents.js';
import { SETTING } from './constants.js';

const TABS = [
  { id: 'recent', icon: 'document-open-recent-symbolic', label: 'Recent' },
  ...CATEGORIES.map((c) => ({ id: c.id, icon: c.icon, label: c.label })),
];

const EMOJIS_PER_ROW = 9;
const POPUP_WIDTH = 340;

function isPrintableKey(event) {
  const sym = event.get_key_symbol();
  const uni = event.get_key_unicode();
  return (
    uni &&
    uni.length === 1 &&
    uni.charCodeAt(0) >= 32 &&
    uni.charCodeAt(0) !== 127 &&
    sym !== Clutter.KEY_Return &&
    sym !== Clutter.KEY_KP_Enter &&
    sym !== Clutter.KEY_Tab &&
    sym !== Clutter.KEY_ISO_Left_Tab &&
    sym !== Clutter.KEY_Escape
  );
}

function makeEmojiButton(char, name, onActivate) {
  const btn = new St.Button({
    style_class: 'EmojisItemStyle',
    can_focus: true,
    label: char,
    x_expand: false,
    y_expand: false,
  });
  btn._emoji = { char, name };
  btn.connect('clicked', () => onActivate(btn._emoji));
  btn.connect('key-press-event', (_a, event) => {
    const sym = event.get_key_symbol();
    if (sym === Clutter.KEY_Return || sym === Clutter.KEY_KP_Enter) {
      onActivate(btn._emoji);
      return Clutter.EVENT_STOP;
    }
    return Clutter.EVENT_PROPAGATE;
  });
  return btn;
}

function makeRowContainer() {
  return new St.BoxLayout({
    style_class: 'EmojisRow',
    x_expand: true,
    y_expand: false,
  });
}

class EmojiCategoryData {
  constructor(tab, emojis, onActivate) {
    this.tab = tab;
    this.emojis = emojis;
    this._onActivate = onActivate;
    this._rows = [];
    this._buttons = [];
    this._built = false;
  }

  build() {
    if (this._built) return;
    this._built = true;
    for (let i = 0; i < this.emojis.length; i++) {
      if (i % EMOJIS_PER_ROW === 0) this._rows.push(makeRowContainer());
      const { char, name } = this.emojis[i];
      const btn = makeEmojiButton(char, name, this._onActivate);
      this._rows[this._rows.length - 1].add_child(btn);
      this._buttons.push(btn);
    }
  }

  rebuild(emojis, onActivate) {
    if (onActivate) this._onActivate = onActivate;
    this.clear();
    this.emojis = emojis;
    this._built = false;
    this.build();
  }

  clear() {
    for (const row of this._rows) {
      if (row.get_parent()) row.get_parent().remove_child(row);
      row.destroy();
    }
    this._rows = [];
    this._buttons = [];
    this._built = false;
  }

  rows() {
    return this._rows;
  }
  buttons() {
    return this._buttons;
  }
}

const EmojiPickerMenu = GObject.registerClass(
  { GTypeName: 'EmojiPickerMenu' },
  class EmojiPickerMenu extends PanelMenu.Button {
    _init(extension) {
      // No visible panel button — we just need the popup machinery.
      super._init(0.0, 'Emoji Picker', false);
      this.visible = false;
      this.set_size(0, 0);

      this._settings = extension.getSettings();
      this._clipboard = new Clipboard();
      this._recents = new RecentStore(this._settings);

      // Anchor widget the menu is positioned around when opening at the
      // cursor. 1×1, invisible, non-reactive.
      this._cursorAnchor = new St.Widget({
        width: 1,
        height: 1,
        opacity: 0,
        reactive: false,
      });
      Main.uiGroup.add_child(this._cursorAnchor);

      this._categories = new Map();
      this._categoryOrder = [];
      this._buildAllCategories();
      this._recentsCategory = this._buildRecentsCategory();

      // --- menu contents -------------------------------------------------
      const box = this.menu.box;
      box.add_style_class_name('emoji-picker-menu');
      // Width is owned by CSS (.popup-menu-box.emoji-picker-menu), not JS,
      // so the layout doesn't fight between two competing width sources.
      box.spacing = 4;

      // Tab strip
      this._headerBox = new St.BoxLayout({
        style_class: 'emoji-categories-header',
        x_expand: true,
        y_expand: false,
      });
      this._tabButtons = new Map();
      for (const tab of TABS) {
        const btn = new St.Button({
          reactive: true,
          can_focus: true,
          track_hover: true,
          toggle_mode: true,
          style_class: 'EmojisCategory',
          accessible_name: tab.label,
          child: new St.Icon({ icon_name: tab.icon, icon_size: 14 }),
          x_expand: true,
          x_align: Clutter.ActorAlign.CENTER,
        });
        btn.connect('clicked', () => this._activateTab(tab.id));
        this._tabButtons.set(tab.id, btn);
        this._headerBox.add_child(btn);
      }
      box.add_child(this._headerBox);

      // Search row
      this._searchEntry = new St.Entry({
        name: 'searchEntry',
        style_class: 'search-entry emoji-search-entry',
        can_focus: true,
        hint_text: 'Search emoji by name…',
        track_hover: true,
        x_expand: true,
        primary_icon: new St.Icon({ icon_name: 'edit-find-symbolic' }),
      });
      this._searchEntry.get_clutter_text().connect('text-changed', () =>
        this._onSearchChanged(this._searchEntry.get_text()),
      );
      this._searchEntry.clutter_text.connect('key-press-event', (_a, event) => {
        const sym = event.get_key_symbol();
        if (
          sym === Clutter.KEY_Down ||
          sym === Clutter.KEY_Return ||
          sym === Clutter.KEY_KP_Enter
        ) {
          const first = this._firstVisibleResult();
          if (first) {
            global.stage.set_key_focus(first);
            return Clutter.EVENT_STOP;
          }
        }
        return Clutter.EVENT_PROPAGATE;
      });
      const searchBox = new St.BoxLayout({
        style_class: 'emoji-search-row',
        x_expand: true,
        y_expand: false,
      });
      searchBox.add_child(this._searchEntry);
      box.add_child(searchBox);

      // Scrollable body
      this._bodyScroll = new St.ScrollView({
        style_class: 'emoji-body-scroll',
        overlay_scrollbars: true,
        hscrollbar_policy: St.PolicyType.NEVER,
        vscrollbar_policy: St.PolicyType.AUTOMATIC,
        x_expand: true,
        y_expand: true,
      });
      this._bodyBox = new St.BoxLayout({
        style_class: 'emoji-body',
        orientation: Clutter.Orientation.VERTICAL,
        x_expand: true,
        y_expand: true,
      });
      this._bodyScroll.set_child(this._bodyBox);
      box.add_child(this._bodyScroll);

      this._activeTab = null;
      this._searchRows = [];
      this._searchButtons = [];
      this._stageKeyId = 0;
      this._outsideKeyId = 0;

      this._openTab(this._settings.get_string(SETTING.DEFAULT_CATEGORY) || 'recent');

      this.menu.connect('open-state-changed', (_m, open) =>
        this._onOpenChanged(open),
      );
    }

    _onOpenChanged(open) {
      if (!open) {
        this._searchEntry.set_text('');
        this._teardownSearchRows();
        this._clearBody();
        this._showTabContent(this._activeTab || 'recent');
        this._cursorAnchor.visible = false;
        this._disconnectStageKey();
        return;
      }
      this._cursorAnchor.visible = true;
      this._connectStageKey();
      // Grab Clutter focus on the search entry once the menu is fully
      // opened. This is the standard pattern from emoji-copy — a deferred
      // set_key_focus after ~20ms lets the modal grab settle before we
      // redirect keyboard focus, and ensures that a printable letter typed
      // next is directed at the search entry (and not at the X-focused
      // external text field the user was in when they hit the keybind).
      if (this._focusTimer) {
        GLib.source_remove(this._focusTimer);
        this._focusTimer = 0;
      }
      this._focusTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 20, () => {
        this._focusTimer = 0;
        if (this.menu.isOpen) {
          global.stage.set_key_focus(this._searchEntry);
        }
        return GLib.SOURCE_REMOVE;
      });
    }

    // When the menu is open, listen at the global stage for keys so that
    // (a) a printable letter focuses the search box and starts typing, and
    // (b) Escape closes the menu. The PopupMenuManager already closes on
    // focus-out and click-out for us; we only need to handle these two
    // input cases.
    _connectStageKey() {
      if (this._stageKeyId) return;
      this._stageKeyId = global.stage.connect(
        'key-press-event',
        (_s, event) => this._onStageKey(event),
      );
    }
    _disconnectStageKey() {
      if (this._stageKeyId) {
        global.stage.disconnect(this._stageKeyId);
        this._stageKeyId = 0;
      }
    }

    _onStageKey(event) {
      if (!this.menu.isOpen) return Clutter.EVENT_PROPAGATE;

      const sym = event.get_key_symbol();
      const focus = global.stage.get_key_focus();
      const searchText = this._searchEntry.clutter_text;

      // If the search entry is already focused, let it handle the key
      // (so the user can type into it normally).
      if (focus === searchText || focus === this._searchEntry) {
        return Clutter.EVENT_PROPAGATE;
      }

      if (sym === Clutter.KEY_Escape) {
        this.menu.close();
        return Clutter.EVENT_STOP;
      }

      if (isPrintableKey(event)) {
        this._searchEntry.set_text(event.get_key_unicode());
        global.stage.set_key_focus(this._searchEntry);
        this._searchEntry.clutter_text.set_cursor_position(1);
        return Clutter.EVENT_STOP;
      }

      return Clutter.EVENT_PROPAGATE;
    }

    // --- search --------------------------------------------------------

    _onSearchChanged(text) {
      const query = (text || '').toLowerCase().trim();
      if (query === '') {
        if (this._activeTab) this._showTabContent(this._activeTab);
        return;
      }
      this._highlightTab(null);
      this._setSearchHighlight(query);
    }

    _setSearchHighlight(query) {
      query = (query || '').toLowerCase().trim();
      this._clearBody();

      for (const cat of this._categoryOrder) {
        if (!cat._built) cat.build();
        for (const btn of cat.buttons()) btn.visible = true;
      }
      if (this._recentsCategory._built) {
        for (const btn of this._recentsCategory.buttons()) btn.visible = true;
      }

      const seen = new Set();
      const matches = [];
      for (const e of this._recentsCategory.emojis) {
        if (this._buttonMatches(e, query) && !seen.has(e.char)) {
          seen.add(e.char);
          matches.push(e);
        }
      }
      for (const cat of this._categoryOrder) {
        for (const e of cat.emojis) {
          if (seen.has(e.char)) continue;
          if (this._buttonMatches(e, query)) {
            seen.add(e.char);
            matches.push(e);
          }
        }
      }

      this._renderSearchGrid(matches);
    }

    _renderSearchGrid(emojis) {
      this._teardownSearchRows();
      if (emojis.length === 0) {
        const empty = new St.Label({
          text: 'No matches',
          style_class: 'emoji-empty',
          x_align: Clutter.ActorAlign.CENTER,
        });
        this._bodyBox.add_child(empty);
        return;
      }
      const onActivate = (e) => this._selectEmoji(e);
      let row = null;
      for (let i = 0; i < emojis.length; i++) {
        if (i % EMOJIS_PER_ROW === 0) {
          row = makeRowContainer();
          this._bodyBox.add_child(row);
          this._searchRows.push(row);
        }
        const btn = makeEmojiButton(emojis[i].char, emojis[i].name, onActivate);
        row.add_child(btn);
        this._searchButtons.push(btn);
      }
    }

    _teardownSearchRows() {
      for (const row of this._searchRows) {
        if (row.get_parent()) row.get_parent().remove_child(row);
        row.destroy();
      }
      this._searchRows = [];
      this._searchButtons = [];
    }

    _firstVisibleResult() {
      const walk = (actor) => {
        if (actor.visible && actor.can_focus && actor._emoji) return actor;
        if (typeof actor.get_children === 'function') {
          for (const child of actor.get_children()) {
            const hit = walk(child);
            if (hit) return hit;
          }
        }
        return null;
      };
      return walk(this._bodyBox);
    }

    _buttonMatches(emoji, query) {
      if (!emoji) return false;
      if (emoji.name && emoji.name.toLowerCase().includes(query)) return true;
      if (emoji.keywords) {
        for (const k of emoji.keywords) {
          if (k && k.toLowerCase().includes(query)) return true;
        }
      }
      return false;
    }

    _clearBody() {
      for (const child of this._bodyBox.get_children()) {
        if (child.get_parent()) child.get_parent().remove_child(child);
      }
    }

    // --- categories ---------------------------------------------------

    _buildAllCategories() {
      for (const tab of TABS) {
        if (tab.id === 'recent') continue;
        const category = CATEGORIES.find((c) => c.id === tab.id);
        if (!category) continue;
        const emojis = category.emojis
          .map((e) => EMOJI_BY_CHAR.get(e.c))
          .filter((e) => !!e);
        const cat = new EmojiCategoryData(tab, emojis, (emoji) =>
          this._selectEmoji(emoji),
        );
        this._categories.set(tab.id, cat);
        this._categoryOrder.push(cat);
      }
    }

    _buildRecentsCategory() {
      const recents = this._recents.list();
      const emojis = recents
        .map((char) => EMOJI_BY_CHAR.get(char))
        .filter((e) => !!e);
      const tab = { id: 'recent', label: 'Recently used' };
      const cat = new EmojiCategoryData(tab, emojis, (emoji) =>
        this._selectEmoji(emoji),
      );
      cat.build();
      return cat;
    }

    _refreshRecents() {
      const recents = this._recents.list();
      const emojis = recents
        .map((char) => EMOJI_BY_CHAR.get(char))
        .filter((e) => !!e);
      this._recentsCategory.rebuild(emojis, (emoji) =>
        this._selectEmoji(emoji),
      );
    }

    _activateTab(id) {
      if (this._searchEntry.get_text() !== '') {
        this._searchEntry.set_text('');
      }
      this._openTab(id);
    }

    _openTab(id) {
      let resolved = id;
      if (resolved === 'recent' && this._recents.list().length === 0) {
        resolved = 'smileys';
      }
      this._activeTab = resolved;
      this._highlightTab(resolved);
      this._showTabContent(resolved);
    }

    _highlightTab(id) {
      for (const [tabId, btn] of this._tabButtons) {
        btn.set_checked(tabId === id);
      }
    }

    _showTabContent(id) {
      this._clearBody();
      let cat;
      if (id === 'recent') {
        this._refreshRecents();
        cat = this._recentsCategory;
      } else {
        cat = this._categories.get(id);
      }
      if (!cat) return;
      if (!cat._built) cat.build();
      for (const btn of cat.buttons()) btn.visible = true;
      for (const row of cat.rows()) {
        row.visible = true;
        this._bodyBox.add_child(row);
      }
    }

    // --- selection ---------------------------------------------------

    _selectEmoji(emoji) {
      const char = emoji?.char;
      if (!char) return;
      const tone = this._settings.get_string(SETTING.SKIN_TONE);
      const text = applySkinTone(char, tone);
      try {
        this._clipboard.copy(text);
      } catch (e) {
        console.error('Emoji Picker: clipboard copy failed', e);
      }
      this._recents.add(char);
      if (this._settings.get_boolean(SETTING.PASTE_ON_SELECT)) {
        this._clipboard.triggerPaste();
      }
      this.menu.close();
    }

    toggle() {
      if (this.menu.isOpen) {
        this.menu.close();
        return;
      }

      const monitor = Main.layoutManager.currentMonitor;
      const [px, py] = global.get_pointer();
      const margin = 8;

      // Width is fixed (CSS). For height, the popup is at most
      // header(32) + search(36) + body(320) + padding(12) ≈ 400px; use
      // POPUP_MAX_HEIGHT as a hard cap.
      const w = POPUP_WIDTH;
      const h = 400;

      // Prefer opening to the right and below the cursor; flip left/up
      // if it would overflow the monitor.
      let cx = px + margin;
      if (cx + w > monitor.x + monitor.width - margin) {
        cx = px - w - margin;
      }
      cx = Math.max(monitor.x + margin, Math.min(cx, monitor.x + monitor.width - w - margin));

      let cy = py + margin;
      if (cy + h > monitor.y + monitor.height - margin) {
        cy = py - h - margin;
      }
      cy = Math.max(monitor.y + margin, Math.min(cy, monitor.y + monitor.height - h - margin));

      this._cursorAnchor.set_position(Math.round(cx), Math.round(cy));
      this._cursorAnchor.visible = true;
      this.menu.sourceActor = this._cursorAnchor;
      this.menu.open(true);
    }

    destroy() {
      this._disconnectStageKey();
      if (this._focusTimer) {
        GLib.source_remove(this._focusTimer);
        this._focusTimer = 0;
      }
      this._teardownSearchRows();
      if (this._cursorAnchor) {
        Main.uiGroup.remove_child(this._cursorAnchor);
        this._cursorAnchor.destroy();
        this._cursorAnchor = null;
      }
      for (const cat of this._categoryOrder) cat.clear();
      if (this._recentsCategory) this._recentsCategory.clear();
      super.destroy();
    }
  },
);

export class EmojiPicker {
  constructor(extension, settings) {
    this._menu = new EmojiPickerMenu(extension);
    // Add to the panel status area (this is what wires the menu into
    // Main.popupMenuManager so it auto-closes on focus-out / click-out),
    // but the button itself stays invisible — no tray icon is rendered.
    Main.panel.addToStatusArea(
      'EmojiPicker',
      this._menu,
      0,
      'right',
    );
    this._menu.visible = false;
  }

  toggle() {
    this._menu.toggle();
  }

  destroy() {
    if (this._menu) {
      this._menu.destroy();
      this._menu = null;
    }
  }
}
