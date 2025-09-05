import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, ArrowLeft, DollarSign, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import CustomerSearch from '../components/CustomerSearch';

const AddJob = () => {
  const navigate = useNavigate();
  const { isOffice, makeAuthenticatedRequest } = useAuth();
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);
  
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    address: '',
    delivery_date: new Date().toISOString().split('T')[0],
    special_instructions: '',
    paid: false,
    assigned_driver: '',
    products: [{ product_name: '', quantity: '', unit: 'yards', unit_price: 0, total_price: 0 }]
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

  useEffect(() => {
    if (selectedCustomer) {
      fetchProductsWithPricing();
    }
  }, [selectedCustomer]);

  const fetchDrivers = async () => {
    try {
      // Use makeAuthenticatedRequest instead of regular axios
      const response = await makeAuthenticatedRequest('get', '/users/drivers');
      setDrivers(response.data.drivers || []);
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      // Use makeAuthenticatedRequest instead of regular axios
      const response = await makeAuthenticatedRequest('get', '/products/active');
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const fetchProductsWithPricing = async () => {
    if (!selectedCustomer) return;
    
    try {
      // Use makeAuthenticatedRequest instead of regular axios
      const response = await makeAuthenticatedRequest('get', `/products/pricing/${selectedCustomer.id}`);
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Failed to fetch product pricing:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    if (customer) {
      setFormData(prev => ({
        ...prev,
        customer_name: customer.name,
        customer_phone: customer.phone || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        customer_name: '',
        customer_phone: ''
      }));
    }
    setSelectedAddress(null);
  };

  const handleAddressSelect = (address) => {
    setSelectedAddress(address);
    if (address) {
      setFormData(prev => ({
        ...prev,
        address: address.address,
        special_instructions: address.notes || ''
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        address: '',
        special_instructions: ''
      }));
    }
  };

  const handleProductChange = (index, field, value) => {
    const updatedProducts = [...formData.products];
    updatedProducts[index][field] = value;

    // Update pricing when product or quantity changes
    if (field === 'product_name' || field === 'quantity') {
      const selectedProduct = products.find(p => p.name === updatedProducts[index].product_name);
      if (selectedProduct && updatedProducts[index].quantity) {
        const unitPrice = selectedProduct.current_price || 0;
        const quantity = parseFloat(updatedProducts[index].quantity) || 0;
        updatedProducts[index].unit_price = unitPrice;
        updatedProducts[index].total_price = unitPrice * quantity;
      } else {
        updatedProducts[index].unit_price = 0;
        updatedProducts[index].total_price = 0;
      }
    }

    setFormData(prev => ({
      ...prev,
      products: updatedProducts
    }));
  };

  const addProduct = () => {
    setFormData(prev => ({
      ...prev,
      products: [...prev.products, { product_name: '', quantity: '', unit: 'yards', unit_price: 0, total_price: 0 }]
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

  const calculateTotal = () => {
    return formData.products.reduce((total, product) => total + (product.total_price || 0), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.customer_name.trim() || !formData.address.trim()) {
      toast.error('Customer name and address are required');
      return;
    }

    if (formData.products.some(p => !p.product_name || !p.quantity)) {
      toast.error('All products must have a name and quantity');
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        ...formData,
        assigned_driver: formData.assigned_driver ? parseInt(formData.assigned_driver) : null,
        products: formData.products.map(p => ({
          product_name: p.product_name,
          quantity: parseFloat(p.quantity),
          unit: p.unit,
          unit_price: p.unit_price,
          total_price: p.total_price,
          price_type: selectedCustomer?.contractor ? 'contractor' : 'retail'
        })),
        customer_id: selectedCustomer?.id || null,
        total_amount: calculateTotal(),
        contractor_discount: selectedCustomer?.contractor || false
      };

      // Use makeAuthenticatedRequest instead of regular axios
      await makeAuthenticatedRequest('post', '/jobs', submitData);
      toast.success('Delivery scheduled successfully!');
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

  const orderTotal = calculateTotal();

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
                    required
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
                              {p.name} - ${p.current_price ? parseFloat(p.current_price).toFixed(2) : '0.00'}/{p.unit}
                              {selectedCustomer?.contractor && p.price_type === 'contractor' && ' (Contractor Price)'}
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

                    {/* Price Display */}
                    {selectedProduct && product.quantity && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">
                            {product.quantity} {product.unit} × ${parseFloat(selectedProduct.current_price || 0).toFixed(2)}
                            {selectedCustomer?.contractor && (
                              <span className="text-blue-600 ml-1">(Contractor Price)</span>
                            )}
                          </span>
                          <span className="font-medium text-gray-900">
                            ${product.total_price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Order Total */}
              {orderTotal > 0 && (
                <div className="bg-eastmeadow-50 border border-eastmeadow-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-eastmeadow-600" />
                      <span className="font-medium text-eastmeadow-900">Order Total</span>
                      {selectedCustomer?.contractor && (
                        <span className="text-sm text-blue-600">(With Contractor Pricing)</span>
                      )}
                    </div>
                    <span className="text-xl font-bold text-eastmeadow-900">
                      ${orderTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Status */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-900">Payment</h2>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="paid"
                  name="paid"
                  checked={formData.paid}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-eastmeadow-600 focus:ring-eastmeadow-500 border-gray-300 rounded"
                />
                <label htmlFor="paid" className="ml-2 text-sm text-gray-700">
                  Payment has been received
                  {orderTotal > 0 && (
                    <span className="ml-1 text-gray-500">
                      (${orderTotal.toFixed(2)})
                    </span>
                  )}
                </label>
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
