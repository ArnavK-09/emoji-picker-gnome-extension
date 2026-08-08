import Adw from "gi://Adw";
import Gdk from "gi://Gdk";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import { CATEGORIES } from "./src/emojiData.js";
import { SETTING } from "./src/constants.js";

const CONFLICT_SCHEMAS = [
  "org.gnome.desktop.wm.keybindings",
  "org.gnome.mutter.keybindings",
  "org.gnome.settings-daemon.plugins.media-keys",
  "org.gnome.shell.keybindings",
  "org.freedesktop.ibus.panel.emoji",
];

export default class EmojiPickerPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    const builder = new PreferencesBuilder(settings, this.dir);
    const page = new Adw.PreferencesPage();
    page.add(builder.buildShortcutsGroup());
    page.add(builder.buildBehaviorGroup());
    window.add(page);
    window.set_default_size(560, 520);
  }
}

class PreferencesBuilder {
  constructor(settings, extensionDir) {
    this._settings = settings;
    this._extensionDir = extensionDir;
  }

  _createComboRow(title, settingKey, options) {
    const model = new Gtk.StringList();
    const ids = [];
    for (const { id, label } of options) {
      model.append(label);
      ids.push(id);
    }
    const row = new Adw.ComboRow({ title, model });
    const sync = () => {
      const value = this._settings.get_string(settingKey);
      row.set_selected(Math.max(0, ids.indexOf(value)));
    };
    row.connect("notify::selected", () => {
      this._settings.set_string(settingKey, ids[row.get_selected()]);
    });
    sync();
    return row;
  }

  buildShortcutsGroup() {
    const group = new Adw.PreferencesGroup({ title: "Shortcuts" });

    const shortcutRow = new Adw.ActionRow({ title: "Open emoji picker" });
    const shortcutButton = new Gtk.Button({
      has_frame: false,
      valign: Gtk.Align.CENTER,
    });
    this._conflictRow = new Adw.ActionRow({
      title: "No conflicts",
      subtitle: "",
    });
    this._warningIcon = new Gtk.Image({
      icon_name: "dialog-warning-symbolic",
      visible: false,
    });
    this._conflictRow.add_suffix(this._warningIcon);

    const IGNORED_KEYVALS = new Set([
      Gdk.KEY_Shift_L,
      Gdk.KEY_Shift_R,
      Gdk.KEY_Control_L,
      Gdk.KEY_Control_R,
      Gdk.KEY_Caps_Lock,
      Gdk.KEY_Shift_Lock,
      Gdk.KEY_Meta_L,
      Gdk.KEY_Meta_R,
      Gdk.KEY_Alt_L,
      Gdk.KEY_Alt_R,
      Gdk.KEY_Super_L,
      Gdk.KEY_Super_R,
      Gdk.KEY_Hyper_L,
      Gdk.KEY_Hyper_R,
      Gdk.KEY_ISO_Level3_Shift,
      Gdk.KEY_ISO_Level5_Shift,
      Gdk.KEY_ISO_Level3_Latch,
      Gdk.KEY_ISO_Level5_Latch,
    ]);

    const accelToLabel = (accel) => {
      if (!accel) return "Disabled";
      const replacements = [
        ["<Primary>", "Ctrl + "],
        ["<primary>", "Ctrl + "],
        ["<Shift>", "Shift + "],
        ["<shift>", "Shift + "],
        ["<Alt>", "Alt + "],
        ["<alt>", "Alt + "],
        ["<Super>", "Super + "],
        ["<super>", "Super + "],
        ["<Hyper>", "Hyper + "],
        ["<hyper>", "Hyper + "],
        ["<Meta>", "Meta + "],
        ["<meta>", "Meta + "],
      ];
      let label = accel;
      for (const [from, to] of replacements) {
        label = label.split(from).join(to);
      }
      return label;
    };

    const refreshShortcutLabel = () => {
      const value = this._settings.get_strv(SETTING.KEYBINDING)[0];
      shortcutButton.set_label(accelToLabel(value));
      this._updateConflicts(value);
    };

    shortcutButton.connect("clicked", () => {
      shortcutButton.set_label("Press keys…");
      shortcutButton.grab_focus();

      const controller = new Gtk.EventControllerKey();
      shortcutButton.add_controller(controller);

      let debounceTimeoutId = null;
      const handlerId = controller.connect(
        "key-pressed",
        (_c, keyval, keycode, mask) => {
          const cleanMask = mask & Gtk.accelerator_get_default_mod_mask();

          if (cleanMask === 0 && keyval === Gdk.KEY_Escape) {
            if (debounceTimeoutId) {
              clearTimeout(debounceTimeoutId);
              debounceTimeoutId = null;
            }
            controller.disconnect(handlerId);
            shortcutButton.remove_controller(controller);
            refreshShortcutLabel();
            return Gdk.EVENT_STOP;
          }

          if (cleanMask === 0 && keyval === Gdk.KEY_BackSpace) {
            if (debounceTimeoutId) {
              clearTimeout(debounceTimeoutId);
              debounceTimeoutId = null;
            }
            controller.disconnect(handlerId);
            shortcutButton.remove_controller(controller);
            this._settings.set_strv(SETTING.KEYBINDING, []);
            refreshShortcutLabel();
            return Gdk.EVENT_STOP;
          }

          if (IGNORED_KEYVALS.has(keyval)) {
            return Gdk.EVENT_STOP;
          }

          const accel = Gtk.accelerator_name(keyval, cleanMask);
          shortcutButton.set_label(accelToLabel(accel));

          if (debounceTimeoutId) clearTimeout(debounceTimeoutId);
          debounceTimeoutId = setTimeout(() => {
            debounceTimeoutId = null;
            controller.disconnect(handlerId);
            shortcutButton.remove_controller(controller);
            this._settings.set_strv(SETTING.KEYBINDING, [accel]);
            refreshShortcutLabel();
          }, 600);

          return Gdk.EVENT_STOP;
        },
      );
    });

    shortcutRow.add_suffix(shortcutButton);
    refreshShortcutLabel();

    group.add(shortcutRow);
    group.add(this._conflictRow);
    return group;
  }

  _updateConflicts(accel) {
    if (!accel) {
      this._conflictRow.set_title("No conflicts");
      this._conflictRow.set_subtitle("");
      this._warningIcon.visible = false;
      return;
    }
    const conflicts = this._findConflicts(accel);
    if (conflicts.length === 0) {
      this._conflictRow.set_title("No conflicts");
      this._conflictRow.set_subtitle("");
      this._warningIcon.visible = false;
    } else {
      this._conflictRow.set_title("Shortcut is already in use");
      this._conflictRow.set_subtitle(conflicts.join("\n"));
      this._warningIcon.visible = true;
    }
  }

  _findConflicts(accel) {
    const conflicts = [];
    const seen = new Set();
    const ownSchema = "org.gnome.shell.extensions.emoji-picker";
    const defaultSource = Gio.SettingsSchemaSource.get_default();

    const checkSource = (source) => {
      const [schemaIds] = source.list_schemas(false);
      for (const schemaId of schemaIds) {
        if (schemaId === ownSchema || seen.has(schemaId)) continue;
        seen.add(schemaId);
        let schema;
        try {
          schema = new Gio.Settings({
            settings_schema: source.lookup(schemaId, true),
          });
        } catch (e) {
          continue;
        }
        for (const key of schema.list_keys()) {
          const value = schema.get_value(key);
          if (value.get_type_string() !== "as") continue;
          if (value.get_strv().includes(accel))
            conflicts.push(`${schemaId}: ${key}`);
        }
      }
    };

    for (const schemaId of CONFLICT_SCHEMAS) {
      if (seen.has(schemaId)) continue;
      seen.add(schemaId);
      let schema;
      try {
        schema = Gio.Settings.new(schemaId);
      } catch (e) {
        continue;
      }
      for (const key of schema.list_keys()) {
        const value = schema.get_value(key);
        if (value.get_type_string() !== "as") continue;
        if (value.get_strv().includes(accel))
          conflicts.push(`${schemaId}: ${key}`);
      }
    }

    checkSource(defaultSource);

    const extensionsRoot = this._extensionDir.get_parent();
    if (extensionsRoot) {
      const enumChildren = extensionsRoot.enumerate_children(
        "standard::name,standard::type",
        Gio.FileQueryInfoFlags.NONE,
        null,
      );
      let info;
      while ((info = enumChildren.next_file(null))) {
        if (info.get_file_type() !== Gio.FileType.DIRECTORY) continue;
        const schemasDir = extensionsRoot
          .get_child(info.get_name())
          .get_child("schemas");
        if (!schemasDir.query_exists(null)) continue;
        const source = Gio.SettingsSchemaSource.new_from_directory(
          schemasDir.get_path(),
          defaultSource,
          false,
        );
        checkSource(source);
      }
      enumChildren.close(null);
    }

    return conflicts;
  }

  buildBehaviorGroup() {
    const group = new Adw.PreferencesGroup({ title: "Behavior" });

    const categoryOptions = [{ id: "recent", label: "Recently used" }];
    for (const category of CATEGORIES)
      categoryOptions.push({ id: category.id, label: category.label });

    group.add(
      this._createComboRow(
        "Default category",
        SETTING.DEFAULT_CATEGORY,
        categoryOptions,
      ),
    );

    const recentCount = new Adw.SpinRow({
      title: "Recently used count",
      adjustment: new Gtk.Adjustment({
        lower: 1,
        upper: 100,
        step_increment: 1,
      }),
    });
    this._settings.bind(
      SETTING.RECENT_COUNT,
      recentCount,
      "value",
      Gio.SettingsBindFlags.DEFAULT,
    );
    group.add(recentCount);

    const toneOptions = [
      { id: "none", label: "None" },
      { id: "light", label: "Light" },
      { id: "medium-light", label: "Medium-light" },
      { id: "medium", label: "Medium" },
      { id: "medium-dark", label: "Medium-dark" },
      { id: "dark", label: "Dark" },
    ];
    group.add(
      this._createComboRow("Skin tone", SETTING.SKIN_TONE, toneOptions),
    );

    const pasteRow = new Adw.SwitchRow({
      title: "Paste on select",
      subtitle:
        "Type the selected emoji into the focused field (Shift+Insert).",
    });
    this._settings.bind(
      SETTING.PASTE_ON_SELECT,
      pasteRow,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );
    group.add(pasteRow);

    return group;
  }
}
