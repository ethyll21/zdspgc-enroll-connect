const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 4000,
  path: '/api/notifications/my',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('GET /my:', data));
});
req.end();
