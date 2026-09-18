const db = require('./api/db');

async function main() {
  const { rows } = await db.query('SELECT * FROM public.documents ORDER BY uploaded_at DESC LIMIT 10');
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
