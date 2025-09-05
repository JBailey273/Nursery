const express = require('express');
const { body, validationResult, param } = require('express-validator');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Simple role check functions
const requireAdminOrOffice = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (!['admin', 'office'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Admin or office role required' });
  }
  
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin role required' });
  }
  
  next();
};

// ULTRA-SIMPLE: Get all users (admin/office only)
router.get('/', auth, requireAdminOrOffice, async (req, res) => {
  try {
    console.log('=== GET ALL USERS REQUEST ===');
    console.log('Requested by:', req.user.userId, req.user.role);
    
    const result = await db.query(`
      SELECT id, username, email, role, created_at, updated_at 
      FROM users 
      ORDER BY created_at DESC
    `);

    console.log(`Retrieved ${result.rows.length} users`);

    res.json({ users: result.rows });
  } catch (error) {
    console.error('=== GET ALL USERS ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Server error retrieving users',
      error: error.message
    });
  }
});

// ULTRA-SIMPLE: Get drivers only
router.get('/drivers', auth, async (req, res) => {
  try {
    console.log('=== GET DRIVERS REQUEST ===');
    console.log('Requested by:', req.user.userId, req.user.role);
    
    const result = await db.query(`
      SELECT id, username, email, created_at 
      FROM users 
      WHERE role = 'driver'
      ORDER BY username ASC
    `);

    console.log(`Retrieved ${result.rows.length} drivers`);

    res.json({ drivers: result.rows });
  } catch (error) {
    console.error('=== GET DRIVERS ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Server error retrieving drivers',
      error: error.message
    });
  }
});

// ULTRA-SIMPLE: Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    console.log('=== GET USER BY ID REQUEST ===');
    console.log('Requested user ID:', req.params.id);
    console.log('Requested by:', req.user.userId, req.user.role);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid user ID required' });
    }

    const requestedUserId = parseInt(req.params.id);

    // Users can only view their own profile unless they're admin/office
    if (req.user.userId !== requestedUserId && !['admin', 'office'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied - can only view your own profile' });
    }

    const result = await db.query(`
      SELECT id, username, email, role, created_at, updated_at 
      FROM users 
      WHERE id = $1
    `, [requestedUserId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Retrieved user info for:', result.rows[0].username);

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('=== GET USER BY ID ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Server error retrieving user',
      error: error.message
    });
  }
});

// ULTRA-SIMPLE: Update user
router.put('/:id', auth, async (req, res) => {
  try {
    console.log('=== UPDATE USER REQUEST ===');
    console.log('User ID:', req.params.id);
    console.log('Update data:', req.body);
    console.log('Requested by:', req.user.userId, req.user.role);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid user ID required' });
    }

    const userId = parseInt(req.params.id);

    // Permission checks
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied - can only update your own profile or admin required' });
    }

    // Only admins can change roles
    if (req.body.role && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied - only admins can change user roles' });
    }

    // Check if user exists
    const existingUser = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    const allowedUpdates = ['username', 'email', 'role'];

    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        const value = req.body[field];
        
        if (!value || (typeof value === 'string' && !value.trim())) {
          return res.status(400).json({ message: `${field} cannot be empty` });
        }

        const cleanValue = typeof value === 'string' ? value.trim() : value;

        // Check for uniqueness if updating username or email
        if (field === 'username' || field === 'email') {
          const checkUnique = await db.query(
            `SELECT id FROM users WHERE ${field} = $1 AND id != $2`,
            [cleanValue, userId]
          );
          
          if (checkUnique.rows.length > 0) {
            return res.status(400).json({ 
              message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` 
            });
          }
        }

        paramCount++;
        updateFields.push(`${field} = $${paramCount}`);
        values.push(cleanValue);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Add updated_at timestamp
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    // Add user ID for WHERE clause
    paramCount++;
    values.push(userId);

    const updateQuery = `
      UPDATE users 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING id, username, email, role, created_at, updated_at
    `;

    console.log('Update query:', updateQuery);
    console.log('Update values:', values);

    const result = await db.query(updateQuery, values);

    console.log('User updated successfully:', result.rows[0].username);

    res.json({
      message: 'User updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('=== UPDATE USER ERROR ===');
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
      return res.status(400).json({ message: 'User information already exists' });
    }
    
    res.status(500).json({ 
      message: 'Server error updating user',
      error: error.message,
      code: error.code
    });
  }
});

// ULTRA-SIMPLE: Change password
router.put('/:id/password', auth, async (req, res) => {
  try {
    console.log('=== CHANGE PASSWORD REQUEST ===');
    console.log('User ID:', req.params.id);
    console.log('Requested by:', req.user.userId, req.user.role);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid user ID required' });
    }

    const userId = parseInt(req.params.id);

    // Users can only change their own password unless they're admin
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied - can only change your own password or admin required' });
    }

    const { current_password, new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // Get current user
    const userResult = await db.query(
      'SELECT id, username, password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Verify current password (skip for admin changing other users' passwords)
    if (req.user.userId === userId) {
      if (!current_password) {
        return res.status(400).json({ message: 'Current password is required' });
      }
      
      const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
      if (!isValidPassword) {
        console.log('Invalid current password for user:', userId);
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
    }

    console.log('Password verification passed, updating password');

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3',
      [newPasswordHash, new Date(), userId]
    );

    console.log('Password updated successfully for user:', user.username);

    res.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('=== CHANGE PASSWORD ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({ 
      message: 'Server error changing password',
      error: error.message
    });
  }
});

// ULTRA-SIMPLE: Delete user (admin only)
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    console.log('=== DELETE USER REQUEST ===');
    console.log('User ID:', req.params.id);
    console.log('Requested by admin:', req.user.userId);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid user ID required' });
    }

    const userId = parseInt(req.params.id);

    // Prevent admin from deleting themselves
    if (req.user.userId === userId) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    // Get user info before deletion
    const userToDelete = await db.query(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );

    if (userToDelete.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const deletedUsername = userToDelete.rows[0].username;

    // Delete user
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('User deleted successfully:', deletedUsername);

    res.json({ 
      message: 'User deleted successfully',
      deletedUser: deletedUsername
    });
  } catch (error) {
    console.error('=== DELETE USER ERROR ===');
    console.error('Error:', error);
    
    // Handle foreign key constraints
    if (error.code === '23503') {
      return res.status(400).json({ 
        message: 'Cannot delete user - they have associated jobs or other data. Please reassign or remove associated data first.' 
      });
    }
    
    res.status(500).json({ 
      message: 'Server error deleting user',
      error: error.message
    });
  }
});

module.exports = router;
