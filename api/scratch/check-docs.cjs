const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_JWXpKe0xof7P@ep-gentle-truth-a5y6kqnu-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function run() {
  const res = await pool.query('SELECT * FROM public.documents ORDER BY created_at DESC LIMIT 5');
  console.log("Documents:", res.rows);
  const res2 = await pool.query('SELECT id, user_id, first_name, last_name FROM public.students ORDER BY created_at DESC LIMIT 5');
  console.log("Students:", res2.rows);
  process.exit(0);
}
run();
