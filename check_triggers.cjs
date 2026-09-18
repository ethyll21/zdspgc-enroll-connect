const db = require('./api/db');
db.query("SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid = 'public.documents'::regclass")
  .then(res => console.log(res.rows))
  .catch(err => console.error(err))
  .finally(() => process.exit(0));
