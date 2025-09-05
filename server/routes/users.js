const express = require('express');
const { body, validationResult, param } = require('express-validator');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all users (admin/office only) - IMPROVED ERROR HANDLING
router.get('/', auth, async (req, res) => {
  if (!['admin', 'office'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access denied - admin or office role required' });
  }

  try {
    console.log('Getting all users, requested by:', req.user.userId, req.user.role);
    
    const result = await db.query(`
      SELECT id, username, email, role, created_at, updated_at 
      FROM users 
      ORDER BY created_at DESC
    `);

    console.log(`Retrieved ${result.rows.length} users`);

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      message: 'Server error retrieving users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get drivers only - IMPROVED ERROR HANDLING
router.get('/drivers', auth, async (req, res) => {
  try {
    console.log('Getting drivers, requested by:', req.user.userId, req.user.role);
    
    const result = await db.query(`
      SELECT id, username, email, created_at 
      FROM users 
      WHERE role = 'driver'
      ORDER BY username ASC
    `);

    console.log(`Retrieved ${result.rows.length} drivers`);

    res.json({ drivers: result.rows });
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({ 
      message: 'Server error retrieving drivers',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get user by ID - IMPROVED ERROR HANDLING
router.get('/:id', auth, [
  param('id').isInt().withMessage('User ID must be a valid number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const requestedUserId = parseInt(req.params.id);
    
    console.log('Getting user:', requestedUserId, 'requested by:', req.user.userId, req.user.role);

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
    console.error('Get user error:', error);
    res.status(500).json({ 
      message: 'Server error retrieving user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update user - FIXED VALIDATION AND ERROR HANDLING
router.put('/:id', auth, [
  param('id').isInt().withMessage('User ID must be a valid number'),
  body('username').optional().isLength({ min: 3 }).withMessage('Username must be at least 3 characters').trim().escape(),
  body('email').optional().isEmail().withMessage('Invalid email format').normalizeEmail(),
  body('role').optional().isIn(['office', 'driver', 'admin']).withMessage('Invalid role specified')
], async (req, res) => {
  try {
    console.log('Updating user:', req.params.id, 'by:', req.user.userId, req.user.role);
    console.log('Update data:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('User update validation errors:', errors.array());
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const userId = parseInt(req.params.id);

    // Permission checks
    if (req.user.userId !== userId && !['admin'].includes(req.user.role)) {
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
        const value = req.body[field].trim();
        
        if (!value && field !== 'role') {
          return res.status(400).json({ message: `${field} cannot be empty` });
        }

        // Check for uniqueness if updating username or email
        if (field === 'username' || field === 'email') {
          const checkUnique = await db.query(
            `SELECT id FROM users WHERE ${field} = $1 AND id != $2`,
            [value, userId]
          );
          
          if (checkUnique.rows.length > 0) {
            return res.status(400).json({ 
              message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists` 
            });
          }
        }

        paramCount++;
        updateFields.push(`${field} = $${paramCount}`);
        values.push(value);
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
    console.error('Update user error details:', {
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
      return res.status(400).json({ message: 'User information already exists' });
    }
    
    res.status(500).json({ 
      message: 'Server error updating user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Change password - FIXED VALIDATION AND ERROR HANDLING
router.put('/:id/password', auth, [
  param('id').isInt().withMessage('User ID must be a valid number'),
  body('current_password').optional().notEmpty().withMessage('Current password is required when changing your own password'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    console.log('Changing password for user:', req.params.id, 'by:', req.user.userId, req.user.role);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Password change validation errors:', errors.array());
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
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
    console.error('Change password error details:', {
      message: error.message,
      userId: req.params.id,
      requestedBy: req.user.userId
    });
    
    res.status(500).json({ 
      message: 'Server error changing password',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Delete user (admin only) - IMPROVED ERROR HANDLING
router.delete('/:id', auth, [
  param('id').isInt().withMessage('User ID must be a valid number')
], async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied - admin role required' });
  }

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array() 
      });
    }

    const userId = parseInt(req.params.id);

    console.log('Deleting user:', userId, 'by admin:', req.user.userId);

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
    console.error('Delete user error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    
    // Handle foreign key constraints
    if (error.code === '23503') {
      return res.status(400).json({ 
        message: 'Cannot delete user - they have associated jobs or other data. Please reassign or remove associated data first.' 
      });
    }
    
    res.status(500).json({ 
      message: 'Server error deleting user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
