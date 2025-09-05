const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// ULTRA-SIMPLE: Register new user
router.post('/register', async (req, res) => {
  try {
    console.log('=== REGISTER REQUEST ===');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Email:', req.body.email);
    console.log('Role:', req.body.role);
    
    const { username, email, password, role } = req.body;

    // Basic validation
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters' });
    }

    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (!role || !['office', 'driver', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Valid role is required (office, driver, admin)' });
    }

    // Clean data
    const cleanUsername = username.trim();
    const cleanEmail = email.toLowerCase().trim();
    const cleanRole = role;

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
      console.log('User already exists');
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
    console.error('=== REGISTER ERROR ===');
    console.error('Full error object:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Error stack:', error.stack);
    
    // Handle specific PostgreSQL errors
    if (error.code === '23505') {
      if (error.detail && error.detail.includes('email')) {
        return res.status(400).json({ message: 'Email address already exists' });
      }
      if (error.detail && error.detail.includes('username')) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      return res.status(400).json({ message: 'User already exists' });
    }
    
    res.status(500).json({ 
      message: 'Server error during registration',
      error: error.message,
      code: error.code
    });
  }
});

// ULTRA-SIMPLE: Login
router.post('/login', async (req, res) => {
  try {
    console.log('=== LOGIN REQUEST ===');
    console.log('Email:', req.body.email);
    
    const { email, password } = req.body;

    // Basic validation
    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    // Clean email
    const cleanEmail = email.toLowerCase().trim();
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
    console.error('=== LOGIN ERROR ===');
    console.error('Full error object:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      message: 'Server error during login',
      error: error.message,
      code: error.code
    });
  }
});

// ULTRA-SIMPLE: Get current user
router.get('/me', auth, async (req, res) => {
  try {
    console.log('=== GET ME REQUEST ===');
    console.log('User ID:', req.user.userId);
    
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
    console.error('=== GET ME ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({ 
      message: 'Server error retrieving user information',
      error: error.message
    });
  }
});

// ULTRA-SIMPLE: Refresh token
router.post('/refresh', auth, async (req, res) => {
  try {
    console.log('=== REFRESH TOKEN REQUEST ===');
    console.log('User ID:', req.user.userId);
    
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
    console.error('=== REFRESH TOKEN ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({ 
      message: 'Server error refreshing token',
      error: error.message
    });
  }
});

// ULTRA-SIMPLE: Logout endpoint
router.post('/logout', auth, async (req, res) => {
  try {
    console.log('=== LOGOUT REQUEST ===');
    console.log('User logged out:', req.user.userId);
    
    res.json({ 
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('=== LOGOUT ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Server error during logout',
      error: error.message 
    });
  }
});

module.exports = router;
