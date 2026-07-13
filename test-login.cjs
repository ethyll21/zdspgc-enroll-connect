const fetch = require('node-fetch') || global.fetch;

async function run() {
  try {
    const loginRes = await global.fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@zdspgc.edu.ph', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    if (!loginData.token) {
      console.log("Login failed", loginData);
      // Let's try changing password or using seed data bypass
    }
  } catch(e) {
    console.error(e);
  }
}

run();
