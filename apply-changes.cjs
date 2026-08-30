const fs = require('fs');
let content = fs.readFileSync('src/routes/_app/apply.tsx', 'utf-8');

// 1. Hide Required Documents for old students
content = content.replace(
  /{[\s\S]*?═══ Required Documents ═══[\s\S]*?}/,
  "{!isReturning && <>\n          {/* ═══ Required Documents ═══ */}"
);
content = content.replace(
  /<\/Section>\r?\n\r?\n          {\/\* ═══ Student's Pledge ═══ \*\//,
  "</Section>\n          </>}\n\n          {/* ═══ Student's Pledge ═══ */"
);

// 2. Add Student Profile headline and move WRITE IN CAPITAL LETTERS
const studentProfileReplacement = `
                {/* Student Profile Headline */}
                <p className="text-sm font-bold text-red-600 mb-4">WRITE IN CAPITAL LETTERS: Fill-out this Form Correctly & Legibly</p>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="font-display text-base font-bold text-primary">Student Profile</h2>
                </div>
                <hr className="border-border mb-4" />

                {/* Top Info */}`;
content = content.replace(
  /{\/\* Top Info \*\//,
  studentProfileReplacement
);

// 3. New Student Header alignment and remove redundant texts
const newStudentHeader = `      {/* ── NEW STUDENT Header ── */}
      {!isReturning && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-8 shadow-sm">
          <div className="flex justify-between items-center gap-16 mb-6">
            <div className="flex-shrink-0">
              <img src="/logo.png" alt="Logo" className="w-20 h-20 object-contain" />
            </div>
            
            <div className="text-left flex-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-0.5">Republic of the Philippines</p>
              <h1 className="font-display text-base font-bold tracking-tight text-primary leading-tight">
                ZAMBOANGA DEL SUR<br/>PROVINCIAL GOVERNMENT COLLEGE
              </h1>
              <p className="text-sm font-semibold text-primary/80 uppercase mt-0.5">DIMATALING CAMPUS</p>
              <p className="text-sm text-muted-foreground">Dimataling, Zamboanga del Sur</p>
            </div>
            
            <div className="flex-shrink-0">
              <div className="w-28 h-32 border border-gray-400 flex items-center justify-center text-xs text-gray-400 bg-white">
                2x2
              </div>
            </div>
          </div>
        </div>
      )}`;
// Find the original NEW STUDENT Header and replace it
const newHeaderStart = content.indexOf('{/* ── NEW STUDENT Header ── */}');
const oldHeaderStart = content.indexOf('{/* ── OLD STUDENT Header ── */}');
if (newHeaderStart !== -1 && oldHeaderStart !== -1) {
  content = content.substring(0, newHeaderStart) + newStudentHeader + '\n\n' + content.substring(oldHeaderStart);
}

// 4. Old Student Header alignment and province seal
const oldStudentHeader = `      {/* ── OLD STUDENT Header ── */}
      {isReturning && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-8 shadow-sm">
          <div className="flex justify-between items-center gap-10 mb-4">
            {/* Left: Province logo */}
            <div className="flex-shrink-0">
              <img src="/province-logo.png" alt="Province Logo" className="w-20 h-20 object-contain" />
            </div>

            {/* Center: Text */}
            <div className="text-left flex-1">
              <p className="text-xs text-muted-foreground mb-0.5">Republic of the Philippines</p>
              <p className="text-xs text-muted-foreground">Zamboanga Peninsula, Region-IX</p>
              <p className="text-xs font-semibold text-primary/80 uppercase tracking-wide">Province of Zamboanga del Sur</p>
              <h1 className="font-display text-base font-bold tracking-tight text-primary leading-tight mt-0.5">
                ZAMBOANGA DEL SUR PROVINCIAL GOVERNMENT COLLEGE
              </h1>
              <p className="text-sm font-semibold text-primary/80 uppercase tracking-wide">DIMATALING, ZAMBOANGA DEL SUR</p>
            </div>

            {/* Right: School logo */}
            <div className="flex-shrink-0">
              <img src="/logo.png" alt="School Logo" className="w-20 h-20 object-contain" />
            </div>
          </div>
        </div>
      )}`;
const oldHeaderIndex = content.indexOf('{/* ── OLD STUDENT Header ── */}');
const formIndex = content.indexOf('<Form {...form}>');
if (oldHeaderIndex !== -1 && formIndex !== -1) {
  content = content.substring(0, oldHeaderIndex) + oldStudentHeader + '\n\n\n      ' + content.substring(formIndex);
}

// 5. Extract Family and Educational Background and move them
const fbStart = content.indexOf('{/* ═══ Family Background ═══ */}');
const fbEnd = content.indexOf('{!isReturning && <>\n          {/* ═══ Required Documents ═══ */}');
if (fbStart !== -1 && fbEnd !== -1) {
  let extracted = content.substring(fbStart, fbEnd).trim();
  extracted = extracted.replace(/\{!isReturning && <Section/g, '<Section');
  extracted = extracted.replace(/<\/Section>\}/g, '</Section>');
  const renderFunction = `  const renderBackgrounds = () => (
    <>
${extracted.split('\n').map(line => '    ' + line).join('\n')}
    </>
  );
`;
  content = content.substring(0, fbStart) +
    '          {!isReturning && renderBackgrounds()}\n\n          ' +
    content.substring(fbEnd);

  const returnMatch = content.match(/  return \(\r?\n    <div\r?\n      className="mx-auto max-w-4xl/);
  if (returnMatch) {
    content = content.substring(0, returnMatch.index) + renderFunction + '\n' + content.substring(returnMatch.index);
  }

  const endMatch = content.match(/STUDENT'S SIGNATURE<\/p>\r?\n                    <\/div>\r?\n                  <\/div>\r?\n                <\/div>\r?\n/);
  if (endMatch) {
    const tableEndIndex = endMatch.index + endMatch[0].length;
    content = content.substring(0, tableEndIndex) +
      '\n                <div className="mt-8 mb-4">\n                  {renderBackgrounds()}\n                </div>\n' +
      content.substring(tableEndIndex);
  }
}

fs.writeFileSync('src/routes/_app/apply.tsx', content);
console.log("Done");
