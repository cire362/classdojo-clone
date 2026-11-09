import type { HeroPartDef, HeroParts } from './catalog.js';
const O = 'stroke="{outline}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const brass = '#d8b575';
const parts: HeroPartDef[] = [
  { id: 'pose.map', layer: 'pose', name: 'Читаю карту', requiredLevel: 2, front: `
    <path d="M74 110Q58 124 67 141L83 144M126 110Q142 124 133 141L117 144" fill="none" stroke="{outline}" stroke-width="20" stroke-linecap="round"/>
    <path d="M74 110Q58 124 67 141L83 144M126 110Q142 124 133 141L117 144" fill="none" stroke="{suit}" stroke-width="15" stroke-linecap="round"/>
    <path d="M78 128L94 124L108 128L122 124L121 155L107 160L94 156L79 160Z" fill="#e4d6b0" ${O}/>
    <path d="M94 125v30m14-27-1 30" stroke="#b2a17c" stroke-width="1.2"/>
    <path d="M83 150L91 135L102 145L117 133" fill="none" stroke="#6a8761" stroke-width="2" stroke-dasharray="3 2"/>
    <circle cx="117" cy="133" r="3" fill="{accentDark}"/>
    <path d="M77 138Q69 137 72 145L79 150L83 145L81 140Z M123 137Q131 136 129 144L121 150L117 144L120 139Z" fill="{accent}" ${O}/>` },
  { id: 'pose.lantern', layer: 'pose', name: 'Освещаю путь', requiredLevel: 4, front: `
    <path d="M74 110Q62 129 62 150M126 110Q140 128 151 121" fill="none" stroke="{outline}" stroke-width="20" stroke-linecap="round"/>
    <path d="M74 110Q62 129 62 150M126 110Q140 128 151 121" fill="none" stroke="{suit}" stroke-width="15" stroke-linecap="round"/>
    <circle cx="62" cy="154" r="8" fill="{accent}" ${O}/>
    <path d="M146 127Q140 147 153 147Q165 147 159 128Z" fill="none" stroke="${brass}" stroke-width="2"/>
    <path d="M140 147L166 147L164 174L143 174Z" fill="#f2d38a" ${O}/>
    <path d="M143 148L147 143H160L164 148M143 174h21" fill="none" stroke="${brass}" stroke-width="5"/>
    <path d="M149 150v19m9-19v19" stroke="#8f734c" stroke-width="1.5"/>
    <path d="M151 163L153 154L158 166L153 169Z" fill="#fff8d7"/>
    <path d="M145 119Q145 111 152 113L160 118L158 126L150 129L145 124Z" fill="{accent}" ${O}/>` },

  { id: 'emblem.gear', layer: 'emblem', name: 'Шестерёнка', requiredLevel: 3, front:
    `<path d="M94 111h12l1 5 5-2 5 9-4 4 4 4-5 9-5-2-1 5H94l-1-5-5 2-5-9 4-4-4-4 5-9 5 2Z" fill="${brass}" ${O}/><circle cx="100" cy="127" r="6" fill="{suitDark}" ${O}/>` },
  { id: 'emblem.compass', layer: 'emblem', name: 'Компас', requiredLevel: 6, front:
    `<circle cx="100" cy="124" r="14" fill="${brass}" ${O}/><circle cx="100" cy="124" r="10" fill="{suitDark}"/><path d="M103 114L104 127L97 135L96 122Z" fill="#fff0bf"/><path d="M103 114L100 125L96 122Z" fill="{accent}"/>` },
  { id: 'suit.ranger', layer: 'suit', name: 'Куртка следопыта', requiredLevel: 1, front: `
    <path d="M78 104L91 101L100 112L111 101L122 105L126 153L119 172L103 163L100 144L97 164L79 172L73 154Z" fill="{suit}" ${O}/>
    <path d="M77 106L88 102L97 112L88 123L79 116Z M112 102L123 107L120 119L109 122L103 112Z" fill="{accentDark}" ${O}/>
    <path d="M81 107L88 106L92 112M110 112L114 107L120 109" fill="none" stroke="{accentLight}" stroke-width="2"/>
    <path d="M80 118L84 151M121 117L116 151" fill="none" stroke="#d7c5a1" stroke-width="6"/>
    <path d="M76 148Q100 155 125 148L125 156Q100 162 76 156Z" fill="#70574a" ${O}/>
    <rect x="96" y="149" width="9" height="9" rx="2" fill="${brass}" ${O}/><path d="M100 151v5" stroke="{outline}"/>
    <path d="M76 136L90 138L89 150L76 148Z M110 137L124 135L124 148L111 150Z" fill="{accent}" ${O}/>
    <path d="M77 140L89 142M112 141L123 139" stroke="{accentLight}" stroke-width="1.5"/>
    <path d="M108 158L121 159L120 176L109 176Z" fill="#8a6953" ${O}/><path d="M110 161h9" stroke="${brass}" stroke-width="2"/>
  ` },
  { id: 'suit.tinker', layer: 'suit', name: 'Жилет механика', requiredLevel: 3, front: `
    <path d="M78 104L88 102L95 119L92 150L78 156L73 141Z M111 102L122 105L127 142L120 157L108 151L105 119Z" fill="{suitDark}" ${O}/>
    <path d="M81 108L86 106L90 119L82 129Z M114 106L119 109L118 129L110 119Z" fill="{accent}" ${O}/>
    <path d="M80 133h9m22 0h10" stroke="{suitLight}" stroke-width="2"/>
    <path d="M74 147L126 147L126 158L74 158Z" fill="#70574a" ${O}/>
    <rect x="96" y="147" width="10" height="12" rx="2" fill="${brass}" ${O}/>
    <path d="M78 141v18m5-20v20" stroke="{outline}" stroke-width="4"/>
    <path d="M78 140v13" stroke="#d9dbce" stroke-width="2"/><path d="M82 136h4v8h-4Z" fill="{accent}" ${O}/>
    <path d="M111 147L123 147L123 169L112 173Z" fill="{accentDark}" ${O}/>
    <circle cx="117" cy="156" r="4" fill="${brass}" ${O}/><path d="M117 152v8m-4-4h8" stroke="{outline}"/>
    <path d="M78 167L92 168L91 180L79 181Z" fill="{accent}" ${O}/><path d="M81 170L89 171" stroke="{accentLight}" stroke-width="2"/>
  ` },
  { id: 'suit.navigator', layer: 'suit', name: 'Мундир навигатора', requiredLevel: 6, front: `
    <path d="M77 105L88 100L100 113L112 100L123 105L128 158L119 180L102 163L100 146L97 163L80 180L72 157Z" fill="{suitDark}" ${O}/>
    <path d="M80 106L87 147L79 170M120 106L113 147L121 170" fill="none" stroke="{accent}" stroke-width="5"/>
    <path d="M88 101L97 115L88 126L82 110Z M112 101L103 115L112 126L118 110Z" fill="{suitLight}" ${O}/>
    <path d="M85 107L89 116M115 107L111 116" stroke="{accentLight}" stroke-width="2"/>
    <path d="M78 144Q100 150 122 144L123 153Q100 160 77 153Z" fill="{accentDark}" ${O}/>
    <circle cx="100" cy="150" r="5" fill="${brass}" ${O}/><path d="M100 146L102 151L98 153Z" fill="{outline}"/>
    <path d="M79 130L90 134L84 141M120 130L111 134L117 141" fill="none" stroke="${brass}" stroke-width="1.4"/>
    <circle cx="85" cy="163" r="2" fill="${brass}"/><circle cx="115" cy="163" r="2" fill="${brass}"/>
  ` },
  { id: 'cape.satchel', layer: 'cape', name: 'Походный рюкзак', requiredLevel: 1,
    back: `<path d="M66 112Q100 97 134 112L140 151Q138 171 124 174L73 174Q59 167 60 152Z" fill="#856345" ${O}/>
      <path d="M66 116L67 153Q100 164 134 151L134 116Z" fill="#ab875b"/>
      <rect x="58" y="105" width="84" height="18" rx="8" fill="{accentDark}" ${O}/>
      <path d="M69 105v18m60-18v18" stroke="#cfb98e" stroke-width="5"/>
      <path d="M58 132L69 130L69 158L58 159Z" fill="{suitDark}" ${O}/>
      <path d="M134 129L145 131L146 158L135 157Z" fill="{accent}" ${O}/>
      <path d="M137 130v-7h6v8" fill="none" stroke="${brass}" stroke-width="2"/>`,
    front: `<path d="M79 106L82 130M121 106L118 130" stroke="#c9ac7a" stroke-width="5"/>
      <rect x="78" y="126" width="7" height="7" rx="1" fill="${brass}" ${O}/>
      <rect x="115" y="126" width="7" height="7" rx="1" fill="${brass}" ${O}/>` },
  { id: 'cape.workshop', layer: 'cape', name: 'Мастерская за спиной', requiredLevel: 4,
    back: `<path d="M65 105L136 105L140 164L61 164Z" fill="#8b6f50" ${O}/>
      <rect x="54" y="114" width="17" height="49" rx="7" fill="{accentDark}" ${O}/>
      <path d="M55 123h15m-15 30h15" stroke="${brass}" stroke-width="4"/>
      <path d="M134 114L150 109L155 133L142 139Z" fill="{suitLight}" ${O}/>
      <path d="M146 109L143 99L150 95L154 105" fill="none" stroke="${brass}" stroke-width="4"/>
      <circle cx="146" cy="123" r="4" fill="{suitDark}" ${O}/>
      <path d="M57 142C38 141 39 172 64 172" fill="none" stroke="{outline}" stroke-width="6"/>
      <path d="M57 142C38 141 39 172 64 172" fill="none" stroke="${brass}" stroke-width="3"/>`,
    front: `<path d="M80 106L86 135M120 106L114 135" stroke="#70574a" stroke-width="5"/>` },
  { id: 'cape.glider', layer: 'cape', name: 'Крылья-паруса', requiredLevel: 8,
    back: `<path d="M79 105L28 71L18 126L56 169L80 150Z M121 105L172 71L182 126L144 169L120 150Z" fill="{accent}" ${O}/>
      <path d="M79 105L23 119L56 169Z M121 105L177 119L144 169Z" fill="{accentDark}"/>
      <path d="M79 105L28 71M79 105L18 126M79 105L56 169M121 105L172 71M121 105L182 126M121 105L144 169"
        stroke="#d6be8b" stroke-width="2.6" fill="none"/>
      <path d="M33 83L28 108M167 83L172 108" stroke="{accentLight}" stroke-width="3" fill="none"/>
      <circle cx="76" cy="111" r="7" fill="${brass}" ${O}/><circle cx="124" cy="111" r="7" fill="${brass}" ${O}/>`,
    front: `<path d="M79 106L86 131M121 106L114 131" stroke="{accentDark}" stroke-width="5"/>` },
  { id: 'mask.trail', layer: 'mask', name: 'Очки на лбу', requiredLevel: 2, overHair: true, front: `
    <path d="M65 38Q100 29 136 38" fill="none" stroke="#70574a" stroke-width="7"/>
    <path d="M69 34L92 31L95 46L72 49Z M106 31L129 34L127 49L104 46Z" fill="${brass}" ${O}/>
    <path d="M74 36L89 34L91 44L76 46Z M109 34L124 36L122 46L108 44Z" fill="#477e82" ${O}/>
    <path d="M77 38L86 36M111 37L120 39" stroke="#c6eeea" stroke-width="2"/>
    <path d="M95 39h9" stroke="{outline}" stroke-width="3"/>` },
  { id: 'mask.magnifier', layer: 'mask', name: 'Линза мастера', requiredLevel: 5, overHair: true, front: `
    <path d="M65 43Q100 31 134 44" fill="none" stroke="#70574a" stroke-width="6"/>
    <path d="M123 42L136 49L132 64" fill="none" stroke="${brass}" stroke-width="5"/>
    <circle cx="119" cy="67" r="12" fill="#b9e5df" fill-opacity=".35" ${O}/>
    <circle cx="119" cy="67" r="10" fill="none" stroke="${brass}" stroke-width="2"/>
    <path d="M112 63L117 59" stroke="#fff9ef" stroke-width="2"/>` },
  { id: 'mask.pilot', layer: 'mask', name: 'Шлем воздухоплавателя', requiredLevel: 7, hidesHair: true, front: `
    <path d="M62 64L59 45Q60 18 100 18Q140 18 141 45L138 69L128 73L126 52Q100 39 74 52L72 73L63 70Z" fill="{suitDark}" ${O}/>
    <path d="M65 43Q100 20 136 43" fill="none" stroke="{suitLight}" stroke-width="6"/>
    <path d="M96 20L95 43M104 20L105 43" stroke="{accent}" stroke-width="2"/>
    <rect x="70" y="34" width="25" height="16" rx="7" fill="${brass}" ${O}/>
    <rect x="105" y="34" width="25" height="16" rx="7" fill="${brass}" ${O}/>
    <rect x="74" y="38" width="17" height="8" rx="3" fill="#48787a"/><rect x="109" y="38" width="17" height="8" rx="3" fill="#48787a"/>
    <path d="M77 40h10m25 0h10M95 42h10" stroke="#d8eee3" stroke-width="2"/>
    <circle cx="66" cy="65" r="6" fill="{accent}" ${O}/><circle cx="134" cy="65" r="6" fill="{accent}" ${O}/>` },
];
export const EXPEDITION_PARTS: HeroPartDef[] = parts.map((p) => ({ ...p, themed: true, collection: 'expedition' }));

/** Примеры сочетаний, не отдельные скины: каждую вещь можно заменить. */
export const HERO_LOOKS: { name: string; detail: string; parts: Partial<HeroParts> }[] = [
  { name: 'Следопыт', detail: 'Куртка, рюкзак и медные очки', parts: {
    suit: 'suit.ranger', cape: 'cape.satchel', mask: 'mask.trail', pose: 'pose.stand',
    suitColor: 'color.teal', accentColor: 'color.orange', emblem: 'emblem.star',
  } },
  { name: 'Механик', detail: 'Жилет, линза и переносная мастерская', parts: {
    suit: 'suit.tinker', cape: 'cape.workshop', mask: 'mask.magnifier', pose: 'pose.hips',
    suitColor: 'color.orange', accentColor: 'color.teal', emblem: 'emblem.gear',
  } },
  { name: 'Навигатор', detail: 'Мундир, лётный шлем и крылья-паруса', parts: {
    suit: 'suit.navigator', cape: 'cape.glider', mask: 'mask.pilot', pose: 'pose.stand',
    suitColor: 'color.blue', accentColor: 'color.gold', emblem: 'emblem.compass',
  } },
];
