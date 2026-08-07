# Emoji Picker by ArnavK-09

A GNOME Shell 50 extension that opens a cursor-anchored emoji picker with a
configurable keyboard shortcut (Super+. by default), copies the selected
emoji to the clipboard, and includes a built-in zalgo text generator.

## Features

- Cursor-anchored popup, clamped to stay on screen
- Search by name or keyword with instant live filtering
- Recently-used emojis persisted via GSettings
- Nine categories with a tab switcher (Smileys, People, Animals, Food,
  Activities, Travel, Objects, Symbols, Flags)
- Optional skin-tone modifier for applicable emojis
- Zalgo text generator with adjustable intensity
- Fully keyboard- and mouse-navigable
- Respects GNOME's reduced-motion accessibility setting

## Installation

```sh
meson setup build && meson compile -C build && meson install -C build
```

Then enable it in GNOME Extensions, or run:

```sh
gnome-extensions enable emoji-picker@ArnavK-09
```

Restart GNOME Shell (log out and back in on Wayland) for the keybinding to
register.

## License

GPL-3.0-or-later