project(
  'emoji-picker@ArnavK-09',
  'c',
  version: '1',
  meson_version: '>= 1.0',
  license: 'GPL-3.0-or-later',
)

gnome = import('gnome')

uuid = 'emoji-picker@ArnavK-09'
datadir = get_option('datadir')
extensiondir = datadir / 'gnome-shell' / 'extensions' / uuid
schemadir = extensiondir / 'schemas'

top_files = [
  'extension.js',
  'prefs.js',
  'stylesheet.css',
  'metadata.json',
]

foreach file : top_files
  install_data(file, install_dir: extensiondir)
endforeach

subdir('src')

install_data(
  'schemas/org.gnome.shell.extensions.emoji-picker.gschema.xml',
  install_dir: schemadir,
)

gnome.compile_schemas(
  build_by_default: true,
  depend_files: files('schemas/org.gnome.shell.extensions.emoji-picker.gschema.xml'),
)

meson.add_install_script(
  find_program('scripts/compile-schemas.sh'),
)