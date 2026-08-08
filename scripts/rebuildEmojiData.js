#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..', '..');
const sqlite = '/home/dopamide/Projects/emoji-picker/emoji-copy@felipeftn/data/emojis.db';

const rows = execFileSync('sqlite3', [
  sqlite,
  'SELECT unicode, description, skin_tone, emoji_group FROM emojis;',
], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [unicode, description, skin_tone, emoji_group] = line.split('|');
    return { unicode, description, skin_tone, emoji_group };
  });

const GROUP_TO_ID = {
  'Smileys & Emotion': 'smileys',
  'People & Body': 'people',
  'Animals & Nature': 'animals',
  'Food & Drink': 'food',
  'Travel & Places': 'travel',
  'Activities': 'activities',
  'Objects': 'objects',
  'Symbols': 'symbols',
  'Flags': 'flags',
};

const GROUP_TO_ICON = {
  'Smileys & Emotion': 'emoji-people-symbolic',
  'People & Body': 'emoji-body-symbolic',
  'Animals & Nature': 'emoji-nature-symbolic',
  'Food & Drink': 'emoji-food-symbolic',
  'Travel & Places': 'emoji-travel-symbolic',
  'Activities': 'emoji-activities-symbolic',
  'Objects': 'emoji-objects-symbolic',
  'Symbols': 'emoji-symbols-symbolic',
  'Flags': 'emoji-flags-symbolic',
};

const buckets = new Map();
for (const id of new Set(Object.values(GROUP_TO_ID))) {
  buckets.set(id, []);
}

for (const row of rows) {
  const id = GROUP_TO_ID[row.emoji_group];
  if (!id) continue;
  const subgroupMatch = row.description.match(/\b([a-z][a-z0-9-]*-[a-z]+)\b\s*$/);
  const subgroup = subgroupMatch ? subgroupMatch[1] : 'zzz_other';
  const keywords = (row.description || '').split(/\s+/).filter(Boolean).slice(0, 12);
  const name = keywords[0]
    ? keywords.slice(0, keywords.indexOf(row.description.match(/\b[a-z]+-[a-z]+/)?.[0] || '') > 0 ? keywords.indexOf(row.description.match(/\b[a-z]+-[a-z]+/)?.[0]) : 3).join(' ')
    : row.description;
  buckets.get(id).push({
    c: row.unicode,
    n: row.description.split(/\s+/).slice(0, 4).join(' '),
    k: keywords.join(' '),
    g: subgroup,
    t: row.skin_tone === 'yes',
  });
}

const subgroupOrder = (g) => {
  const M = {
    'face-smiling': 1,
    'face-affection': 2,
    'face-tongue': 3,
    'face-hand': 4,
    'face-sleepy': 5,
    'face-unwell': 6,
    'face-hat': 7,
    'face-glasses': 8,
    'face-concerned': 9,
    'face-neutral': 10,
    'face-costume': 11,
    'face-negative': 12,
    'cat-face': 13,
    'monkey-face': 14,
    'heart': 20,
    'emotion': 21,
    'hand-fingers-open': 30,
    'hand-fingers-partial': 31,
    'hand-fingers-closed': 32,
    'hand-single-finger': 33,
    'hand-prop': 34,
    'body-parts': 40,
    'person': 50,
    'person-gesture': 51,
    'person-resting': 52,
    'person-activity': 53,
    'person-sport': 54,
    'person-role': 55,
    'person-fantasy': 56,
    'family': 57,
    'person-symbol': 58,
    'animal-mammal': 70,
    'animal-bird': 71,
    'animal-amphibian': 72,
    'animal-reptile': 73,
    'animal-marine': 74,
    'animal-bug': 75,
    'plant-flower': 76,
    'plant-other': 77,
    'food-fruit': 80,
    'food-vegetable': 81,
    'food-prepared': 82,
    'food-asian': 83,
    'food-marine': 84,
    'food-sweet': 85,
    'drink': 86,
    'dishware': 87,
    'place-map': 100,
    'place-geographic': 101,
    'place-building': 102,
    'place-religious': 103,
    'place-other': 104,
    'place-park': 105,
    'transport-ground': 106,
    'transport-water': 107,
    'transport-air': 108,
    'hotel': 109,
    'time': 110,
    'sky': 111,
    'weather': 112,
    'event': 120,
    'award-medal': 121,
    'sport': 122,
    'game': 123,
    'arts': 130,
    'crafts': 131,
    'clothing': 140,
    'sound': 150,
    'music': 151,
    'musical-instrument': 152,
    'phone': 160,
    'computer': 161,
    'light': 162,
    'tool': 163,
    'medical': 164,
    'household': 165,
    'office': 166,
    'lock': 167,
    'key': 168,
    'money': 170,
    'email': 180,
    'mailbox': 181,
    'post': 182,
    'writing': 190,
    'book': 191,
    'paper': 192,
    'arrow': 200,
    'religion': 201,
    'zodiac': 202,
    'av-symbol': 210,
    'math': 211,
    'punctuation': 212,
    'currency': 213,
    'other-symbol': 214,
    'alphanum': 215,
    'flag': 220,
    'country-flag': 221,
  };
  return M[g] ?? 999;
};

const seen = new Map();
const CATEGORIES_OUT = [];

const order = ['smileys', 'people', 'animals', 'food', 'travel', 'activities', 'objects', 'symbols', 'flags'];
const labels = {
  'smileys': 'Smileys & Emotion',
  'people': 'People & Body',
  'animals': 'Animals & Nature',
  'food': 'Food & Drink',
  'travel': 'Travel & Places',
  'activities': 'Activities',
  'objects': 'Objects',
  'symbols': 'Symbols',
  'flags': 'Flags',
};
const iconById = {
  'smileys': 'emoji-people-symbolic',
  'people': 'emoji-body-symbolic',
  'animals': 'emoji-nature-symbolic',
  'food': 'emoji-food-symbolic',
  'travel': 'emoji-travel-symbolic',
  'activities': 'emoji-activities-symbolic',
  'objects': 'emoji-objects-symbolic',
  'symbols': 'emoji-symbols-symbolic',
  'flags': 'emoji-flags-symbolic',
};

for (const id of order) {
  const items = buckets.get(id) || [];
  items.sort((a, b) => {
    const ga = subgroupOrder(a.g);
    const gb = subgroupOrder(b.g);
    if (ga !== gb) return ga - gb;
    return a.c.localeCompare(b.c);
  });
  CATEGORIES_OUT.push({ id, icon: iconById[id], label: labels[id], emojis: items });
  console.log(`[${id}] ${items.length} entries`);
}

const out = [];
out.push('import { SKIN_TONE_MODIFIER } from "./constants.js";');
out.push('');
out.push('export const CATEGORIES = [');

for (const cat of CATEGORIES_OUT) {
  out.push('  {');
  out.push(`    id: "${cat.id}",`);
  out.push(`    icon: "${cat.icon}",`);
  out.push(`    label: "${cat.label}",`);
  out.push('    emojis: [');
  for (const e of cat.emojis) {
    const tFlag = e.t ? ', t: true' : '';
    out.push(`      { c: "${e.c}", n: ${JSON.stringify(e.n)}, k: ${JSON.stringify(e.k)}${tFlag} },`);
  }
  out.push('    ],');
  out.push('  },');
}
out.push('];');
out.push('');
out.push('export const ALL_EMOJIS = (() => {');
out.push('  const flat = [];');
out.push('  for (const category of CATEGORIES) {');
out.push('    for (const emoji of category.emojis) {');
out.push('      flat.push({');
out.push('        char: emoji.c,');
out.push('        name: emoji.n,');
out.push('        keywords: (emoji.k || "").split(" ").filter(Boolean),');
out.push('        category: category.id,');
out.push('        tone: emoji.t === true,');
out.push('      });');
out.push('    }');
out.push('  }');
out.push('  return flat;');
out.push('})();');
out.push('');
out.push('export const EMOJI_BY_CHAR = (() => {');
out.push('  const map = new Map();');
out.push('  for (const emoji of ALL_EMOJIS) map.set(emoji.char, emoji);');
out.push('  return map;');
out.push('})();');
out.push('');
out.push('export const CATEGORY_BY_ID = (() => {');
out.push('  const map = new Map();');
out.push('  for (const category of CATEGORIES) map.set(category.id, category);');
out.push('  return map;');
out.push('})();');
out.push('');
out.push('export function applySkinTone(char, tone) {');
out.push('  const emoji = EMOJI_BY_CHAR.get(char);');
out.push('  const modifier = SKIN_TONE_MODIFIER[tone] ?? "";');
out.push('  if (!emoji || !emoji.tone || !modifier) return char;');
out.push('  return char + modifier;');
out.push('}');

const target = join(projectRoot, 'emoji-picker@ArnavK-09', 'src', 'emojiData.js');
writeFileSync(target, out.join('\n') + '\n', 'utf8');
const total = CATEGORIES_OUT.reduce((s, c) => s + c.emojis.length, 0);
console.log(`Total: ${total} emojis written to emojiData.js`);