const db = require('./api/db.js');
db.query(`DELETE FROM public.documents WHERE file_name = 'test'`)
.then(r => console.log('Deleted test document', r.rowCount))
.catch(console.error)
.finally(()=>process.exit(0));
