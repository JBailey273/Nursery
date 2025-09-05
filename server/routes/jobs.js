const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const db = require('../config/database');
const auth = require('../middleware/auth');

const router = express.Router();

// Simple role check functions
const requireOfficeOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (!['office', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Office or admin role required' });
  }
  
  next();
};

// Helper function to create customer if needed
const createCustomerIfNeeded = async (customerData) => {
  try {
    console.log('=== CREATING NEW CUSTOMER ===');
    console.log('Customer data:', customerData);

    // Check if customer already exists by name
    const existingCustomer = await db.query(
      'SELECT id FROM customers WHERE name = $1',
      [customerData.name]
    );

    if (existingCustomer.rows.length > 0) {
      console.log('Customer already exists:', existingCustomer.rows[0].id);
      return existingCustomer.rows[0].id;
    }

    // Create new customer
    const result = await db.query(`
      INSERT INTO customers (name, phone, email, addresses, notes, contractor)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      customerData.name,
      customerData.phone || null,
      customerData.email || null,
      JSON.stringify(customerData.addresses || []),
      customerData.notes || null,
      customerData.contractor || false
    ]);

    console.log('✅ New customer created:', result.rows[0].id);
    return result.rows[0].id;
  } catch (error) {
    console.error('❌ Failed to create customer:', error);
    return null;
  }
};

// ULTRA-SIMPLE: Get all jobs with filters
router.get('/', auth, async (req, res) => {
  try {
    console.log('=== JOBS GET REQUEST ===');
    console.log('User:', req.user.userId, req.user.role);
    console.log('Query params:', req.query);
    
    let query = 'SELECT * FROM jobs';
    const conditions = [];
    const values = [];
    let paramCount = 0;

    // Simple date filter
    if (req.query.date) {
      paramCount++;
      conditions.push(`delivery_date = $${paramCount}`);
      values.push(req.query.date);
    }

    // Simple status filter
    if (req.query.status) {
      paramCount++;
      conditions.push(`status = $${paramCount}`);
      values.push(req.query.status);
    }

    // Filter for "to be scheduled" jobs
    if (req.query.to_be_scheduled === 'true') {
      conditions.push(`(status = 'to_be_scheduled' OR delivery_date IS NULL)`);
    }

    // If user is a driver, only show their assigned jobs (exclude to_be_scheduled)
    if (req.user.role === 'driver') {
      paramCount++;
      conditions.push(`assigned_driver = $${paramCount}`);
      values.push(req.user.userId);
      
      // Drivers shouldn't see unscheduled jobs
      conditions.push(`status != 'to_be_scheduled'`);
      conditions.push(`delivery_date IS NOT NULL`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY ';
    if (req.query.to_be_scheduled === 'true') {
      query += 'created_at DESC'; // Show newest unscheduled first
    } else {
      query += 'delivery_date ASC, created_at ASC'; // Normal date ordering
    }

    console.log('Query:', query);
    console.log('Values:', values);

    const result = await db.query(query, values);
    
    console.log(`Found ${result.rows.length} jobs`);
    
    // For now, return jobs without products to simplify
    const jobs = result.rows.map(job => ({
      ...job,
      delivery_date: job.delivery_date
        ? new Date(job.delivery_date).toISOString().split('T')[0]
        : null,
      products: [] // Empty products array for now
    }));

    res.json({ jobs });
  } catch (error) {
    console.error('=== JOBS GET ERROR ===');
    console.error('Full error object:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      message: 'Server error getting jobs',
      error: error.message,
      code: error.code
    });
  }
});

// ULTRA-SIMPLE: Get single job
router.get('/:id', auth, async (req, res) => {
  try {
    console.log('=== GET SINGLE JOB ===');
    console.log('Job ID:', req.params.id);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid job ID required' });
    }

    const result = await db.query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const job = result.rows[0];

    // Check if driver can access this job
    if (req.user.role === 'driver' && job.assigned_driver !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Add empty products array for now
    const jobWithProducts = {
      ...job,
      products: []
    };

    res.json({ job: jobWithProducts });
  } catch (error) {
    console.error('=== GET JOB ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Server error getting job',
      error: error.message 
    });
  }
});

// ULTRA-SIMPLE: Create new job - WITH TO_BE_SCHEDULED SUPPORT
router.post('/', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== CREATE JOB REQUEST ===');
    console.log('Request body:', req.body);
    
    // First, check what columns actually exist in the jobs table
    const schemaResult = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' AND table_schema = 'public'
    `);
    
    const availableColumns = schemaResult.rows.map(row => row.column_name);
    console.log('Available job columns:', availableColumns);
    
    const {
      customer_name,
      customer_phone,
      address,
      delivery_date,
      special_instructions,
      paid,
      assigned_driver,
      total_amount,
      contractor_discount,
      customer_id,
      status
    } = req.body;

    // Basic validation
    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    if (!address || !address.trim()) {
      return res.status(400).json({ message: 'Delivery address is required' });
    }

    // Validate status
    const validStatuses = ['scheduled', 'to_be_scheduled', 'in_progress', 'completed', 'cancelled'];
    const jobStatus = status && validStatuses.includes(status) ? status : 
                     (delivery_date ? 'scheduled' : 'to_be_scheduled');

    console.log('Job status determined:', jobStatus);

    // Handle customer creation/lookup if no customer_id provided
    let finalCustomerId = customer_id;
    
    if (!finalCustomerId && availableColumns.includes('customer_id')) {
      console.log('No customer_id provided, attempting to create/find customer');
      
      // Try to create customer automatically
      const customerData = {
        name: customer_name.trim(),
        phone: customer_phone?.trim() || null,
        email: null,
        addresses: address ? [{ 
          address: address.trim(), 
          notes: special_instructions?.trim() || '' 
        }] : [],
        notes: null,
        contractor: contractor_discount || false
      };
      
      finalCustomerId = await createCustomerIfNeeded(customerData);
      
      if (finalCustomerId) {
        console.log('✅ Customer created/found:', finalCustomerId);
      } else {
        console.log('⚠️ Customer creation failed, continuing without customer_id');
      }
    }

    // Clean up data
    const cleanCustomerPhone = (customer_phone && customer_phone.trim()) ? customer_phone.trim() : null;
    const cleanSpecialInstructions = (special_instructions && special_instructions.trim()) ? special_instructions.trim() : null;
    const cleanAssignedDriver = (assigned_driver && !isNaN(assigned_driver)) ? parseInt(assigned_driver) : null;
    const cleanTotalAmount = (total_amount && !isNaN(total_amount)) ? parseFloat(total_amount) : 0;
    const isContractorDiscount = contractor_discount === true;
    const isPaid = paid === true;

    // For "to_be_scheduled" jobs, delivery_date should be null
    const finalDeliveryDate = jobStatus === 'to_be_scheduled' ? null : delivery_date;

    console.log('Creating job with cleaned data:', {
      customer_name: customer_name.trim(),
      cleanCustomerPhone,
      address: address.trim(),
      delivery_date: finalDeliveryDate,
      cleanSpecialInstructions,
      isPaid,
      cleanAssignedDriver,
      finalCustomerId,
      cleanTotalAmount,
      isContractorDiscount,
      status: jobStatus
    });

    // Build insert query based on available columns
    const insertFields = ['customer_name', 'address', 'paid', 'created_by', 'status'];
    const insertValues = [customer_name.trim(), address.trim(), isPaid, req.user.userId, jobStatus];
    let paramCount = 5;

    // Add delivery_date only if it's not null (not to_be_scheduled)
    if (availableColumns.includes('delivery_date')) {
      insertFields.push('delivery_date');
      insertValues.push(finalDeliveryDate);
      paramCount++;
    }

    // Add optional fields if columns exist
    if (availableColumns.includes('customer_phone') && cleanCustomerPhone) {
      insertFields.push('customer_phone');
      insertValues.push(cleanCustomerPhone);
      paramCount++;
    }

    if (availableColumns.includes('special_instructions') && cleanSpecialInstructions) {
      insertFields.push('special_instructions');
      insertValues.push(cleanSpecialInstructions);
      paramCount++;
    }

    if (availableColumns.includes('assigned_driver') && cleanAssignedDriver) {
      insertFields.push('assigned_driver');
      insertValues.push(cleanAssignedDriver);
      paramCount++;
    }

    // Only include customer_id if the column exists AND we have a valid ID
    if (availableColumns.includes('customer_id') && finalCustomerId) {
      insertFields.push('customer_id');
      insertValues.push(finalCustomerId);
      paramCount++;
    }

    if (availableColumns.includes('total_amount')) {
      insertFields.push('total_amount');
      insertValues.push(cleanTotalAmount);
      paramCount++;
    }

    if (availableColumns.includes('contractor_discount')) {
      insertFields.push('contractor_discount');
      insertValues.push(isContractorDiscount);
      paramCount++;
    }

    // Create parameterized query
    const placeholders = insertValues
      .map((_, index) => `$${index + 1}`)
      .join(', ');
    const insertQuery = `
      INSERT INTO jobs (${insertFields.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    console.log('Insert query:', insertQuery);
    console.log('Insert values:', insertValues);

    const result = await db.query(insertQuery, insertValues);

    const job = result.rows[0];
    console.log('Job created successfully:', job.id);

    // Add empty products array for response and normalize date
    const responseJob = {
      ...job,
      delivery_date: job.delivery_date
        ? new Date(job.delivery_date).toISOString().split('T')[0]
        : null,
      products: []
    };

    res.status(201).json({
      message: jobStatus === 'to_be_scheduled' 
        ? 'Order saved successfully. Ready to schedule delivery date.' 
        : 'Job created successfully',
      job: responseJob,
      customerCreated: finalCustomerId && !customer_id ? true : false
    });

  } catch (error) {
    console.error('=== CREATE JOB ERROR ===');
    console.error('Full error object:', error);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({ 
      message: 'Server error creating job',
      error: error.message,
      code: error.code
    });
  }
});

// ULTRA-SIMPLE: Update job - ENHANCED FOR SCHEDULING
router.put('/:id', auth, async (req, res) => {
  try {
    console.log('=== UPDATE JOB REQUEST ===');
    console.log('Job ID:', req.params.id);
    console.log('Update data:', req.body);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid job ID required' });
    }

    // Check what columns exist
    const schemaResult = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' AND table_schema = 'public'
    `);
    
    const availableColumns = schemaResult.rows.map(row => row.column_name);
    console.log('Available job columns:', availableColumns);

    // Check if job exists
    const existingJob = await db.query('SELECT * FROM jobs WHERE id = $1', [req.params.id]);
    if (existingJob.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const job = existingJob.rows[0];

    // Permission checks
    if (req.user.role === 'driver') {
      // Drivers can only update jobs assigned to them and only certain fields
      if (job.assigned_driver !== req.user.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // Drivers can only update status, driver_notes, and payment_received
      const allowedFields = ['status', 'driver_notes', 'payment_received'];
      const requestedFields = Object.keys(req.body);
      const invalidFields = requestedFields.filter(field => !allowedFields.includes(field));
      
      if (invalidFields.length > 0) {
        return res.status(403).json({ 
          message: 'Drivers can only update status, driver notes, and payment received' 
        });
      }
    }

    // Special handling for scheduling updates
    if (req.body.delivery_date && job.status === 'to_be_scheduled') {
      console.log('Scheduling a to_be_scheduled job');
      req.body.status = 'scheduled'; // Auto-update status when scheduling
    }

    // Build update query dynamically based on available columns
    const updateFields = [];
    const values = [];
    let paramCount = 0;

    const potentialUpdates = [
      'customer_name', 'customer_phone', 'address', 'delivery_date',
      'special_instructions', 'status', 'driver_notes',
      'payment_received', 'assigned_driver'
    ];

    for (const field of potentialUpdates) {
      if (req.body[field] !== undefined && availableColumns.includes(field)) {
        paramCount++;
        updateFields.push(`${field} = $${paramCount}`);
        
        // Handle special cases for nullable fields
        if (field === 'customer_phone' || field === 'special_instructions' || field === 'driver_notes') {
          const value = req.body[field];
          values.push((value && value.trim()) ? value.trim() : null);
        } else if (field === 'payment_received') {
          const value = req.body[field];
          values.push((value !== undefined && value !== null && !isNaN(value)) ? parseFloat(value) : null);
        } else if (field === 'assigned_driver') {
          const value = req.body[field];
          values.push((value && !isNaN(value)) ? parseInt(value) : null);
        } else if (field === 'delivery_date') {
          // Handle null delivery_date for to_be_scheduled jobs
          const value = req.body[field];
          values.push(value || null);
        } else {
          values.push(req.body[field]);
        }
      }
    }

    // Always recalculate paid status based on payments
    const paymentReceived = req.body.payment_received !== undefined
      ? parseFloat(req.body.payment_received)
      : job.payment_received || 0;
    const totalAmount = job.total_amount || 0;
    const paidStatus = totalAmount > 0 && paymentReceived >= totalAmount;

    if (availableColumns.includes('paid')) {
      paramCount++;
      updateFields.push(`paid = $${paramCount}`);
      values.push(paidStatus);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    // Add updated_at timestamp if column exists
    if (availableColumns.includes('updated_at')) {
      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      values.push(new Date());
    }

    // Add job ID for WHERE clause
    paramCount++;
    values.push(req.params.id);

    const updateQuery = `
      UPDATE jobs
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    console.log('Update query:', updateQuery);
    console.log('Update values:', values);

    const result = await db.query(updateQuery, values);

    const responseJob = {
      ...result.rows[0],
      delivery_date: result.rows[0].delivery_date
        ? new Date(result.rows[0].delivery_date).toISOString().split('T')[0]
        : null,
      products: []
    };

    console.log('Job updated successfully');

    // Determine success message based on update type
    let message = 'Job updated successfully';
    if (req.body.delivery_date && job.status === 'to_be_scheduled') {
      message = 'Delivery scheduled successfully!';
    } else if (req.body.status === 'completed') {
      message = 'Delivery marked as completed';
    }

    res.json({
      message,
      job: responseJob
    });

  } catch (error) {
    console.error('=== UPDATE JOB ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({ 
      message: 'Server error updating job',
      error: error.message 
    });
  }
});

// ULTRA-SIMPLE: Delete job
router.delete('/:id', auth, requireOfficeOrAdmin, async (req, res) => {
  try {
    console.log('=== DELETE JOB REQUEST ===');
    console.log('Job ID:', req.params.id);
    
    if (!req.params.id || isNaN(req.params.id)) {
      return res.status(400).json({ message: 'Valid job ID required' });
    }

    const result = await db.query('DELETE FROM jobs WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found' });
    }

    console.log('Job deleted successfully');

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('=== DELETE JOB ERROR ===');
    console.error('Error:', error);
    res.status(500).json({ 
      message: 'Server error deleting job',
      error: error.message 
    });
  }
});

module.exports = router;
