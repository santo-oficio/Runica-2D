const fs = require('fs');
const K = {
  es: ['El tesoro despierta…', '¡El último guardián no se rinde!', 'Los siete mundos te prestan su fuerza'],
  en: ['The treasure awakens…', 'The last guardian won’t give up!', 'The seven worlds lend you their strength'],
  fr: ['Le trésor s’éveille…', 'Le dernier gardien ne renonce pas !', 'Les sept mondes te prêtent leur force'],
  de: ['Der Schatz erwacht …', 'Der letzte Wächter gibt nicht auf!', 'Die sieben Welten leihen dir ihre Kraft'],
  it: ['Il tesoro si risveglia…', 'L’ultimo guardiano non si arrende!', 'I sette mondi ti prestano la loro forza'],
  ja: ['宝が目覚める…', '最後の守護者はまだ倒れない！', '七つの世界が君に力を貸す'],
  zh: ['宝藏苏醒了…', '最后的守护者不肯认输！', '七个世界将力量借给你'],
  ru: ['Сокровище пробуждается…', 'Последний страж не сдаётся!', 'Семь миров отдают тебе свою силу'],
  tr: ['Hazine uyanıyor…', 'Son muhafız pes etmiyor!', 'Yedi dünya sana gücünü veriyor'],
  pl: ['Skarb się budzi…', 'Ostatni strażnik się nie poddaje!', 'Siedem światów użycza ci swojej siły'],
};
const names = ['fin.treasureWakes', 'fin.bossRises', 'fin.worldsPower'];
for (const [lang, vals] of Object.entries(K)) {
  const f = `i18n/${lang}.json`;
  const src = JSON.parse(fs.readFileSync(f, 'utf8'));
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    if (names.includes(k)) continue;
    out[k] = v;
    if (k === 'fin.finalBoss') names.forEach((n, i) => { out[n] = vals[i]; });
  }
  fs.writeFileSync(f, JSON.stringify(out, null, 2) + '\n');
  console.log(lang, 'ok', Object.keys(out).length);
}
