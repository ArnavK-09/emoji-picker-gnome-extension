#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'src', 'emojiData.js');
const source = readFileSync(target, 'utf8');

const SUBGROUP_RULES = [
  { match: (e) => /face-smiling/i.test(e.k + e.n), tag: '10_face-smiling' },
  { match: (e) => /face-affection/i.test(e.k + e.n), tag: '11_face-affection' },
  { match: (e) => /face-tongue/i.test(e.k + e.n), tag: '12_face-tongue' },
  { match: (e) => /face-hand/i.test(e.k + e.n), tag: '13_face-hand' },
  { match: (e) => /face-sleepy/i.test(e.k + e.n), tag: '14_face-sleepy' },
  { match: (e) => /face-unwell/i.test(e.k + e.n), tag: '15_face-unwell' },
  { match: (e) => /face-hat/i.test(e.k + e.n), tag: '16_face-hat' },
  { match: (e) => /face-glasses/i.test(e.k + e.n), tag: '17_face-glasses' },
  { match: (e) => /face-concerned/i.test(e.k + e.n), tag: '18_face-concerned' },
  { match: (e) => /face-neutral/i.test(e.k + e.n), tag: '19_face-neutral' },
  { match: (e) => /face-costume/i.test(e.k + e.n), tag: '1a_face-costume' },
  { match: (e) => /face-negative/i.test(e.k + e.n), tag: '1b_face-negative' },
  { match: (e) => /cat-face/i.test(e.k + e.n), tag: '1c_cat-face' },
  { match: (e) => /monkey-face/i.test(e.k + e.n), tag: '1d_monkey-face' },
  { match: (e) => /heart/i.test(e.k + e.n) && /heart/.test(e.c), tag: '30_heart' },
  { match: (e) => /emotion/i.test(e.k + e.n), tag: '40_emotion' },
  { match: (e) => /hand-fingers-open/i.test(e.k + e.n), tag: '50_hand-open' },
  { match: (e) => /hand-fingers-partial/i.test(e.k + e.n), tag: '51_hand-partial' },
  { match: (e) => /hand-fingers-closed/i.test(e.k + e.n), tag: '52_hand-closed' },
  { match: (e) => /hand-single-finger/i.test(e.k + e.n), tag: '53_hand-single' },
  { match: (e) => /hand-prop/i.test(e.k + e.n), tag: '54_hand-prop' },
  { match: (e) => /body-parts/i.test(e.k + e.n), tag: '60_body-parts' },
  { match: (e) => /person/i.test(e.k + e.n), tag: '70_person' },
  { match: (e) => /person-gesture/i.test(e.k + e.n), tag: '71_person-gesture' },
  { match: (e) => /person-resting/i.test(e.k + e.n), tag: '72_person-resting' },
  { match: (e) => /person-activity/i.test(e.k + e.n), tag: '73_person-activity' },
  { match: (e) => /person-sport/i.test(e.k + e.n), tag: '74_person-sport' },
  { match: (e) => /person-role/i.test(e.k + e.n), tag: '75_person-role' },
  { match: (e) => /person-fantasy/i.test(e.k + e.n), tag: '76_person-fantasy' },
  { match: (e) => /family/i.test(e.k + e.n), tag: '77_family' },
  { match: (e) => /person-symbol/i.test(e.k + e.n), tag: '78_person-symbol' },
  { match: (e) => /animal-mammal/i.test(e.k + e.n), tag: '80_mammal' },
  { match: (e) => /animal-bird/i.test(e.k + e.n), tag: '81_bird' },
  { match: (e) => /animal-amphibian|animal-reptile/i.test(e.k + e.n), tag: '82_reptile' },
  { match: (e) => /animal-marine/i.test(e.k + e.n), tag: '83_marine' },
  { match: (e) => /animal-bug/i.test(e.k + e.n), tag: '84_bug' },
  { match: (e) => /plant-flower|plant-other/i.test(e.k + e.n), tag: '85_plant' },
  { match: (e) => /food-fruit|food-vegetable|food-prepared|food-asian|food-marine|food-sweet/i.test(e.k + e.n), tag: '90_food' },
  { match: (e) => /drink/i.test(e.k + e.n), tag: '91_drink' },
  { match: (e) => /dishware/i.test(e.k + e.n), tag: '92_dishware' },
  { match: (e) => /place-map|place-geographic|place-building|place-religious|place-other|place-park/i.test(e.k + e.n), tag: 'a0_place' },
  { match: (e) => /transport-ground|transport-water|transport-air/i.test(e.k + e.n), tag: 'a1_transport' },
  { match: (e) => /hotel/i.test(e.k + e.n), tag: 'a2_hotel' },
  { match: (e) => /time/i.test(e.k + e.n), tag: 'a3_time' },
  { match: (e) => /sky|weather/i.test(e.k + e.n), tag: 'a4_sky' },
  { match: (e) => /event/i.test(e.k + e.n), tag: 'a5_event' },
  { match: (e) => /award-medal|sport/i.test(e.k + e.n), tag: 'a6_award-sport' },
  { match: (e) => /game/i.test(e.k + e.n), tag: 'a7_game' },
  { match: (e) => /arts|crafts/i.test(e.k + e.n), tag: 'a8_arts' },
  { match: (e) => /clothing/i.test(e.k + e.n), tag: 'b0_clothing' },
  { match: (e) => /sound/i.test(e.k + e.n), tag: 'b1_sound' },
  { match: (e) => /music/i.test(e.k + e.n), tag: 'b2_music' },
  { match: (e) => /musical-instrument/i.test(e.k + e.n), tag: 'b2_music' },
  { match: (e) => /phone|computer|light|tool|medical|household|office|lock|key|tool-other/i.test(e.k + e.n), tag: 'b3_object' },
  { match: (e) => /money/i.test(e.k + e.n), tag: 'b4_money' },
  { match: (e) => /email|mailbox|post/i.test(e.k + e.n), tag: 'b5_mail' },
  { match: (e) => /writing|book|paper/i.test(e.k + e.n), tag: 'b6_book' },
  { match: (e) => /key|lock/i.test(e.k + e.n), tag: 'b7_lock' },
  { match: (e) => /arrow/i.test(e.k + e.n), tag: 'c0_arrow' },
  { match: (e) => /religion/i.test(e.k + e.n), tag: 'c1_religion' },
  { match: (e) => /zodiac/i.test(e.k + e.n), tag: 'c2_zodiac' },
  { match: (e) => /av-symbol|math/i.test(e.k + e.n), tag: 'c3_av-symbol' },
  { match: (e) => /punctuation/i.test(e.k + e.n), tag: 'c4_punct' },
  { match: (e) => /currency/i.test(e.k + e.n), tag: 'c5_currency' },
  { match: (e) => /other-symbol|alphanum/i.test(e.k + e.n), tag: 'c6_other-symbol' },
  { match: (e) => /flag/i.test(e.k + e.n), tag: 'd0_flag' },
  { match: (e) => /country-flag/i.test(e.k + e.n), tag: 'd1_country-flag' },
];

function subgroupOf(entry) {
  for (const rule of SUBGROUP_RULES) {
    if (rule.match(entry)) return rule.tag;
  }
  return 'z_misc';
}

const reordered = source.replace(
  /(^  \{\s*\n(?:    [^\n]*\n)*?    emojis:\s*\[[\s\S]*?^\s*\],\s*\n  \},)/gm,
  (block) => {
    const idMatch = block.match(/id:\s*"([^"]+)"/);
    if (!idMatch) return block;
    const id = idMatch[1];

    const entries = [];
    const entryRe = /\{\s*c:\s*"([^"]*)"\s*,\s*n:\s*"([^"]*)"\s*,\s*k:\s*"([^"]*)"\s*\}/g;
    let m;
    while ((m = entryRe.exec(block)) !== null) {
      entries.push({ c: m[1], n: m[2], k: m[3] });
    }
    if (entries.length === 0) return block;

    const seen = new Set();
    const seenExact = new Set();
    const unique = entries.filter((e) => {
      const exactKey = `${e.c}|${e.n}|${e.k}`;
      if (seenExact.has(exactKey)) return false;
      seenExact.add(exactKey);
      return true;
    });

    unique.sort((a, b) => {
      const sa = subgroupOf(a);
      const sb = subgroupOf(b);
      if (sa !== sb) return sa.localeCompare(sb);
      return a.c.localeCompare(b.c);
    });

    const indent = '      ';
    const rebuilt = unique.map((e) => `${indent}{ c: "${e.c}", n: "${e.n}", k: "${e.k}" },`).join('\n');

    const totalUniqueChars = new Set(unique.map((e) => e.c)).size;
    console.log(`[${id}] in=${entries.length} dedupExact=${unique.length} uniqueChars=${totalUniqueChars}`);

    return block.replace(/\s*emojis:\s*\[[\s\S]*?\]\s*,/, `\n    emojis: [\n${rebuilt}\n    ],`);
  },
);

writeFileSync(target, reordered, 'utf8');
console.log('emojiData.js: reordered each category by subgroup.');
console.log('Total entries:', (reordered.match(/c: "/g) || []).length);