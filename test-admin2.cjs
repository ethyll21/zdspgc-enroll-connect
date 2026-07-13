async function run() {
  try {
    const loginRes = await global.fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@zdspgc.edu.ph', password: 'admin1234' })
    });
    const loginData = await loginRes.json();
    if (!loginData.token) {
      console.log("Login failed", loginData);
      process.exit(1);
    }
    
    const token = loginData.token;
    console.log("Got admin token");

    const enrollRes = await global.fetch('http://localhost:4000/api/enrollments?limit=200', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!enrollRes.ok) {
      console.log("Enrollment fetch failed HTTP", enrollRes.status);
      console.log(await enrollRes.text());
    } else {
      const data = await enrollRes.json();
      console.log("Got enrollments:", data.enrollments?.length, "total:", data.total);
    }
  } catch(e) {
    console.error(e);
  }
}

run();
