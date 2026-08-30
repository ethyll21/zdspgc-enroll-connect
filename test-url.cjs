const db = require('./api/db');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'zdspgc-pre-enrollment-secret-key-2026';

db.query("SELECT * FROM documents WHERE file_name = '9ba67e0a-b921-4eca-ae97-81c7c37d8966.jpg'").then(res => {
  const doc = res.rows[0];
  db.query("SELECT * FROM students WHERE id = $1", [doc.student_id]).then(sRes => {
    const student = sRes.rows[0];
    const token = jwt.sign({ id: student.user_id, email: student.email, role: 'student' }, JWT_SECRET, { expiresIn: '7d' });
    console.log(`http://localhost:4000/api/documents/file/${doc.id}?token=${token}`);
    process.exit(0);
  });
});
