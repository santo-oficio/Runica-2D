const fs = require('fs');
const V = {
  es: ['Ver solo el final', 'partida real al boss de MAZMORRA (isla 12): al llegar al tesoro empieza la batalla final en el mismo tablero y termina en los créditos. «Ver solo el final» la lanza sin jugar el puzle. No se guarda nada.'],
  en: ['Watch the ending only', 'real run at the MAZMORRA boss (island 12): reaching the treasure starts the final battle on the same board, ending in the credits. “Watch the ending only” starts it without playing the puzzle. Nothing is saved.'],
  fr: ['Voir seulement la fin', 'vraie partie contre le boss de MAZMORRA (île 12) : atteindre le trésor lance la bataille finale sur le même plateau, jusqu’aux crédits. « Voir seulement la fin » la lance sans jouer le puzzle. Rien n’est sauvegardé.'],
  de: ['Nur das Ende ansehen', 'echte Partie gegen den MAZMORRA-Boss (Insel 12): Am Schatz beginnt der Endkampf auf demselben Spielfeld und endet im Abspann. „Nur das Ende ansehen“ startet ihn ohne das Rätsel. Nichts wird gespeichert.'],
  it: ['Guarda solo il finale', 'partita reale contro il boss di MAZMORRA (isola 12): raggiunto il tesoro inizia la battaglia finale sullo stesso tabellone, fino ai titoli di coda. «Guarda solo il finale» la avvia senza giocare il puzzle. Non si salva nulla.'],
  ja: ['エンディングだけ見る', 'MAZMORRAのボス（島12）との実戦：宝にたどり着くと同じ盤面で最終決戦が始まり、クレジットへ続く。「エンディングだけ見る」はパズルなしで開始。記録なし。'],
  zh: ['只看结局', '与 MAZMORRA Boss 的真实对战（第 12 岛）：到达宝藏后在同一棋盘上展开最终决战，直到制作名单。“只看结局”无需解谜直接开始。不保存记录。'],
  ru: ['Смотреть только финал', 'настоящая битва с боссом MAZMORRA (остров 12): у сокровища на том же поле начинается финальная битва, а затем титры. «Смотреть только финал» запускает её без головоломки. Ничего не сохраняется.'],
  tr: ['Sadece finali izle', 'MAZMORRA boss’u ile gerçek oyun (ada 12): hazineye ulaşınca aynı tahtada final savaşı başlar ve künyeyle biter. «Sadece finali izle» bulmacayı oynamadan başlatır. Hiçbir şey kaydedilmez.'],
  pl: ['Obejrzyj tylko finał', 'prawdziwa gra z bossem MAZMORRA (wyspa 12): po dotarciu do skarbu na tej samej planszy zaczyna się finałowa bitwa, a potem napisy końcowe. „Obejrzyj tylko finał” uruchamia ją bez łamigłówki. Nic się nie zapisuje.'],
};
for (const [lang, [cine, hint]] of Object.entries(V)) {
  const f = `i18n/${lang}.json`;
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j['demo.bossfinal.cine'] = cine;
  j['demo.bossfinal.hint'] = hint;
  fs.writeFileSync(f, JSON.stringify(j, null, 2) + '\n');
}
console.log('ok');
