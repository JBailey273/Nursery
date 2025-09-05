console.log('=== EAST MEADOW NURSERY COMPLETE SERVER STARTING ===');

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
  console.log('EAST MEADOW SERVER: Root request received');
  res.json({ 
    message: 'EAST MEADOW NURSERY DELIVERY SCHEDULER API',
    company: 'East Meadow Nursery',
    phone: '413-566-TREE',
    version: '2.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    company: 'East Meadow Nursery',
    version: '2.0' 
  });
});

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  console.log('EAST MEADOW SERVER: Login request received:', req.body);
  
  const { email, password } = req.body;
  
  // East Meadow Nursery login credentials
  if (email === 'admin@eastmeadow.com' && password === 'admin123') {
    res.json({
      message: 'Login successful',
      token: 'fake-token-admin-eastmeadow',
      user: {
        id: 1,
        username: 'admin',
        email: 'admin@eastmeadow.com',
        role: 'admin'
      }
    });
  } else if (email === 'office@eastmeadow.com' && password === 'admin123') {
    res.json({
      message: 'Login successful',
      token: 'fake-token-office-eastmeadow',
      user: {
        id: 2,
        username: 'office',
        email: 'office@eastmeadow.com',
        role: 'office'
      }
    });
  } else if (email === 'driver1@eastmeadow.com' && password === 'admin123') {
    res.json({
      message: 'Login successful',
      token: 'fake-token-driver-eastmeadow',
      user: {
        id: 3,
        username: 'driver1',
        email: 'driver1@eastmeadow.com',
        role: 'driver'
      }
    });
  } else {
    res.status(401).json({
      message: 'Invalid credentials'
    });
  }
});

app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token === 'fake-token-admin-eastmeadow') {
    res.json({
      user: {
        id: 1,
        username: 'admin',
        email: 'admin@eastmeadow.com',
        role: 'admin'
      }
    });
  } else if (token === 'fake-token-office-eastmeadow') {
    res.json({
      user: {
        id: 2,
        username: 'office',
        email: 'office@eastmeadow.com',
        role: 'office'
      }
    });
  } else if (token === 'fake-token-driver-eastmeadow') {
    res.json({
      user: {
        id: 3,
        username: 'driver1',
        email: 'driver1@eastmeadow.com',
        role: 'driver'
      }
    });
  } else {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// In-memory data storage
let customers = [
  {
    id: 1,
    name: 'Pioneer Valley Landscaping',
    phone: '(413) 555-0123',
    email: 'orders@pvlandscaping.com',
    addresses: [{ address: '456 Industrial Dr, Westfield, MA 01085', notes: 'Commercial loading dock - rear entrance' }],
    notes: 'Volume contractor - established 2015',
    contractor: true,
    total_deliveries: 12,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    name: 'Johnson Residence',
    phone: '(413) 555-0198',
    email: 'mjohnson@email.com',
    addresses: [{ address: '123 Maple Street, East Longmeadow, MA 01028', notes: 'Side driveway access only' }],
    notes: 'Residential customer - regular orders',
    contractor: false,
    total_deliveries: 3,
    created_at: new Date().toISOString()
  }
];

let products = [
  {
    id: 1,
    name: 'Premium Bark Mulch',
    unit: 'yards',
    retail_price: 45.0,
    contractor_price: 40.5,
    active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    name: 'Screened Topsoil',
    unit: 'yards',
    retail_price: 38.0,
    contractor_price: 34.2,
    active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    name: 'Compost Blend',
    unit: 'yards',
    retail_price: 42.0,
    contractor_price: 37.8,
    active: true,
    created_at: new Date().toISOString()
  }
];

let jobs = [
  {
    id: 1,
    customer_name: 'Johnson Residence',
    customer_phone: '(413) 555-0198',
    address: '123 Maple Street, East Longmeadow, MA 01028',
    delivery_date: new Date().toISOString().split('T')[0],
    status: 'scheduled',
    paid: false,
    products: [
      { id: 1, product_name: 'Premium Bark Mulch', quantity: 3, unit: 'yards' }
    ],
    created_at: new Date().toISOString(),
    assigned_driver: null,
    special_instructions: '',
    driver_notes: '',
    payment_received: 0
  }
];

let users = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@eastmeadow.com',
    role: 'admin',
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    username: 'office',
    email: 'office@eastmeadow.com',
    role: 'office',
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    username: 'driver1',
    email: 'driver1@eastmeadow.com',
    role: 'driver',
    created_at: new Date().toISOString()
  }
];

// Counter for new IDs
let nextCustomerId = customers.length + 1;
let nextProductId = products.length + 1;
let nextJobId = jobs.length + 1;
let nextUserId = users.length + 1;

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !token.startsWith('fake-token-')) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

// Users endpoints
app.get('/api/users', auth, (req, res) => {
  res.json({ users: users.map(u => ({ ...u, password_hash: undefined })) });
});

app.get('/api/users/drivers', auth, (req, res) => {
  const drivers = users.filter(u => u.role === 'driver').map(u => ({ 
    id: u.id, 
    username: u.username, 
    email: u.email, 
    created_at: u.created_at 
  }));
  res.json({ drivers });
});

// Customers endpoints
app.get('/api/customers', auth, (req, res) => {
  res.json({ customers });
});

app.get('/api/customers/search', auth, (req, res) => {
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

app.post('/api/customers', auth, (req, res) => {
  const { name, phone, email, addresses, notes, contractor } = req.body;
  
  if (!name || !addresses || addresses.length === 0) {
    return res.status(400).json({ message: 'Name and at least one address are required' });
  }

  const newCustomer = {
    id: nextCustomerId++,
    name,
    phone: phone || null,
    email: email || null,
    addresses,
    notes: notes || null,
    contractor: contractor || false,
    total_deliveries: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  customers.push(newCustomer);
  res.status(201).json({ message: 'Customer created successfully', customer: newCustomer });
});

app.put('/api/customers/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const customerIndex = customers.findIndex(c => c.id === id);
  
  if (customerIndex === -1) {
    return res.status(404).json({ message: 'Customer not found' });
  }

  const { name, phone, email, addresses, notes, contractor } = req.body;
  
  customers[customerIndex] = {
    ...customers[customerIndex],
    name: name !== undefined ? name : customers[customerIndex].name,
    phone: phone !== undefined ? phone : customers[customerIndex].phone,
    email: email !== undefined ? email : customers[customerIndex].email,
    addresses: addresses !== undefined ? addresses : customers[customerIndex].addresses,
    notes: notes !== undefined ? notes : customers[customerIndex].notes,
    contractor: contractor !== undefined ? contractor : customers[customerIndex].contractor,
    updated_at: new Date().toISOString()
  };

  res.json({ message: 'Customer updated successfully', customer: customers[customerIndex] });
});

app.delete('/api/customers/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const customerIndex = customers.findIndex(c => c.id === id);
  
  if (customerIndex === -1) {
    return res.status(404).json({ message: 'Customer not found' });
  }

  customers.splice(customerIndex, 1);
  res.json({ message: 'Customer deleted successfully' });
});

// Products endpoints
app.get('/api/products', auth, (req, res) => {
  res.json({ products });
});

app.get('/api/products/active', auth, (req, res) => {
  res.json({ products: products.filter(p => p.active) });
});

app.get('/api/products/pricing/:customerId', auth, (req, res) => {
  const customerId = parseInt(req.params.customerId);
  const customer = customers.find(c => c.id === customerId);
  const isContractor = customer ? customer.contractor : false;
  
  const pricedProducts = products
    .filter(p => p.active)
    .map(p => ({
      ...p,
      current_price: isContractor ? p.contractor_price : p.retail_price,
      price_type: isContractor ? 'contractor' : 'retail',
    }));
  
  res.json({ products: pricedProducts, isContractor, customerId });
});

app.post('/api/products', auth, (req, res) => {
  const { name, unit, retail_price, contractor_price, active = true } = req.body;
  
  if (!name || !unit) {
    return res.status(400).json({ message: 'Name and unit are required' });
  }

  const newProduct = {
    id: nextProductId++,
    name,
    unit,
    retail_price: retail_price || null,
    contractor_price: contractor_price || null,
    active,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  products.push(newProduct);
  res.status(201).json({ message: 'Product created successfully', product: newProduct });
});

app.put('/api/products/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const productIndex = products.findIndex(p => p.id === id);
  
  if (productIndex === -1) {
    return res.status(404).json({ message: 'Product not found' });
  }

  const { name, unit, retail_price, contractor_price, active } = req.body;
  
  products[productIndex] = {
    ...products[productIndex],
    name: name !== undefined ? name : products[productIndex].name,
    unit: unit !== undefined ? unit : products[productIndex].unit,
    retail_price: retail_price !== undefined ? retail_price : products[productIndex].retail_price,
    contractor_price: contractor_price !== undefined ? contractor_price : products[productIndex].contractor_price,
    active: active !== undefined ? active : products[productIndex].active,
    updated_at: new Date().toISOString()
  };

  res.json({ message: 'Product updated successfully', product: products[productIndex] });
});

app.delete('/api/products/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const productIndex = products.findIndex(p => p.id === id);
  
  if (productIndex === -1) {
    return res.status(404).json({ message: 'Product not found' });
  }

  products.splice(productIndex, 1);
  res.json({ message: 'Product deleted successfully' });
});

// Jobs endpoints
app.get('/api/jobs', auth, (req, res) => {
  const { date, status, driver_id } = req.query;
  let result = [...jobs];

  if (date) {
    result = result.filter(job => job.delivery_date === date);
  }
  
  if (status) {
    result = result.filter(job => job.status === status);
  }
  
  if (driver_id) {
    result = result.filter(job => job.assigned_driver === parseInt(driver_id));
  }

  res.json({ jobs: result });
});

app.get('/api/jobs/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const job = jobs.find(j => j.id === id);
  
  if (!job) {
    return res.status(404).json({ message: 'Job not found' });
  }

  res.json({ job });
});

app.post('/api/jobs', auth, (req, res) => {
  const {
    customer_name,
    customer_phone,
    address,
    delivery_date,
    special_instructions,
    paid,
    products: jobProducts,
    assigned_driver,
    customer_id,
    total_amount,
    contractor_discount
  } = req.body;

  if (!customer_name || !address || !delivery_date) {
    return res.status(400).json({ message: 'Customer name, address, and delivery date are required' });
  }

  if (!jobProducts || jobProducts.length === 0) {
    return res.status(400).json({ message: 'At least one product is required' });
  }

  const newJob = {
    id: nextJobId++,
    customer_id: customer_id || null,
    customer_name,
    customer_phone: customer_phone || null,
    address,
    delivery_date,
    special_instructions: special_instructions || '',
    paid: paid || false,
    status: 'scheduled',
    driver_notes: '',
    payment_received: 0,
    total_amount: total_amount || 0,
    contractor_discount: contractor_discount || false,
    assigned_driver: assigned_driver || null,
    products: jobProducts.map((p, index) => ({
      id: index + 1,
      product_name: p.product_name,
      quantity: p.quantity,
      unit: p.unit,
      unit_price: p.unit_price || 0,
      total_price: p.total_price || 0
    })),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  jobs.push(newJob);
  res.status(201).json({ message: 'Job created successfully', job: newJob });
});

app.put('/api/jobs/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const jobIndex = jobs.findIndex(j => j.id === id);
  
  if (jobIndex === -1) {
    return res.status(404).json({ message: 'Job not found' });
  }

  const updateFields = [
    'customer_name', 'customer_phone', 'address', 'delivery_date',
    'special_instructions', 'paid', 'status', 'driver_notes', 
    'payment_received', 'assigned_driver'
  ];

  updateFields.forEach(field => {
    if (req.body[field] !== undefined) {
      jobs[jobIndex][field] = req.body[field];
    }
  });

  jobs[jobIndex].updated_at = new Date().toISOString();

  res.json({ message: 'Job updated successfully', job: jobs[jobIndex] });
});

app.delete('/api/jobs/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const jobIndex = jobs.findIndex(j => j.id === id);
  
  if (jobIndex === -1) {
    return res.status(404).json({ message: 'Job not found' });
  }

  jobs.splice(jobIndex, 1);
  res.json({ message: 'Job deleted successfully' });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'East Meadow Nursery API test successful',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /api/auth/me',
      'POST /api/auth/login',
      'GET /api/users/drivers',
      'GET /api/customers',
      'POST /api/customers',
      'GET /api/products',
      'POST /api/products',
      'GET /api/jobs',
      'POST /api/jobs'
    ]
  });
});

app.listen(PORT, () => {
  console.log('=== EAST MEADOW NURSERY COMPLETE SERVER RUNNING ON PORT', PORT, '===');
  console.log('Company: East Meadow Nursery');
  console.log('Phone: 413-566-TREE');
  console.log('Available endpoints:');
  console.log('- Authentication: /api/auth/*');
  console.log('- Users: /api/users/*');
  console.log('- Customers: /api/customers/*');
  console.log('- Products: /api/products/*');
  console.log('- Jobs: /api/jobs/*');
});
