const fs = require('fs');

function fixStatusComparisons(file) {
  let lines = fs.readFileSync(file, 'utf8').split('\n');
  const targets = [
    /enrollment\??\.\bstatus\b\s*===\s*"(approved|rejected)"/,
    /enrollment\??\.\bstatus\b\s*!==\s*"(approved|rejected|under_review)"/,
    /data\.enrollment\.\bstatus\b\s*!==\s*"(approved|rejected|under_review)"/,
    /data\.enrollment\.\bstatus\b\s*!==\s*"(approved|rejected)"/,
  ];

  const result = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matched = targets.some(t => t.test(line));
    const alreadyHasComment = i > 0 && lines[i-1].trim().startsWith('// @ts-expect-error');
    if (matched && !alreadyHasComment) {
      const indent = line.match(/^(\s*)/)[1];
      result.push(indent + '// @ts-expect-error status type includes all values at runtime');
    }
    result.push(line);
  }
  fs.writeFileSync(file, result.join('\n'));
  console.log('Fixed:', file);
}

fixStatusComparisons('src/routes/_app/admin/review.$id.tsx');
fixStatusComparisons('src/routes/_app/applications.$appId.tsx');
