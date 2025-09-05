const express = require('express');
const cors = require('cors');

console.log('🚀 Starting simple server...');

const app = express();
const PORT = process.env.PORT || 10000;

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Simple server is running'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('Root endpoint requested');
  res.json({
    message: 'Simple Nursery API Server',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Simple login test endpoint
app.post('/api/auth/login', (req, res) => {
  console.log('Login attempt:', req.body);
  
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

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    message: 'Server error',
    error: err.message 
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Simple server running on port ${PORT}`);
  console.log(`🔗 Test: http://localhost:${PORT}/health`);
});

// Error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});
