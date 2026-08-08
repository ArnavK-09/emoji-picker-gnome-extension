<h1 align="center">👆 emoji-picker 👆</h1>
<h2 align="center">Cursor-anchored emoji picker for GNOME Shell</h2>

<p align="center">
    <img alt="hero" src="https://emoji-route.vercel.app/svg/👆" />
</p>

> [!NOTE]
>
> A lightweight, performance-oriented emoji picker for GNOME Shell. Press the keyboard shortcut, type to search across ~1940 emojis, and pick. The selected emoji is copied to your clipboard and optionally pasted directly into the focused text field. No system tray icon — the popup appears right at your cursor and disappears when you click outside or press Escape.

## 🌟 Features

- **Cursor-anchored popup** — opens at the mouse pointer; no tray icon, no wasted panel space.
- **Fast flat search** — type to filter across 1940+ emojis in one flat, deduplicated grid. The 9-column layout is filled edge-to-edge with no gaps.
- **Auto-paste** — when you pick an emoji, it's also synthesised into the focused text field via Shift+Insert (or Ctrl+Shift+Insert for terminals). Toggleable in preferences.
- **Recently used** — your last picks are remembered and pinned to the front, MRU order.
- **Skin-tone modifier** — Fitzpatrick scale support for applicable emojis; configurable default tone.
- **Custom keybind** — bind any shortcut you like; defaults to Ctrl+K. Set to empty to free the binding.
- **Themable, no-tray** — translucent dark surface that respects the GNOME theme. Rounded search input, no chunky tile backgrounds.
- **Performance-oriented** — every category's buttons are built once and merely shown/hidden for tab switches and search; no per-keystroke actor allocation.
- **Accessibility** — `accessible_name` on every interactive control, `a11yLabel` on category buttons, semantic focus order, keyboard-only navigation.

## 💻 Installation

```bash
git clone https://github.com/ArnavK-09/emoji-picker-gnome-extension.git
cd emoji-picker
meson setup build --prefix=/usr/local
meson compile -C build
meson install -C build
```

> Then enable the extension:

```bash
# Symlink or copy into your user extensions directory
mkdir -p ~/.local/share/gnome-shell/extensions
ln -s "$(pwd)/emoji-picker@ArnavK-09" \
      ~/.local/share/gnome-shell/extensions/emoji-picker@ArnavK-09

# Enable (you may need to log out and back in first on Wayland)
gnome-extensions enable emoji-picker@ArnavK-09
```

---

## 🧑‍🔧 How it works

- **`EmojiPickerMenu`** — a `PanelMenu.Button` subclass added to the panel status area (so `Main.popupMenuManager` auto-closes on focus-out / click-out) but with `visible = false` and `set_size(0, 0)` so no tray icon is rendered. Only the popup itself appears.
- **`_cursorAnchor`** — a 1×1 invisible `St.Widget` placed at the screen position of the cursor on every `toggle()`. The popup's `sourceActor` is set to this anchor so the menu opens right under the pointer and stays there.
- **`EmojiCategoryData`** — each category lazily builds a flat list of `St.Button`s split into homogeneous horizontal rows of 9 cells. Buttons are kept alive in memory and merely shown/hidden as the user switches tabs and types in the search, which keeps the entire picker interactive with no per-keystroke allocation churn.
- **Search** — the picker rebuilds the body as a single flat, deduplicated grid of matching emojis whenever the query changes. Match logic is `O(N · K)` over name + keyword tokens, with the data sourced from a generated `emojiData.js` (~1940 unique base emojis plus Fitzpatrick tone metadata).
- **Auto-paste** — `Clipboard.triggerPaste()` synthesises a Shift+Insert keystroke on a `Clutter.InputDeviceType.KEYBOARD_DEVICE` virtual device 50ms after the menu closes, so the focus has time to return to the user's text field. For terminals, `Main.inputMethod.content_purpose === TERMINAL` triggers Ctrl+Shift+Insert instead.

## 💻 Contributing

> [!TIP]  
> We welcome contributions to improve **emoji-picker**! If you have suggestions, bug fixes, or new feature ideas, follow these steps:

1. **Fork the Repository**  
   Click the **Fork** button at the top-right of the repo page.

2. **Clone Your Fork**  
   Clone the repo locally:

   ```bash
   git clone https://github.com/ArnavK-09/emoji-picker-gnome-extension.git
   ```

3. **Create a Branch**  
   Create a new branch for your changes:

   ```bash
   git checkout -b your-feature-branch
   ```

4. **Make Changes**  
   Implement your changes (bug fixes, features, etc.).

5. **Commit and Push**  
   Commit your changes and push the branch:

   ```bash
   git commit -m "feat(scope): description"
   git push origin your-feature-branch
   ```

6. **Open a Pull Request**  
   Open a PR with a detailed description of your changes.

7. **Collaborate and Merge**  
   The maintainers will review your PR, request changes if needed, and merge it once approved.

## 🙋‍♂️ Issues

Found a bug or need help? Please create an issue on the [GitHub repository](https://github.com/ArnavK-09/emoji-picker-gnome-extension/issues) with a detailed description.

## 👤 Author

<table>
  <tbody>
    <tr>
        <td align="center" valign="top" width="14.28%"><a href="https://github.com/ArnavK-09"><img src="https://github.com/ArnavK-09.png?s=100" width="130px;" alt="Arnav K"/></a><br /><a href="https://github.com/ArnavK-09"<h4><b>Arnav K</b></h3></a></td>
    </tr>
  </tbody>
</table>

---

<h2 align="center">📄 License</h2>

<p align="center">
<strong>emoji-picker</strong> is licensed under the <code>Unlicense</code> License. See the <a href="https://github.com/ArnavK-09/emoji-picker-gnome-extension/blob/main/LICENSE">LICENSE</a> file for more details.
</p>

---

<p align="center">
    <strong>🌟 If you find this project helpful, please give it a star on GitHub! 🌟</strong>
</p>
