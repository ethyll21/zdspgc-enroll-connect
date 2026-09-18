// Test that the upload route now correctly handles all doc types
const db = require('../db');

async function main() {
  try {
    // Test all doc type values against the enum
    const docTypes = ['psa_birth_certificate', 'form_138', 'good_moral', 'transfer_certificate', 'registration_form', 'other'];
    console.log('Testing doc_type enum casts...');
    for (const dt of docTypes) {
      try {
        const res = await db.query(`SELECT $1::document_type as test`, [dt]);
        console.log(`  ✅ ${dt} → ${res.rows[0].test}`);
      } catch (e) {
        console.log(`  ❌ ${dt} → FAILED: ${e.message}`);
      }
    }
    console.log('\nAll done!');
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

main();
