import type { HeroPartDef } from './catalog.js';
const O = 'stroke="{outline}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
const strands = 'fill="none" stroke="{hairLight}" stroke-width="2" stroke-linecap="round"';
const swept = `<path d="M64 65L61 49Q57 29 77 26Q92 15 113 24Q140 23 139 46L136 65L127 49Q112 55 94 43Q82 57 71 52L68 68Z" fill="{hair}" ${O}/>
  <path d="M67 43Q72 30 87 30M82 37Q96 24 113 31M98 37Q113 44 128 36M121 48L132 53" ${strands}/>
  <path d="M65 52L69 65L71 53M128 49L135 62L135 48" fill="{hairDark}"/>`;
export const HAIR_ART: Record<string, Pick<HeroPartDef, 'front' | 'back'>> = {
  'hair.short': { front: swept },
  'hair.ponytail': { front: swept + `<path d="M134 38l7 3-1 9-7-3Z" fill="{accent}" ${O}/>`,
    back: `<path d="M132 35Q163 28 160 60Q156 81 167 93Q145 94 143 72Q140 57 130 55Z" fill="{hair}" ${O}/><path d="M142 43Q154 44 151 62T157 84" ${strands}/>` },
  'hair.buns': { front: swept, back: `<path d="M59 34Q54 16 70 16Q86 16 84 33Q80 46 66 43Z M119 30Q115 12 132 14Q148 18 143 33Q138 45 125 42Z" fill="{hair}" ${O}/><path d="M62 28Q67 18 77 26M124 25Q135 17 139 29" ${strands}/>` },
  'hair.buzz': { front: `<path d="M64 57L64 43Q72 25 99 25Q128 25 136 45L136 59L128 48Q99 40 71 50L68 63Z" fill="{hair}" ${O}/><path d="M72 39l3-4m5 2 3-4m5 2 3-4m5 2 3-3m6 3 3-3m5 5 3-3m5 7 2-3" ${strands}/>` },
  'hair.spiky': { front: `<path d="M63 64L60 45L54 36L75 35L72 22L87 29L96 14L105 29L122 21L121 35L140 33L135 47L137 63L126 49L114 48L100 39L88 49L73 49L68 66Z" fill="{hair}" ${O}/><path d="M68 41L79 41M86 36L95 26M104 35L114 30M115 42L129 40" ${strands}/>` },
  'hair.curly': { front: `<path d="M62 68Q51 61 58 50Q52 39 64 34Q63 22 78 24Q84 12 99 22Q113 11 124 25Q140 22 141 38Q151 49 140 57L137 69L129 54Q119 59 112 48Q103 58 94 48Q82 57 74 50L69 66Z" fill="{hair}" ${O}/><path d="M62 47q-3-8 6-8m6-6q4-8 12-1m7-3q8-7 13 2m8 4q10-7 14 2m3 10q10-2 7 6M79 44q6 7 10 0M104 43q7 7 11-1" ${strands}/>` },
  'hair.long': { back: `<path d="M62 53Q57 24 99 21Q141 22 139 54L144 93L151 110Q136 123 119 109L81 111Q62 120 49 107L58 83Z" fill="{hair}" ${O}/><path d="M64 65Q65 92 58 105M137 66Q131 90 142 109M72 90L68 109M127 88L132 110" ${strands}/>`,
    front: `<path d="M64 65Q57 32 86 25Q114 13 135 34Q144 47 135 65L129 51Q106 56 94 39Q86 53 72 52L69 68Z" fill="{hair}" ${O}/><path d="M68 43Q72 32 85 31M101 29Q112 42 128 40M100 35Q114 48 128 45" ${strands}/>` },
};
