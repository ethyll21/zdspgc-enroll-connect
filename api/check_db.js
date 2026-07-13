const db = require('./db');

async function check() {
  try {
    const res = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
    console.log("Tables:");
    console.log(res.rows.map(r => r.table_name));
    
    const progRes = await db.query("SELECT * FROM public.programs");
    console.log("\nPrograms:");
    console.log(progRes.rows);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
