import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, ArrowLeft, DollarSign, Clock, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import CustomerSearch from '../components/CustomerSearch';

// Consistently use Eastern Time for date handling
const LOCAL_TIME_ZONE = 'America/New_York';

const AddJob = () => {
  const navigate = useNavigate();
  const { isOffice, makeAuthenticatedRequest } = useAuth();
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [toBeScheduled, setToBeScheduled] = useState(false);
  
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    address: '',
    // Default to today's date in Eastern Time
    delivery_date: new Date().toLocaleDateString('en-CA', { timeZone: LOCAL_TIME_ZONE }),
    special_instructions: '',
    assigned_driver: '',
    products: [{ product_name: '', quantity: '', unit: 'yards' }],
    collection_amount: '',
    truck: ''
  });

  const unitOptions = ['yards', 'tons', 'bags', 'each'];

  useEffect(() => {
    if (!isOffice) {
      navigate('/jobs');
      return;
    }
    fetchDrivers();
    fetchProducts();
  }, [isOffice, navigate]);

  const fetchDrivers = async () => {
    try {
      const response = await makeAuthenticatedRequest('get', '/users/drivers');
      setDrivers(response.data.drivers || []);
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await makeAuthenticatedRequest('get', '/products/active');
      const products = response.data.products || [];

      setProducts(products);
      console.log('✅ Products loaded:', products.length);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    console.log('=== FORM INPUT CHANGE ===');
    console.log('Field:', name, 'Value:', value, 'Type:', type, 'Checked:', checked);
    
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      };
      console.log('Updated form data:', newData);
      return newData;
    });
  };

  const handleToBeScheduledChange = (e) => {
    const checked = e.target.checked;
    setToBeScheduled(checked);
    
    if (checked) {
      // Clear delivery date and driver when "to be scheduled" is selected
      setFormData(prev => ({
        ...prev,
        delivery_date: '',
        assigned_driver: ''
      }));
    } else {
      // Set to today's date when unchecked
      setFormData(prev => ({
        ...prev,
        delivery_date: new Date().toISOString().split('T')[0]
      }));
    }
  };

  const handleCustomerSelect = (customer) => {
    console.log('=== CUSTOMER SELECTED ===');
    console.log('Selected customer:', customer);
    
    setSelectedCustomer(customer);
    if (customer) {
      setFormData(prev => ({
        ...prev,
        customer_phone: customer.phone || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        customer_phone: ''
      }));
    }
    setSelectedAddress(null);
  };

  const handleCustomerNameChange = (name) => {
    console.log('=== CUSTOMER NAME CHANGED ===');
    console.log('New customer name:', name);
    
    setFormData(prev => ({
      ...prev,
      customer_name: name
    }));
  };

  const handleAddressSelect = (address) => {
    console.log('=== ADDRESS SELECTED ===');
    console.log('Selected address:', address);
    
    setSelectedAddress(address);
    if (address) {
      const newFormData = {
        ...formData,
        address: address.address,
        special_instructions: address.notes || ''
      };
      console.log('Updated form data with address:', newFormData);
      setFormData(newFormData);
    } else {
      const newFormData = {
        ...formData,
        address: '',
        special_instructions: ''
      };
      console.log('Cleared address data:', newFormData);
      setFormData(newFormData);
    }
  };

  const handleProductChange = (index, field, value) => {
    const updatedProducts = [...formData.products];
    updatedProducts[index][field] = value;

    setFormData(prev => ({
      ...prev,
      products: updatedProducts
    }));
  };

  const addProduct = () => {
    setFormData(prev => ({
      ...prev,
      products: [...prev.products, { product_name: '', quantity: '', unit: 'yards' }]
    }));
  };

  const removeProduct = (index) => {
    if (formData.products.length > 1) {
      const updatedProducts = formData.products.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        products: updatedProducts
      }));
    }
  };

  const createCustomerIfNeeded = async () => {
    if (selectedCustomer) {
      console.log('Using existing customer:', selectedCustomer.id);
      return selectedCustomer.id;
    }

    if (!formData.customer_name || !formData.customer_name.trim()) {
      throw new Error('Customer name is required');
    }

    console.log('Creating new customer:', formData.customer_name);

    try {
      const customerData = {
        name: formData.customer_name.trim(),
        phone: formData.customer_phone?.trim() || null,
        email: null,
        addresses: formData.address ? [{ address: formData.address, notes: formData.special_instructions || '' }] : [],
        notes: null,
        contractor: false
      };

      const response = await makeAuthenticatedRequest('post', '/customers', customerData);
      const newCustomer = response.data.customer;
      
      console.log('✅ New customer created:', newCustomer.id);
      return newCustomer.id;
    } catch (error) {
      console.error('Failed to create customer:', error);
      console.log('⚠️ Customer creation failed, continuing without customer_id');
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('=== FORM SUBMISSION ===');
    console.log('Current form data:', formData);
    console.log('To be scheduled:', toBeScheduled);
    console.log('Selected customer:', selectedCustomer);
    
    // Enhanced validation
    const validationErrors = [];
    
    if (!formData.customer_name || !formData.customer_name.trim()) {
      validationErrors.push('Customer name is required');
      console.log('❌ Customer name validation failed');
    } else {
      console.log('✅ Customer name validation passed:', formData.customer_name);
    }
    
    if (!formData.address || !formData.address.trim()) {
      validationErrors.push('Delivery address is required');
      console.log('❌ Address validation failed');
    } else {
      console.log('✅ Address validation passed');
    }

    // Only require delivery date if not "to be scheduled"
    if (!toBeScheduled && (!formData.delivery_date || !formData.delivery_date.trim())) {
      validationErrors.push('Delivery date is required (or check "To Be Scheduled")');
      console.log('❌ Delivery date validation failed');
    } else {
      console.log('✅ Delivery date validation passed');
    }

    if (formData.products.some(p => !p.product_name || !p.quantity)) {
      validationErrors.push('All products must have a name and quantity');
      console.log('❌ Products validation failed');
    } else {
      console.log('✅ Products validation passed');
    }

    if (validationErrors.length > 0) {
      console.log('❌ Validation errors:', validationErrors);
      toast.error(validationErrors[0]);
      return;
    }

    console.log('✅ All validation passed, submitting...');
    setLoading(true);

    try {
      const customerId = await createCustomerIfNeeded();

      const submitData = {
        ...formData,
        // Set delivery_date to null if "to be scheduled"
        delivery_date: toBeScheduled ? null : formData.delivery_date,
        // Don't assign driver if "to be scheduled"
        assigned_driver: toBeScheduled ? null : (formData.assigned_driver ? parseInt(formData.assigned_driver) : null),
        products: formData.products.map(p => ({
          product_name: p.product_name,
          quantity: parseFloat(p.quantity),
          unit: p.unit
        })),
        total_amount: formData.collection_amount ? parseFloat(formData.collection_amount) : 0,
        contractor_discount: selectedCustomer?.contractor || false,
        // Add status to indicate if it needs scheduling
        status: toBeScheduled ? 'to_be_scheduled' : 'scheduled'
      };

      if (formData.truck && formData.truck.trim()) {
        submitData.truck = formData.truck.trim();
      }

      if (customerId) {
        submitData.customer_id = customerId;
      }

      console.log('Submitting data:', submitData);

      await makeAuthenticatedRequest('post', '/jobs', submitData);
      
      if (toBeScheduled) {
        toast.success('Order saved! Ready to schedule delivery date.');
      } else {
        toast.success('Delivery scheduled successfully!');
      }
      
      navigate('/jobs');
    } catch (error) {
      console.error('Failed to create job:', error);
      const message = error.response?.data?.message || 'Failed to create delivery';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOffice) {
    return null;
  }

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/jobs')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                Schedule New East Meadow Delivery
              </h1>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Customer Information */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-900">Customer Information</h2>
              
              <CustomerSearch
                onCustomerSelect={handleCustomerSelect}
                selectedCustomer={selectedCustomer}
                onAddressSelect={handleAddressSelect}
                selectedAddress={selectedAddress}
                onCustomerNameChange={handleCustomerNameChange}
                customerName={formData.customer_name}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="customer_phone"
                  value={formData.customer_phone}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="(413) 555-1234"
                />
              </div>

              {!selectedAddress && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Address *
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="input-field"
                    rows="3"
                    placeholder="Enter complete delivery address"
                    required
                  />
                </div>
              )}
            </div>

            {/* Delivery Details */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-900">Delivery Details</h2>
              
              {/* To Be Scheduled Checkbox */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="toBeScheduled"
                    checked={toBeScheduled}
                    onChange={handleToBeScheduledChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="toBeScheduled" className="ml-3 flex items-center">
                    <Clock className="h-5 w-5 text-blue-600 mr-2" />
                    <div>
                      <span className="text-sm font-medium text-blue-900">To Be Scheduled</span>
                      <p className="text-xs text-blue-700">
                        Check this if customer hasn't decided on delivery date yet
                      </p>
                    </div>
                  </label>
                </div>
              </div>
              
              {!toBeScheduled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Date *
                    </label>
                    <input
                      type="date"
                      name="delivery_date"
                      value={formData.delivery_date}
                      onChange={handleInputChange}
                      className="input-field"
                      required={!toBeScheduled}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assign Driver
                    </label>
                    <select
                      name="assigned_driver"
                      value={formData.assigned_driver}
                      onChange={handleInputChange}
                      className="input-field"
                    >
                      <option value="">Select driver (optional)</option>
                      {drivers.map(driver => (
                        <option key={driver.id} value={driver.id}>
                          {driver.username}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Truck
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Truck className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="truck"
                    value={formData.truck}
                    onChange={handleInputChange}
                    className="input-field pl-9"
                    placeholder="e.g. Dump Truck 2"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Let drivers know which vehicle to use for this delivery.
                </p>
              </div>

              {toBeScheduled && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 text-sm">
                    <strong>📅 Scheduling Note:</strong> This order will be saved without a delivery date.
                    You can set the date and assign a driver later from the Jobs page.
                  </p>
                </div>
              )}

              {!selectedAddress && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Special Instructions
                  </label>
                  <textarea
                    name="special_instructions"
                    value={formData.special_instructions}
                    onChange={handleInputChange}
                    className="input-field"
                    rows="3"
                    placeholder="Gate codes, special access instructions, etc."
                  />
                </div>
              )}
            </div>

            {/* Products */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">Products *</h2>
                <button
                  type="button"
                  onClick={addProduct}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </button>
              </div>

              {formData.products.map((product, index) => {
                const selectedProduct = products.find(p => p.name === product.product_name);
                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">
                        Product {index + 1}
                      </span>
                      {formData.products.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProduct(index)}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Product
                        </label>
                        <select
                          value={product.product_name}
                          onChange={(e) => handleProductChange(index, 'product_name', e.target.value)}
                          className="input-field"
                          required
                        >
                          <option value="">Select product</option>
                          {products.map(p => (
                            <option key={p.id} value={p.name}>
                              {p.name}
                              {p.unit ? ` (${p.unit})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={product.quantity}
                          onChange={(e) => handleProductChange(index, 'quantity', e.target.value)}
                          className="input-field"
                          placeholder="0.0"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Unit
                        </label>
                        <select
                          value={product.unit}
                          onChange={(e) => handleProductChange(index, 'unit', e.target.value)}
                          className="input-field"
                        >
                          {unitOptions.map(unit => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Unit Display */}
                    {selectedProduct && selectedProduct.unit && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                        <span className="font-medium text-gray-900">Unit:</span> {selectedProduct.unit}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Payment Status */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-900">Payment</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount to Collect (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    name="collection_amount"
                    value={formData.collection_amount}
                    onChange={handleInputChange}
                    className="input-field pl-9"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Enter the amount the driver should collect at delivery, if any.
                </p>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="small" />
                    Creating...
                  </>
                ) : toBeScheduled ? (
                  'Save Order (Schedule Later)'
                ) : (
                  'Schedule Delivery'
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/jobs')}
                className="btn-secondary px-6"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddJob;
