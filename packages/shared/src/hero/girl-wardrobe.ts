/** Нижние полы туники рисуются под выбранной курткой, поверх брюк. */
export const TUNIC = `<g stroke="{outline}" stroke-width="1.8" stroke-linejoin="round">
  <path d="M77 144Q99 150 123 144L137 171Q118 180 101 176Q83 181 63 171Z" fill="{suit}"/>
  <path d="M83 151L78 171M98 153L96 175M117 151L124 172" fill="none" stroke="{suitDark}" stroke-width="3"/>
  <path d="M66 169Q82 175 99 173Q117 177 135 169" fill="none" stroke="{accentLight}" stroke-width="2"/>
</g>`;

const outline = 'stroke="{outline}" stroke-width="2" stroke-linejoin="round"';
export const GIRL_JACKETS: Readonly<Record<string, string>> = {
  'suit.ranger': `
    <path d="M77 104L89 101L101 110L112 101L124 106L121 141L130 158L106 170L98 160L75 169L69 156L79 139Z" fill="{suit}" ${outline}/>
    <path d="M76 106L91 102L101 109L113 101L125 106L118 124L105 119L97 126L81 120Z" fill="{accent}" ${outline}/>
    <path d="M77 143L120 132L124 138L79 150Z" fill="#956746" ${outline}/>
    <path d="M82 143L95 141L96 155L82 158Z" fill="{accentDark}" ${outline}/>
    <path d="M83 145L89 149L95 143M107 161L121 154" fill="none" stroke="{accentLight}" stroke-width="2"/>
    <circle cx="110" cy="138" r="3" fill="#ecc774"/>`,
  'suit.tinker': `
    <path d="M79 103L88 101L91 119H110L113 101L122 104L117 126L126 163Q101 175 74 165L83 126Z" fill="#a9744e" ${outline}/>
    <path d="M86 123H114L117 147L84 148Z" fill="{suit}" ${outline}/>
    <path d="M78 148L123 144L124 150L77 155Z" fill="{accentDark}" ${outline}/>
    <path d="M83 150L96 148L97 160L84 164Z M104 149L117 147L119 159L106 162Z" fill="{accent}" ${outline}/>
    <path d="M109 149L107 137M114 148L117 136" fill="none" stroke="#e0d9bd" stroke-width="3"/>
    <circle cx="89" cy="117" r="2.5" fill="#ebc67e"/><circle cx="112" cy="117" r="2.5" fill="#ebc67e"/>`,
  'suit.navigator': `
    <path d="M76 106L89 100L100 111L111 100L124 105L119 142L133 162L111 179L98 164L79 177L68 162L81 143Z" fill="{suitDark}" ${outline}/>
    <path d="M81 103L91 102L99 112L89 131L81 122Z M110 102L120 106L117 121L102 113Z" fill="{suitLight}" ${outline}/>
    <path d="M79 146L119 134L122 143L76 155Z" fill="{accent}" ${outline}/>
    <path d="M75 164L80 169L92 158M106 164L112 171L126 161" fill="none" stroke="{accentLight}" stroke-width="2"/>
    <path d="M115 136L117 140L122 141L118 144L118 148L114 145L110 147L111 142L108 139L113 139Z" fill="#f6cd7d"/>`,
};
