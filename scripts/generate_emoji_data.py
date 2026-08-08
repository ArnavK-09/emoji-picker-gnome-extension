#!/usr/bin/env python3
"""
Regenerate src/emojiData.js from the emoji-copy@felipeftn SQLite DB.

Output mirrors the shape the picker expects:
- CATEGORIES: [{ id, icon, label, emojis: [{ c, n, k, t? }] }]
- ALL_EMOJIS: [{ char, name, keywords, category, tone }]
- EMOJI_BY_CHAR: Map
- CATEGORY_BY_ID: Map
- applySkinTone(char, tone)

The DB rows look like:
  unicode: the emoji character
  description: "human name keywords as space-joined tokens"
  emoji_group: one of the 9 categories
  skin_tone: '' or 'light skin tone' / 'medium-light skin tone' / etc.

We pick the *first* row per unicode (which is the "base" / no-tone variant)
as the canonical emoji. Tone variants stay in the DB for future use, but
we collapse them so EMOJI_BY_CHAR has one entry per character.
"""

import json
import os
import sqlite3
import sys
from pathlib import Path

DB = Path(os.environ.get("EMOJI_DB", "/home/dopamide/Projects/emoji-picker/emoji-copy@felipeftn/data/emojis.db"))
OUT = Path(os.environ.get("EMOJI_OUT", Path(__file__).resolve().parent.parent / "src" / "emojiData.js"))

CATEGORIES = [
    ('smileys',   'face-smile-symbolic',           'Smileys & Emotion'),
    ('people',    'emoji-people-symbolic',         'People & Body'),
    ('animals',   'emoji-nature-symbolic',         'Animals & Nature'),
    ('food',      'emoji-food-symbolic',           'Food & Drink'),
    ('travel',    'emoji-travel-symbolic',         'Travel & Places'),
    ('activities','emoji-activities-symbolic',     'Activities'),
    ('objects',   'emoji-objects-symbolic',        'Objects'),
    ('symbols',   'emoji-symbols-symbolic',        'Symbols'),
    ('flags',     'emoji-flags-symbolic',          'Flags'),
]
CAT_ID = {label: cid for cid, _, label in CATEGORIES}

# Skin tone modifier characters (Fitzpatrick scale). Order matters and must
# match the `id` strings in `constants.js`.
SKIN_TONE_MODIFIER = {
    'none':           '',
    'light':          '\U0001F3FB',
    'medium-light':   '\U0001F3FC',
    'medium':         '\U0001F3FD',
    'medium-dark':    '\U0001F3FE',
    'dark':           '\U0001F3FF',
}
TONE_LABEL_TO_ID = {
    '':                'none',
    'light skin tone': 'light',
    'medium-light skin tone': 'medium-light',
    'medium skin tone':       'medium',
    'medium-dark skin tone':  'medium-dark',
    'dark skin tone':         'dark',
}


def js_str(s: str) -> str:
    """JavaScript string literal with safe escaping."""
    return json.dumps(s, ensure_ascii=False)


def main():
    if not DB.exists():
        print(f"Emoji database not found: {DB}", file=sys.stderr)
        print("Set EMOJI_DB to the path of emoji-copy@felipeftn/data/emojis.db", file=sys.stderr)
        sys.exit(1)
    con = sqlite3.connect(DB)
    cur = con.cursor()
    # The DB has a base row plus 5 tone-variant rows per toneable emoji. We
    # only want the base row in the picker — the picker applies the tone
    # modifier on copy via `applySkinTone`. The base row is the one with
    # the shortest description (which doesn't include "light skin tone" etc.).
    cur.execute("""
        SELECT unicode, description, emoji_group, skin_tone
        FROM emojis
        WHERE skin_tone = '' OR skin_tone IS NULL
        ORDER BY length(description) ASC
    """)
    rows = cur.fetchall()
    con.close()

    # Build a fast lookup of every unicode string in the DB so we can detect
    # toneable base emojis by checking for `base + modifier` in the set.
    con = sqlite3.connect(DB)
    all_unicodes = {r[0] for r in con.execute("SELECT unicode FROM emojis")}
    con.close()

    by_char = {}
    for unicode, desc, group, tone in rows:
        if not unicode:
            continue
        if group not in CAT_ID:
            continue
        # An emoji is "toneable" if at least one tone-modified variant exists
        # in the DB. This drives the `applySkinTone` modifier-on-copy path.
        toneable = any(unicode + mod in all_unicodes for mod in SKIN_TONE_MODIFIER.values() if mod)
        tokens = desc.split()
        if len(tokens) <= 2:
            name = desc
            keywords = tokens
        else:
            name = ' '.join(tokens[:3])
            keywords = tokens
        by_char[unicode] = {
            'char': unicode,
            'name': name,
            'keywords': keywords,
            'category': CAT_ID[group],
            'tone': toneable,
        }

    # Build per-category buckets.
    by_cat = {cid: [] for cid, _, _ in CATEGORIES}
    for e in by_char.values():
        by_cat[e['category']].append(e)

    # Emit the file.
    lines = []
    a = lines.append
    a('// Auto-generated from emoji-copy@felipeftn/data/emojis.db.')
    a('// Do not edit by hand; regenerate via scripts/generate_emoji_data.py.')
    a('')
    a("import { SKIN_TONE_MODIFIER } from './constants.js';")
    a('')
    a('export const CATEGORIES = [')
    for cid, icon, label in CATEGORIES:
        a(f'  {{')
        a(f"    id: {js_str(cid)},")
        a(f"    icon: {js_str(icon)},")
        a(f"    label: {js_str(label)},")
        a(f"    emojis: [")
        for e in by_cat[cid]:
            a(f"      {{ c: {js_str(e['char'])}, n: {js_str(e['name'])}, k: {js_str(' '.join(e['keywords']))} }},")
        a(f'    ],')
        a(f'  }},')
    a('];')
    a('')
    a('export const ALL_EMOJIS = (() => {')
    a('  const flat = [];')
    a('  for (const category of CATEGORIES) {')
    a('    for (const emoji of category.emojis) {')
    a('      flat.push({')
    a('        char: emoji.c,')
    a('        name: emoji.n,')
    a("        keywords: (emoji.k || '').split(' '),")
    a('        category: category.id,')
    a('        tone: emoji.t === true,')
    a('      });')
    a('    }')
    a('  }')
    a('  return flat;')
    a('})();')
    a('')
    a('export const EMOJI_BY_CHAR = (() => {')
    a('  const map = new Map();')
    a('  for (const emoji of ALL_EMOJIS) map.set(emoji.char, emoji);')
    a('  return map;')
    a('})();')
    a('')
    a('export const CATEGORY_BY_ID = (() => {')
    a('  const map = new Map();')
    a('  for (const category of CATEGORIES) map.set(category.id, category);')
    a('  return map;')
    a('})();')
    a('')
    a('export function applySkinTone(char, tone) {')
    a('  const emoji = EMOJI_BY_CHAR.get(char);')
    a('  const modifier = SKIN_TONE_MODIFIER[tone] ?? "";')
    a('  if (!emoji || !emoji.tone || !modifier) return char;')
    a('  return char + modifier;')
    a('}')
    a('')

    OUT.write_text('\n'.join(lines), encoding='utf-8')
    total = sum(len(v) for v in by_cat.values())
    toneable = sum(1 for e in by_char.values() if e['tone'])
    print(f"wrote {OUT}: {total} unique emojis across {len(CATEGORIES)} categories ({toneable} toneable)")


if __name__ == '__main__':
    main()
