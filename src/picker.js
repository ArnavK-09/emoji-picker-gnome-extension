import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as AnimationUtils from 'resource:///org/gnome/shell/misc/animationUtils.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import { CATEGORIES, EMOJI_BY_CHAR, applySkinTone } from './emojiData.js';
import { Clipboard } from './clipboard.js';
import { RecentStore } from './recents.js';
import { SETTING } from './constants.js';

const TABS = [
  { id: 'recent', icon: 'document-open-recent-symbolic', label: 'Recent', a11yLabel: 'Recently used emojis', alias: 'recents' },
  ...CATEGORIES.map((c) => ({ id: c.id, icon: c.icon, label: c.label, a11yLabel: c.label, alias: c.id })),
];

const EMOJIS_PER_ROW = 9;
const POPUP_WIDTH = 324;
const SEARCH_FOCUS_DELAY_MS = 20;
const KEYBIND_DEBOUNCE_MS = 600;

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

function makeEmojiButton(char, name, onActivate, scrollView) {
  const btn = new St.Button({
    style_class: 'EmojisItemStyle',
    can_focus: true,
    label: char,
    x_expand: false,
    y_expand: false,
    x_align: Clutter.ActorAlign.CENTER,
    y_align: Clutter.ActorAlign.CENTER,
  });
  btn._emoji = { char, name };
  btn.connect('clicked', () => onActivate(btn._emoji));
  btn.connect('key-focus-in', () => {
    if (scrollView) {
      AnimationUtils.ensureActorVisibleInScrollView(scrollView, btn);
    }
  });
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
  const row = new St.Widget({
    style_class: 'EmojisRow',
    layout_manager: new Clutter.GridLayout({
      orientation: Clutter.Orientation.HORIZONTAL,
      column_homogeneous: true,
      row_homogeneous: true,
    }),
    x_expand: true,
    y_expand: false,
  });
  row._gridLayout = row.layout_manager;
  return row;
}

function padRowContainer(row, usedColumns) {
  for (let col = usedColumns; col < EMOJIS_PER_ROW; col++) {
    const placeholder = new St.Widget({
      style_class: 'EmojisItemStyle',
      opacity: 0,
      reactive: false,
      can_focus: false,
    });
    row._gridLayout.attach(placeholder, col, 0, 1, 1);
  }
}

class EmojiCategoryData {
  constructor(tab, emojis, onActivate, scrollView) {
    this.tab = tab;
    this.emojis = emojis;
    this._onActivate = onActivate;
    this._scrollView = scrollView;
    this._rows = [];
    this._buttons = [];
    this._built = false;
  }

  build() {
    if (this._built) return;
    this._built = true;
    let row = null;
    let gridLayout = null;
    for (let i = 0; i < this.emojis.length; i++) {
      const col = i % EMOJIS_PER_ROW;
      if (col === 0) {
        row = makeRowContainer();
        gridLayout = row._gridLayout;
        this._rows.push(row);
      }
      const { char, name } = this.emojis[i];
      const btn = makeEmojiButton(char, name, this._onActivate, this._scrollView);
      gridLayout.attach(btn, col, 0, 1, 1);
      this._buttons.push(btn);
    }
    if (row) {
      const used = this.emojis.length % EMOJIS_PER_ROW || EMOJIS_PER_ROW;
      padRowContainer(row, used);
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
      super._init(0.0, 'Emoji Picker', false);
      this.visible = false;
      this.set_size(0, 0);

      this._settings = extension.getSettings();
      this._clipboard = new Clipboard();
      this._recents = new RecentStore(this._settings);

      this._cursorAnchor = new St.Widget({
        width: 1,
        height: 1,
        opacity: 0,
        reactive: false,
      });
      Main.uiGroup.add_child(this._cursorAnchor);

      this._categories = new Map();
      this._categoryOrder = [];

      const box = this.menu.box;
      box.add_style_class_name('emoji-picker-menu');
      box.spacing = 4;

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
          accessible_name: tab.a11yLabel || tab.label,
          child: new St.Icon({ icon_name: tab.icon, icon_size: 14 }),
          x_expand: true,
          x_align: Clutter.ActorAlign.CENTER,
        });
        btn.connect('clicked', () => this._activateTab(tab.id));
        this._tabButtons.set(tab.id, btn);
        this._headerBox.add_child(btn);
      }
      box.add_child(this._headerBox);

      this._searchEntry = new St.Entry({
        name: 'searchEntry',
        style_class: 'search-entry emoji-search-entry',
        can_focus: true,
        hint_text: 'Search emojis...',
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

      this._bodyScroll = new St.ScrollView({
        style_class: 'emoji-body-scroll',
        overlay_scrollbars: false,
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

      this._buildAllCategories();
      this._recentsCategory = this._buildRecentsCategory();

      this._activeTab = null;
      this._searchRows = [];
      this._searchButtons = [];
      this._stageKeyId = 0;
      this._focusTimer = 0;

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
        this._disconnectStageKey();
        return;
      }
      this._connectStageKey();
      if (this._focusTimer) {
        GLib.source_remove(this._focusTimer);
        this._focusTimer = 0;
      }
      this._focusTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SEARCH_FOCUS_DELAY_MS, () => {
        this._focusTimer = 0;
        if (this.menu.isOpen) {
          global.stage.set_key_focus(this._searchEntry);
        }
        return GLib.SOURCE_REMOVE;
      });
    }

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
      let gridLayout = null;
      let col = 0;
      for (let i = 0; i < emojis.length; i++) {
        if (i % EMOJIS_PER_ROW === 0) {
          row = makeRowContainer();
          gridLayout = row._gridLayout;
          this._bodyBox.add_child(row);
          this._searchRows.push(row);
          col = 0;
        }
        const btn = makeEmojiButton(emojis[i].char, emojis[i].name, onActivate, this._bodyScroll);
        gridLayout.attach(btn, col, 0, 1, 1);
        col++;
        this._searchButtons.push(btn);
      }
      if (row) {
        const used = emojis.length % EMOJIS_PER_ROW || EMOJIS_PER_ROW;
        padRowContainer(row, used);
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

    _buildAllCategories() {
      for (const tab of TABS) {
        if (tab.id === 'recent') continue;
        const category = CATEGORIES.find((c) => c.id === tab.id);
        if (!category) continue;
        const emojis = category.emojis
          .map((e) => EMOJI_BY_CHAR.get(e.c))
          .filter((e) => !!e);
        const cat = new EmojiCategoryData(tab, emojis, (emoji) =>
          this._selectEmoji(emoji), this._bodyScroll,
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
        this._selectEmoji(emoji), this._bodyScroll,
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

      const w = POPUP_WIDTH;
      const h = 400;

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
      this._cursorAnchor.set_size(1, 1);
      this.menu.open(true);
      if (this._cursorAnchor.get_parent()) {
        this._cursorAnchor.get_parent().set_child_above_sibling(this._cursorAnchor, null);
      }
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
