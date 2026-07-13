const { v4: uuidv4 } = require('uuid');
const db = require('./db');

async function update() {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    console.log('Altering students table...');
    // Drop the old column and add the new ones
    await client.query(`
      ALTER TABLE public.students 
      DROP COLUMN IF EXISTS previous_school,
      ADD COLUMN IF NOT EXISTS primary_school VARCHAR(255),
      ADD COLUMN IF NOT EXISTS primary_year_graduated VARCHAR(4),
      ADD COLUMN IF NOT EXISTS secondary_school VARCHAR(255),
      ADD COLUMN IF NOT EXISTS secondary_year_graduated VARCHAR(4);
    `);

    console.log('Updating programs...');
    // We can't TRUNCATE CASCADE easily without wiping students, so let's delete existing programs and create new ones.
    // Wait, foreign keys in `students` and `enrollments` rely on program_id. Let's just create the new ones, then update existing students/enrollments to randomly point to the new ones, then delete the old programs.
    
    const actId = uuidv4();
    const bsisId = uuidv4();
    const bspeId = uuidv4();

    await client.query(`
      INSERT INTO public.programs (id, code, name, active)
      VALUES 
        ($1, 'ACT', 'Associate in Computer Technology', true),
        ($2, 'BSIS', 'Bachelor of Science in Information System', true),
        ($3, 'BSPE', 'Bachelor of Science in Physical Education', true)
    `, [actId, bsisId, bspeId]);

    const newProgIds = [actId, bsisId, bspeId];
    
    // Get old programs
    const oldRes = await client.query(`SELECT id FROM public.programs WHERE id NOT IN ($1, $2, $3)`, [actId, bsisId, bspeId]);
    const oldProgIds = oldRes.rows.map(r => r.id);

    // Update students and enrollments to use a random new program if they point to an old one
    console.log('Updating foreign keys to new programs...');
    for (const oldId of oldProgIds) {
      const newId = newProgIds[Math.floor(Math.random() * newProgIds.length)];
      await client.query(`UPDATE public.students SET program_id = $1 WHERE program_id = $2`, [newId, oldId]);
    }

    // Now delete old programs
    if (oldProgIds.length > 0) {
      console.log('Deleting old programs...');
      const placeholders = oldProgIds.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(`DELETE FROM public.programs WHERE id IN (${placeholders})`, oldProgIds);
    }

    // Fill mock data for new educational fields for existing students so they don't crash
    console.log('Updating existing students with mock educational background...');
    await client.query(`
      UPDATE public.students 
      SET primary_school = 'Sample Primary School', 
          primary_year_graduated = '2016', 
          secondary_school = 'Sample Secondary School', 
          secondary_year_graduated = '2022'
      WHERE primary_school IS NULL
    `);

    await client.query('COMMIT');
    console.log('Database updated successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating database:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

update();
