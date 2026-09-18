const fs = require('fs');

function fix(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/enrollment\.status ===/g, 'String(enrollment.status) ===');
  fs.writeFileSync(file, content);
}

fix('src/routes/_app/admin/review.$id.tsx');
fix('src/routes/_app/applications.$appId.tsx');
console.log('Fixed status comparison');
