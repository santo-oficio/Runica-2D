const fs = require('fs');
// [invalidTitle, needAvatar, needName, needBoth, retry]
const K = {
  es: ['¡Espera!', 'Elige un avatar para continuar.', 'Escribe tu nombre para continuar.', 'Elige un avatar y escribe tu nombre para continuar.', 'Reintentar'],
  en: ['Wait!', 'Choose an avatar to continue.', 'Type your name to continue.', 'Choose an avatar and type your name to continue.', 'Try again'],
  fr: ['Attends !', 'Choisis un avatar pour continuer.', 'Écris ton nom pour continuer.', 'Choisis un avatar et écris ton nom pour continuer.', 'Réessayer'],
  de: ['Moment!', 'Wähle einen Avatar, um fortzufahren.', 'Gib deinen Namen ein, um fortzufahren.', 'Wähle einen Avatar und gib deinen Namen ein, um fortzufahren.', 'Nochmal'],
  it: ['Aspetta!', 'Scegli un avatar per continuare.', 'Scrivi il tuo nome per continuare.', 'Scegli un avatar e scrivi il tuo nome per continuare.', 'Riprova'],
  ja: ['ちょっと待って！', '続けるにはアバターを選んでね。', '続けるには名前を入力してね。', '続けるにはアバターを選んで名前を入力してね。', 'やり直す'],
  zh: ['等一下！', '请选择一个角色再继续。', '请输入你的名字再继续。', '请选择角色并输入名字再继续。', '重试'],
  ru: ['Постой!', 'Выбери аватар, чтобы продолжить.', 'Введи своё имя, чтобы продолжить.', 'Выбери аватар и введи имя, чтобы продолжить.', 'Повторить'],
  tr: ['Bekle!', 'Devam etmek için bir avatar seç.', 'Devam etmek için adını yaz.', 'Devam etmek için bir avatar seç ve adını yaz.', 'Tekrar dene'],
  pl: ['Czekaj!', 'Wybierz awatara, aby kontynuować.', 'Wpisz swoje imię, aby kontynuować.', 'Wybierz awatara i wpisz imię, aby kontynuować.', 'Spróbuj ponownie'],
};
const names = ['selection.invalidTitle', 'selection.needAvatar', 'selection.needName', 'selection.needBoth', 'selection.retry'];
for (const [lang, vals] of Object.entries(K)) {
  const f = `i18n/${lang}.json`;
  const src = JSON.parse(fs.readFileSync(f, 'utf8'));
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    if (names.includes(k)) continue;
    out[k] = v;
    if (k === 'selection.loadingError') names.forEach((n, i) => { out[n] = vals[i]; });
  }
  fs.writeFileSync(f, JSON.stringify(out, null, 2) + '\n');
}
console.log('ok');
