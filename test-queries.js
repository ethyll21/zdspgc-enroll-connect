import { query } from './api/db.js';

async function testAll() {
  const routes = [
    { name: 'Programs List', text: 'SELECT id, code, name, active, created_at FROM public.programs WHERE active = true ORDER BY code ASC' },
    { name: 'Programs All', text: 'SELECT id, code, name, active, created_at FROM public.programs ORDER BY code ASC' },
    { name: 'Profiles Me', text: 'SELECT p.*, u.email FROM public.profiles p JOIN public.users u ON u.id = p.id LIMIT 1' },
    { name: 'Students Me', text: 'SELECT * FROM public.students LIMIT 1' },
    { name: 'Enrollments My', text: 'SELECT e.*, s.student_no, s.first_name, s.last_name, s.program_id, p.code AS program_code, p.name AS program_name FROM public.enrollments e JOIN public.students s ON s.id = e.student_id LEFT JOIN public.programs p ON p.id = s.program_id ORDER BY e.submitted_at DESC LIMIT 1' },
    { name: 'Enrollments Stats', text: 'SELECT COUNT(*) FILTER (WHERE status = \'pending\') AS pending, COUNT(*) FILTER (WHERE status = \'under_review\') AS under_review, COUNT(*) FILTER (WHERE status = \'approved\') AS approved, COUNT(*) FILTER (WHERE status = \'rejected\') AS rejected, COUNT(*) AS total FROM public.enrollments' },
  ];

  for (const r of routes) {
    try {
      await query(r.text);
      console.log('SUCCESS:', r.name);
    } catch (err) {
      console.log('FAIL:', r.name, err.message);
    }
  }
  process.exit(0);
}

testAll();
