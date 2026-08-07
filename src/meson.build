extension_srcdir = extensiondir / 'src'

src_files = [
  'clipboard.js',
  'constants.js',
  'emojiData.js',
  'keybindings.js',
  'picker.js',
  'recents.js',
]

foreach file : src_files
  install_data(file, install_dir: extension_srcdir)
endforeach
