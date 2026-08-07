#!/bin/sh
set -e
prefix="${MESON_INSTALL_DESTDIR_PREFIX:-${MESON_INSTALL_PREFIX}}"
schema_dir="${prefix}/share/gnome-shell/extensions/emoji-picker@ArnavK-09/schemas"
glib-compile-schemas --targetdir="${schema_dir}" "${schema_dir}"