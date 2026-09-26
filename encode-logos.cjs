const fs = require('fs');
const logo = fs.readFileSync('public/logo.png', 'base64');
const prov = fs.existsSync('public/province-logo-white.png') ? fs.readFileSync('public/province-logo-white.png', 'base64') : '';

const content = `export const logoBase64 = 'data:image/jpeg;base64,${logo}';\nexport const provBase64 = 'data:image/png;base64,${prov}';\n`;

fs.writeFileSync('src/lib/logos.ts', content);
console.log('Logos encoded successfully.');
