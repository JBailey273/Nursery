const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Register new user - FIXED VALIDATION AND ERROR HANDLING
router.post('/register', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters').trim().escape(),
  body('email').isEmail().withMessage('Invalid email format').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['office', 'driver', 'admin']).withMessage('Invalid role specified')
], async (req, res) => {
  try {
    console.log('Registration attempt for:', req.body.email);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Registration validation errors:', errors.array());
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { username, email, password, role } = req.body;

    // Clean and validate data
    const cleanUsername = username.trim();
    const cleanEmail = email.toLowerCase().trim();
    const cleanRole = role || 'driver';

    if (!cleanUsername || !cleanEmail || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    console.log('Processing registration:', {
      username: cleanUsername,
      email: cleanEmail,
      role: cleanRole
    });

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [cleanEmail, cleanUsername]
    );

    if (existingUser.rows.length > 0) {
      console.log('User already exists with email or username');
      return res.status(400).json({ message: 'User with this email or username already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    console.log('Password hashed successfully');

    // Create user
    const result = await db.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role, created_at',
      [cleanUsername, cleanEmail, passwordHash, cleanRole]
    );

    const user = result.rows[0];
    console.log('User created successfully:', user.id);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('Registration error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    
    // Handle specific PostgreSQL errors
    if (error.code === '23505') { // Unique violation
      if (error.detail.includes('email')) {
        return res.status(400).json({ message: 'Email address already exists' });
      }
      if (error.detail.includes('username')) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      return res.status(400).json({ message: 'User already exists' });
    }
    
    if (error.code === '22P02') { // Invalid input syntax
      return res.status(400).json({ message: 'Invalid data format provided' });
    }
    
    res.status(500).json({ 
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Login - FIXED VALIDATION AND ERROR HANDLING
router.post('/login', [
  body('email').isEmail().withMessage('Invalid email format').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    console.log('Login attempt for:', req.body.email);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Login validation errors:', errors.array());
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Clean email
    const cleanEmail = email.toLowerCase().trim();

    if (!cleanEmail || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    console.log('Processing login for email:', cleanEmail);

    // Find user
    const result = await db.query(
      'SELECT id, username, email, password_hash, role, created_at FROM users WHERE email = $1',
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      console.log('User not found with email:', cleanEmail);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    console.log('User found:', user.id, user.username, user.role);

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      console.log('Invalid password for user:', user.id);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    console.log('Password verified for user:', user.id);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Login successful for user:', user.id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('Login error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    res.status(500).json({ 
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get current user - IMPROVED ERROR HANDLING
router.get('/me', auth, async (req, res) => {
  try {
    console.log('Getting user info for ID:', req.user.userId);
    
    const result = await db.query(
      'SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      console.log('User not found in database:', req.user.userId);
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    console.log('Retrieved user info for:', user.username);

    res.json({ user });
  } catch (error) {
    console.error('Get user error details:', {
      message: error.message,
      userId: req.user?.userId
    });
    
    res.status(500).json({ 
      message: 'Server error retrieving user information',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Refresh token - IMPROVED ERROR HANDLING
router.post('/refresh', auth, async (req, res) => {
  try {
    console.log('Refreshing token for user:', req.user.userId);
    
    // Verify user still exists
    const userCheck = await db.query(
      'SELECT id, role FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (userCheck.rows.length === 0) {
      console.log('User no longer exists for token refresh:', req.user.userId);
      return res.status(401).json({ message: 'User no longer exists' });
    }

    const user = userCheck.rows[0];

    // Generate new token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Token refreshed successfully for user:', user.id);

    res.json({ 
      message: 'Token refreshed successfully',
      token 
    });
  } catch (error) {
    console.error('Token refresh error details:', {
      message: error.message,
      userId: req.user?.userId
    });
    
    res.status(500).json({ 
      message: 'Server error refreshing token',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Logout endpoint (optional - mainly for logging)
router.post('/logout', auth, async (req, res) => {
  try {
    console.log('User logged out:', req.user.userId);
    
    res.json({ 
      message: 'Logged out successfully',
      // Note: JWT tokens can't be invalidated server-side without a blacklist
      // The client should remove the token from storage
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error during logout' });
  }
});

module.exports = router;
