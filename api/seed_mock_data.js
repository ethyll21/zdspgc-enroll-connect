const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    // Programs
    const progsRes = await client.query('SELECT id FROM public.programs');
    const programs = progsRes.rows.map(r => r.id);
    
    if(programs.length === 0) {
      throw new Error("No programs found to link students to.");
    }
    
    // Create mock users
    const mockUsers = [
      { email: 'maria@zdspgc.edu.ph', name: 'Maria Clara', status: 'approved', progIdx: 0 },
      { email: 'juan@zdspgc.edu.ph', name: 'Juan Dela Cruz', status: 'pending', progIdx: 1 },
      { email: 'pedro@zdspgc.edu.ph', name: 'Pedro Penduko', status: 'under_review', progIdx: 2 },
      { email: 'luna@zdspgc.edu.ph', name: 'Luna Lovegood', status: 'rejected', progIdx: 3 }
    ];
    
    for(const u of mockUsers) {
      // Check if exists
      const exists = await client.query('SELECT id FROM auth.users WHERE email = $1', [u.email]);
      if (exists.rows.length > 0) continue;
      
      const userId = uuidv4();
      const hash = await bcrypt.hash('student123', 12);
      
      // auth.users
      await client.query(`
        INSERT INTO auth.users (id, email, password_hash, raw_user_meta_data, is_active, email_verified)
        VALUES ($1, $2, $3, $4::jsonb, true, true)
      `, [userId, u.email, hash, JSON.stringify({ full_name: u.name })]);
      
      // profile
      await client.query(`
        INSERT INTO public.profiles (id, email, full_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO NOTHING
      `, [userId, u.email, u.name]);
      
      // user_roles
      await client.query(`
        INSERT INTO public.user_roles (user_id, role)
        VALUES ($1, 'student')
        ON CONFLICT (user_id, role) DO NOTHING
      `, [userId]);
      
      // student
      const studentId = uuidv4();
      const nameParts = u.name.split(' ');
      const first = nameParts[0];
      const last = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Doe';
      const pId = programs[u.progIdx % programs.length];
      
      await client.query(`
        INSERT INTO public.students (id, user_id, student_no, first_name, last_name, email, contact_number, gender, address, program_id, year_level)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [studentId, userId, 'ST-' + Math.floor(Math.random() * 10000), first, last, u.email, '09123456789', 'other', 'Dimataling, ZDS', pId, 1]);
      
      // enrollment
      const enrollId = uuidv4();
      const remarks = u.status === 'rejected' ? 'Missing requirements' : (u.status === 'approved' ? 'Welcome!' : '');
      await client.query(`
        INSERT INTO public.enrollments (id, student_id, school_year, semester, status, submitted_at, remarks)
        VALUES ($1, $2, $3, $4, $5, NOW(), $6)
      `, [enrollId, studentId, '2026-2027', '1st Semester', u.status, remarks]);
      
      // document
      const docId = uuidv4();
      await client.query(`
        INSERT INTO public.documents (id, student_id, doc_type, file_name, file_path, mime_type, size_bytes, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [docId, studentId, 'form_138', 'dummy_form138.pdf', 'dummy_path.pdf', 'application/pdf', 1024, 'pending']);
      
    }
    
    await client.query('COMMIT');
    console.log('Mock data seeded successfully!');
  } catch(e) {
    await client.query('ROLLBACK');
    console.error('Error seeding mock data:', e);
  } finally {
    client.release();
    process.exit(0);
  }
}
seed();
