console.log('=== NEW SIMPLE SERVER STARTING ===');

const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

// CORS middleware - handle preflight requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

app.get('/', (req, res) => {
  console.log('NEW SERVER: Root request received');
  res.json({ 
    message: 'NEW SIMPLE SERVER IS RUNNING',
    version: '2.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', version: '2.0' });
});

app.post('/api/auth/login', (req, res) => {
  console.log('NEW SERVER: Login request received:', req.body);
  
  const { email, password } = req.body;
  
  // Simple hardcoded check
  if (email === 'admin@nursery.com' && password === 'admin123') {
    res.json({
      message: 'Login successful',
      token: 'fake-token-for-testing',
      user: {
        id: 1,
        username: 'admin',
        email: 'admin@nursery.com',
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({
      message: 'Invalid credentials'
    });
  }
});

// Test endpoint to verify CORS
app.get('/api/test', (req, res) => {
  res.json({
    message: 'CORS test successful',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log('=== NEW SIMPLE SERVER RUNNING ON PORT', PORT, '===');
});
