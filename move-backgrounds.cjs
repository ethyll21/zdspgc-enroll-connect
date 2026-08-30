const fs = require('fs');
const content = fs.readFileSync('src/routes/_app/apply.tsx', 'utf-8');

// Find the Family and Educational Background sections
const startIndex = content.indexOf('{/* ═══ Family Background ═══ */}');
const endIndexStr = '{/* ═══ Required Documents ═══ */}';
const endIndex = content.indexOf(endIndexStr);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find sections");
  process.exit(1);
}

// The chunk we want to extract
let extracted = content.substring(startIndex, endIndex).trim();

// Remove the `{!isReturning && ` wrappers around the Sections
// Family Background starts with: {!isReturning && <Section title="Family Background" icon={Users}>
extracted = extracted.replace(/\{!isReturning && <Section/g, '<Section');
// and ends with </Section>}
extracted = extracted.replace(/<\/Section>\}/g, '</Section>');

// Create the render function
const renderFunction = `  const renderBackgrounds = () => (
    <>
${extracted.split('\n').map(line => '    ' + line).join('\n')}
    </>
  );
`;

// Now, remove the chunk from the original content
let newContent = content.substring(0, startIndex) +
  '          {!isReturning && renderBackgrounds()}\n\n          ' +
  content.substring(endIndex);

// Insert the render function before `return (` which is around line 425
const returnMatch = newContent.match(/  return \(\r?\n    <div\r?\n      className="mx-auto max-w-4xl/);
if (!returnMatch) {
  console.log("Could not find return statement");
  process.exit(1);
}
const returnIndex = returnMatch.index;
newContent = newContent.substring(0, returnIndex) + renderFunction + '\n' + newContent.substring(returnIndex);

// Find the end of the Old Student form, which is just after STUDENT'S SIGNATURE
const endMatch = newContent.match(/STUDENT'S SIGNATURE<\/p>\r?\n                    <\/div>\r?\n                  <\/div>\r?\n                <\/div>\r?\n/);

if (!endMatch) {
  console.log("Could not find end of old student form");
  process.exit(1);
}
const tableEndIndex = endMatch.index + endMatch[0].length;
// Insert after that block but still inside the `isReturning` block
// The `isReturning` block ends with `              </div>\n            )}`
newContent = newContent.substring(0, tableEndIndex) +
  '\n                <div className="mt-8 mb-4">\n                  {renderBackgrounds()}\n                </div>\n' +
  newContent.substring(tableEndIndex);

fs.writeFileSync('src/routes/_app/apply.tsx', newContent);
console.log("Done");
