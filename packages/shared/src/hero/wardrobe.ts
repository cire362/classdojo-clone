import type { HeroPartDef } from './catalog.js';
const O = 'stroke="{outline}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
const seam = 'fill="none" stroke="{suitLight}" stroke-width="1.2" stroke-linecap="round"';
const buckle = (x: number, y: number) => `<rect x="${x}" y="${y}" width="7" height="8" rx="1.5" fill="#d4b67a" ${O}/><path d="M${x + 3.5} ${y + 1}v6" stroke="{outline}"/>`;
const pocket = (x: number, y: number) => `<path d="M${x} ${y}h14v15q-7 5-14 0Z" fill="{accentDark}" ${O}/><path d="M${x} ${y}h14l-2 6h-10Z" fill="{accent}" ${O}/><circle cx="${x + 7}" cy="${y + 4}" r="1.2" fill="#e2c58a"/>`;
const belt = `<path d="M74 148 Q100 153 127 147 L127 154 Q100 160 74 155Z" fill="#695147" ${O}/>${buckle(97, 148)}`;
const seams = `<path d="M82 162l-1 16m37-16 1 16" ${seam}/>`;

/** Новые рисунки существующих вещей: id и уровни прежние, сохранённые комбинации не меняются. */
export const WARDROBE_ART: Record<string, Pick<HeroPartDef, 'front' | 'back'>> = {
  'suit.classic': { front: `
    <path d="M77 105 L91 102 L99 115 L110 103 L122 106 L126 146 L118 169 L102 161 L99 137 L95 162 L78 169 L73 147Z" fill="{suit}" ${O}/>
    <path d="M77 108 L91 104 L94 118 L84 125Z M110 104 L121 108 L116 124 L104 117Z" fill="{accent}" ${O}/>
    <path d="M80 129L83 156M119 129L116 155" ${seam}/>
    ${belt}${pocket(76, 140)}${pocket(111, 139)}${seams}
    <path d="M78 167L94 165M106 166L119 168" stroke="{accentLight}" stroke-width="2"/>
  ` },
  'suit.sport': { front: `
    <path d="M78 103L88 102Q100 112 113 102L122 105L127 148Q100 160 73 149Z" fill="{suit}" ${O}/>
    <path d="M82 106L86 135M119 106L115 135" stroke="{accent}" stroke-width="6"/>
    <path d="M88 103L97 114L100 110L104 114L113 103" fill="none" stroke="{suitLight}" stroke-width="3"/>
    <path d="M100 113v31" stroke="{outline}" stroke-width="1.4"/><rect x="98" y="135" width="4" height="7" rx="1" fill="#e6d9ac"/>
    <path d="M81 130L91 133M110 133L120 130" ${seam}/>
    <path d="M75 148Q100 155 126 147L126 154Q100 162 74 155Z" fill="{accentDark}" ${O}/>
    <path d="M80 154L79 160M84 155L83 161M116 155L117 160M120 153L121 159" stroke="{accentLight}"/>
    <path d="M77 166L91 167L91 181L78 183Z" fill="{accent}" ${O}/><path d="M78 170L91 171" ${seam}/>
    ${seams}
  ` },
  'suit.armor': { front: `
    <path d="M77 103L91 104L98 117L92 146L76 139Z M109 104L123 103L125 139L108 146L102 117Z" fill="{suitDark}" ${O}/>
    <path d="M78 106L90 107L94 119L81 125Z M110 107L120 106L118 126L106 119Z" fill="{suitLight}" ${O}/>
    <path d="M81 129L92 126M108 126L119 129" stroke="{accent}" stroke-width="3"/>
    <path d="M85 135L89 135M111 135L115 135" stroke="{outline}" stroke-width="2"/>
    ${belt}<path d="M76 157L92 157L92 169L78 174Z M108 157L124 157L122 174L108 169Z" fill="{suitLight}" ${O}/>
    <path d="M79 161L88 162M112 162L121 161" stroke="white" opacity=".5"/>
    <circle cx="86" cy="183" r="7" fill="{accentDark}" ${O}/><circle cx="114" cy="183" r="7" fill="{accentDark}" ${O}/>
    <path d="M83 181h6M111 181h6" stroke="{accentLight}" stroke-width="2"/>
  ` },
  'suit.lightning': { front: `
    <path d="M79 103L91 105L99 120L108 104L121 106L122 149L109 161L91 159L77 148Z" fill="{suitDark}" ${O}/>
    <path d="M84 105L90 122L82 132L91 141L82 151 M116 106L110 122L118 132L109 141L118 151" fill="none" stroke="{accent}" stroke-width="4"/>
    <path d="M84 105L90 122L82 132M116 106L110 122L118 132" fill="none" stroke="{accentLight}" stroke-width="1.4"/>
    <path d="M91 147L109 147L112 154L100 161L88 154Z" fill="{accent}" ${O}/>
    <path d="M81 169L89 178L81 185 M119 169L111 178L119 185" fill="none" stroke="{accent}" stroke-width="3"/>
  ` },
  'suit.starry': { front: `
    <path d="M79 104L91 103L100 115L109 103L121 104L128 158L114 175L101 162L86 175L72 159Z" fill="{suitDark}" ${O}/>
    <path d="M82 105L88 145L79 161M118 105L112 145L121 161" fill="none" stroke="{accent}" stroke-width="3"/>
    <path d="M80 128L89 136L83 146M118 128L111 134L118 145" fill="none" stroke="{accentLight}" stroke-width=".8"/>
    ${[ [80,128],[89,136],[83,146],[118,128],[111,134],[118,145],[86,163],[115,166] ].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#ffdf94"/>`).join('')}
    ${belt}<path d="M82 164L85 180M118 164L115 180" stroke="{accentLight}" stroke-width="2"/>
  ` },
  'suit.cosmic': { front: `
    <path d="M78 105Q100 115 122 105L126 145L117 161L83 161L74 145Z" fill="{suitDark}" ${O}/>
    <path d="M79 109L90 123L86 144M121 109L110 123L114 144" fill="none" stroke="#a9e5d9" stroke-width="4"/>
    <path d="M76 146Q100 153 124 146" fill="none" stroke="#d9eee1" stroke-width="6"/>
    <path d="M83 161L88 177L82 189M117 161L112 177L118 189" fill="none" stroke="#a9e5d9" stroke-width="3"/>
    <circle cx="82" cy="132" r="3" fill="{accent}" ${O}/><circle cx="118" cy="132" r="3" fill="{accent}" ${O}/>
    <path d="M82 136C65 151 70 173 83 174" fill="none" stroke="{outline}" stroke-width="5"/>
    <path d="M82 136C65 151 70 173 83 174" fill="none" stroke="{accent}" stroke-width="2.5"/>
  ` },
  'suit.knight': { front: `
    <path d="M77 105L89 101L100 111L111 101L123 105L121 139L100 150L79 139Z" fill="{suitLight}" ${O}/>
    <path d="M100 111L100 149L120 138L121 108L110 105Z" fill="{suitDark}"/>
    <path d="M82 110L88 107L96 115M104 115L111 108L118 111" fill="none" stroke="{accentLight}" stroke-width="2"/>
    <path d="M80 131L96 139M104 139L120 131" fill="none" stroke="{accent}" stroke-width="3"/>
    ${belt}<path d="M77 156L95 157L92 180L75 174Z M105 157L123 156L125 174L108 180Z" fill="{suitLight}" ${O}/>
    <path d="M78 162L92 165M77 168L92 171M108 165L122 162M108 171L123 168" stroke="{suitDark}" stroke-width="2"/>
  ` },
  'suit.legend': { front: `
    <path d="M78 103L87 100L100 112L113 100L122 103L128 155L117 181L103 164L100 145L97 164L83 181L72 155Z" fill="{suitDark}" ${O}/>
    <path d="M80 104L86 151L79 169M120 104L114 151L121 169" fill="none" stroke="#d5b16a" stroke-width="4"/>
    <path d="M84 106L89 141M116 106L111 141" fill="none" stroke="#fff0bf" stroke-width="1.2"/>
    <path d="M80 132L85 135L81 142M120 132L115 135L119 142" fill="none" stroke="#d5b16a" stroke-width="2"/>
    <path d="M88 150L100 144L112 150L100 161Z" fill="#d5b16a" ${O}/><path d="M100 147L105 151L100 156L95 151Z" fill="{accent}"/>
    <path d="M83 171L88 166M117 171L112 166" stroke="#fff0bf" stroke-width="2"/>
  ` },
  'suit.astro': { front: `
    <path d="M78 106Q100 118 122 106L126 148L118 160L81 160L74 148Z" fill="#deded5" ${O}/>
    <path d="M80 110L87 146M120 110L113 146" stroke="{suit}" stroke-width="8"/>
    <rect x="88" y="130" width="24" height="14" rx="4" fill="{suitDark}" ${O}/>
    <circle cx="94" cy="137" r="2" fill="#ddac66"/><circle cx="101" cy="137" r="2" fill="#a9e5d9"/>
    <path d="M106 134v6M75 151h50" stroke="{outline}" stroke-width="2"/>
    <path d="M86 142C65 145 67 170 81 172" fill="none" stroke="{outline}" stroke-width="5"/>
    <path d="M86 142C65 145 67 170 81 172" fill="none" stroke="{accent}" stroke-width="2.5"/>
  ` },
};
