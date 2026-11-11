// Сборка: src/template.html + src/*.js -> index.html (один самодостаточный файл).
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
let html = src('template.html');
for (const n of ['telegram', 'i18n', 'engine', 'bots', 'hint', 'ui']) html = html.replace('/*@' + n + '*/', () => src(n + '.js'));
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html', html.length);
