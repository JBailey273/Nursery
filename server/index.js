console.log('=== EAST MEADOW NURSERY DATABASE SERVER STARTING ===');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 10000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration - UPDATED to include your custom domain
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'https://east-meadow-nursery-frontend.onrender.com',
        'https://nursery-scheduler-frontend.onrender.com',
        'https://delivery.squire.enterprises',  // Your custom domain
        'https://www.delivery.squire.enterprises'  // www version just in case
      ]
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Request body keys:', Object.keys(req.body));
  }
  next();
});

// Initialize database connection
let db = null;
let dbInitialized = false;

const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing East Meadow database...');
    db = require('./config/database');
    await db.initialize();
    dbInitialized = true;
    console.log('✅ Database connection established and initialized');
    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    console.error('🚨 Server will not start without database connection');
    console.error('💡 Please check your DATABASE_URL and database availability');
    throw error;
  }
};

// Middleware to ensure database is available
const requireDatabase = (req, res, next) => {
  if (!dbInitialized) {
    return res.status(503).json({
      message: 'Database not available. Please try again in a moment.',
      error: 'SERVICE_UNAVAILABLE',
      company: 'East Meadow Nursery'
    });
  }
  next();
};

// Health endpoints
app.get('/', (req, res) => {
  res.json({
    message: 'East Meadow Nursery Delivery Scheduler API',
    company: 'East Meadow Nursery',
    phone: '413-566-TREE',
    status: 'running',
    database: dbInitialized ? 'connected' : 'disconnected',
    version: '2.0',
    timestamp: new Date().toISOString(),
    allowedOrigins: corsOptions.origin
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: dbInitialized ? 'OK' : 'DATABASE_UNAVAILABLE',
    company: 'East Meadow Nursery',
    database: dbInitialized ? 'connected' : 'disconnected',
    version: '2.0',
    timestamp: new Date().toISOString()
  });
});

// Database diagnostic endpoint
app.get('/api/diagnostic', requireDatabase, async (req, res) => {
  try {
    console.log('Running database diagnostic...');
    
    // Test basic database connection
    const timeResult = await db.query('SELECT NOW() as current_time');
    
    // Check if tables exist
    const tablesResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    // Check user count
    const userCount = await db.query('SELECT COUNT(*) as count FROM users');
    
    // Check job count
    const jobCount = await db.query('SELECT COUNT(*) as count FROM jobs');
    
    // Check customer count
    const customerCount = await db.query('SELECT COUNT(*) as count FROM customers');
    
    // Check product count
    const productCount = await db.query('SELECT COUNT(*) as count FROM products');
    
    res.json({
      message: 'Database diagnostic successful',
      database: {
        connected: true,
        currentTime: timeResult.rows[0].current_time,
        tables: tablesResult.rows.map(row => row.table_name),
        counts: {
          users: parseInt(userCount.rows[0].count),
          jobs: parseInt(jobCount.rows[0].count),
          customers: parseInt(customerCount.rows[0].count),
          products: parseInt(productCount.rows[0].count)
        }
      }
    });
  } catch (error) {
    console.error('Database diagnostic error:', error);
    res.status(500).json({
      message: 'Database diagnostic failed',
      error: error.message,
      code: error.code
    });
  }
});

// Import and use routes (only after database is confirmed working)
let authRoutes, jobsRoutes, usersRoutes, customersRoutes, productsRoutes;

const loadRoutes = () => {
  try {
    authRoutes = require('./routes/auth');
    jobsRoutes = require('./routes/jobs');
    usersRoutes = require('./routes/users');
    customersRoutes = require('./routes/customers');
    productsRoutes = require('./routes/products');
    
    console.log('✅ API routes loaded successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to load API routes:', error);
    return false;
  }
};

// Enhanced error handling middleware for routes
const routeErrorHandler = (routeName) => (req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function(data) {
    if (res.statusCode >= 400) {
      console.error(`ERROR in ${routeName} route:`, {
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        response: data
      });
    }
    return originalSend.call(this, data);
  };
  
  res.json = function(data) {
    if (res.statusCode >= 400) {
      console.error(`ERROR in ${routeName} route:`, {
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        response: data
      });
    }
    return originalJson.call(this, data);
  };
  
  next();
};

// API Routes (with database requirement and error handling)
app.use('/api/auth', requireDatabase, routeErrorHandler('auth'), (req, res, next) => {
  if (!authRoutes) {
    return res.status(503).json({ message: 'Auth routes not loaded' });
  }
  try {
    authRoutes(req, res, next);
  } catch (error) {
    console.error('Auth route error:', error);
    res.status(500).json({ message: 'Auth route error', error: error.message });
  }
});

app.use('/api/jobs', requireDatabase, routeErrorHandler('jobs'), (req, res, next) => {
  if (!jobsRoutes) {
    return res.status(503).json({ message: 'Jobs routes not loaded' });
  }
  try {
    jobsRoutes(req, res, next);
  } catch (error) {
    console.error('Jobs route error:', error);
    res.status(500).json({ message: 'Jobs route error', error: error.message });
  }
});

app.use('/api/users', requireDatabase, routeErrorHandler('users'), (req, res, next) => {
  if (!usersRoutes) {
    return res.status(503).json({ message: 'Users routes not loaded' });
  }
  try {
    usersRoutes(req, res, next);
  } catch (error) {
    console.error('Users route error:', error);
    res.status(500).json({ message: 'Users route error', error: error.message });
  }
});

app.use('/api/customers', requireDatabase, routeErrorHandler('customers'), (req, res, next) => {
  if (!customersRoutes) {
    return res.status(503).json({ message: 'Customers routes not loaded' });
  }
  try {
    customersRoutes(req, res, next);
  } catch (error) {
    console.error('Customers route error:', error);
    res.status(500).json({ message: 'Customers route error', error: error.message });
  }
});

app.use('/api/products', requireDatabase, routeErrorHandler('products'), (req, res, next) => {
  if (!productsRoutes) {
    return res.status(503).json({ message: 'Products routes not loaded' });
  }
  try {
    productsRoutes(req, res, next);
  } catch (error) {
    console.error('Products route error:', error);
    res.status(500).json({ message: 'Products route error', error: error.message });
  }
});

// Test endpoint to verify East Meadow accounts
app.get('/api/test-accounts', requireDatabase, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT email, role 
      FROM users 
      WHERE email LIKE '%@eastmeadow.com' 
      ORDER BY role, email
    `);
    
    res.json({
      message: 'East Meadow test accounts',
      accounts: result.rows,
      instructions: 'Use password: admin123 for all accounts',
      company: 'East Meadow Nursery'
    });
  } catch (error) {
    console.error('Test accounts error:', error);
    res.status(500).json({
      message: 'Error checking accounts',
      error: error.message
    });
  }
});

// Create East Meadow accounts endpoint (for manual creation if needed)
app.post('/api/create-demo-accounts', async (req, res) => {
  try {
    if (!dbInitialized) {
      return res.status(503).json({ message: 'Database not available' });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const accounts = [
      { username: 'eastmeadow_admin', email: 'admin@eastmeadow.com', role: 'admin' },
      { username: 'eastmeadow_office', email: 'office@eastmeadow.com', role: 'office' },
      { username: 'eastmeadow_driver1', email: 'driver1@eastmeadow.com', role: 'driver' }
    ];
    
    const results = [];
    
    for (const account of accounts) {
      try {
        await db.query(`
          INSERT INTO users (username, email, password_hash, role) 
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (email) DO UPDATE SET 
            password_hash = EXCLUDED.password_hash,
            updated_at = CURRENT_TIMESTAMP
        `, [account.username, account.email, hashedPassword, account.role]);
        
        results.push({ email: account.email, status: 'created/updated' });
      } catch (error) {
        results.push({ email: account.email, status: 'error', error: error.message });
      }
    }
    
    res.json({
      message: 'East Meadow demo accounts processed',
      results,
      company: 'East Meadow Nursery'
    });
  } catch (error) {
    console.error('Create demo accounts error:', error);
    res.status(500).json({
      message: 'Failed to create demo accounts',
      error: error.message
    });
  }
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('GLOBAL ERROR HANDLER:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });
  
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON in request body' });
  }
  
  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message,
    company: 'East Meadow Nursery',
    ...(process.env.NODE_ENV !== 'production' && { 
      stack: err.stack,
      path: req.path,
      method: req.method
    })
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log('404 - Route not found:', req.method, req.originalUrl);
  res.status(404).json({
    message: 'Route not found',
    company: 'East Meadow Nursery',
    requestedPath: req.originalUrl,
    availableRoutes: [
      'GET /',
      'GET /health',
      'GET /api/diagnostic',
      'GET /api/test-accounts',
      'POST /api/create-demo-accounts',
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

// Start server
const startServer = async () => {
  try {
    // Initialize database first (with safer error handling)
    try {
      await initializeDatabase();
    } catch (dbError) {
      console.error('⚠️ Database initialization had issues:', dbError.message);
      console.log('🔄 Continuing server startup anyway...');
      // Set a flag that database might have issues
      dbInitialized = false;
    }
    
    // Load routes after database attempt
    const routesLoaded = loadRoutes();
    if (!routesLoaded) {
      console.error('❌ Failed to load API routes');
      throw new Error('Failed to load API routes');
    }
    
    // Start the server
    app.listen(PORT, () => {
      console.log('=== EAST MEADOW NURSERY SERVER READY ===');
      console.log(`🚀 Server: http://localhost:${PORT}`);
      console.log(`🌿 Company: East Meadow Nursery`);
      console.log(`📞 Phone: 413-566-TREE`);
      console.log(`💾 Database: PostgreSQL (${dbInitialized ? 'Connected' : 'Connection Issues'})`);
      console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 Allowed Origins: ${JSON.stringify(corsOptions.origin)}`);
      console.log('\n🎯 EAST MEADOW DEMO ACCOUNTS:');
      console.log('admin@eastmeadow.com / admin123');
      console.log('office@eastmeadow.com / admin123');
      console.log('driver1@eastmeadow.com / admin123');
      console.log('\n💡 Diagnostic: GET /api/diagnostic');
      console.log('💡 Test accounts: GET /api/test-accounts');
      console.log('💡 Create accounts: POST /api/create-demo-accounts');
      console.log('==========================================');
    });
    
  } catch (error) {
    console.error('❌ FAILED TO START EAST MEADOW SERVER');
    console.error('Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check DATABASE_URL environment variable');
    console.error('2. Verify PostgreSQL database is running');
    console.error('3. Check network connectivity to database');
    console.error('4. Verify database credentials are correct');
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
