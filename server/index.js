console.log('=== EAST MEADOW NURSERY PRODUCTION SERVER STARTING ===');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import database and routes
const db = require('./config/database');
const authRoutes = require('./routes/auth');
const jobsRoutes = require('./routes/jobs');
const usersRoutes = require('./routes/users');
const customersRoutes = require('./routes/customers');
const productsRoutes = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 10000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
  crossOriginEmbedderPolicy: false
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased for development
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://east-meadow-nursery-frontend.onrender.com',
        'https://nursery-scheduler-frontend.onrender.com'
      ]
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'East Meadow Nursery Delivery Scheduler API',
    company: 'East Meadow Nursery',
    phone: '413-566-TREE',
    status: 'running',
    version: '2.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    company: 'East Meadow Nursery',
    database: 'connected',
    version: '2.0',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/products', productsRoutes);

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'East Meadow Nursery API is working',
    database: 'PostgreSQL connected',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON in request body' });
  }
  
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    availableRoutes: [
      'GET /',
      'GET /health',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'GET /api/jobs',
      'POST /api/jobs',
      'GET /api/customers',
      'POST /api/customers',
      'GET /api/products',
      'POST /api/products',
      'GET /api/users/drivers'
    ]
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    console.log('Initializing East Meadow Nursery database...');
    await db.initialize();
    console.log('✅ Database initialized successfully');
    
    app.listen(PORT, () => {
      console.log('=== EAST MEADOW NURSERY SERVER RUNNING ===');
      console.log(`🚀 Server: http://localhost:${PORT}`);
      console.log(`🌿 Company: East Meadow Nursery`);
      console.log(`📞 Phone: 413-566-TREE`);
      console.log(`💾 Database: PostgreSQL`);
      console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('===========================================');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();
