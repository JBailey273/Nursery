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

// In-memory sample data to satisfy front-end requests
const customers = [
  {
    id: 1,
    name: 'Sample Customer',
    phone: '555-1234',
    email: 'sample@example.com',
    addresses: [{ address: '123 Main St', notes: '' }],
    notes: '',
    contractor: false
  }
];

const products = [
  {
    id: 1,
    name: 'Premium Mulch',
    unit: 'yards',
    retail_price: 45.0,
    contractor_price: 40.5,
    active: true
  }
];

const jobs = [
  {
    id: 1,
    customer_name: 'Sample Customer',
    delivery_date: '2024-01-01',
    status: 'scheduled',
    paid: false
  }
];

// Simple API endpoints returning sample data
app.get('/api/customers', (req, res) => {
  res.json({ customers });
});

// Customer search endpoint
app.get('/api/customers/search', (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.json({ customers });
  }

  const query = q.toLowerCase();
  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(query) ||
    (c.phone && c.phone.toLowerCase().includes(query)) ||
    (c.email && c.email.toLowerCase().includes(query))
  );

  res.json({ customers: filtered });
});

app.get('/api/products', (req, res) => {
  res.json({ products });
});

app.get('/api/jobs', (req, res) => {
  const { date } = req.query;
  let result = jobs;
  if (date) {
    result = jobs.filter(job => job.delivery_date === date);
  }
  res.json({ jobs: result });
});

app.listen(PORT, () => {
  console.log('=== NEW SIMPLE SERVER RUNNING ON PORT', PORT, '===');
});
