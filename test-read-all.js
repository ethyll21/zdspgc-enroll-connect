const http = require('http');

const data = JSON.stringify({});

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/notifications/read-all',
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': 'zdspgc_token=YOUR_TOKEN_HERE' // Wait, token is in localStorage, not cookie
  }
};

// Instead of doing this, I'll just check if read-all fails because of authentication.
