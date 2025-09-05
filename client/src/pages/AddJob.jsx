import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Plus, X, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

const AddJob = () => {
  const navigate = useNavigate();
  const { isOffice } = useAuth();
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState([]);
  
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    address: '',
    delivery_date: new Date().toISOString().split('T')[0],
    special_instructions: '',
    paid: false,
    assigned_driver: '',
    products: [{ product_name: '', quantity: '', unit: 'yards' }]
  });

  const productOptions = [
    'Premium Mulch',
    'Topsoil', 
    'Stone Dust',
    'Sand',
    'Gravel',
    'Compost',
    'Bark Mulch',
    'Peat Moss'
  ];
  
  const unitOptions = ['yards', 'tons', 'bags'];

  useEffect(() => {
    if (!isOffice) {
      navigate('/jobs');
      return;
    }
    fetchDrivers();
  }, [isOffice, navigate]);

  const fetchDrivers = async () => {
    try {
      const response = await axios.get('/users/drivers');
      setDrivers(response.data.drivers || []);
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
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
          ...p,
          quantity: parseFloat(p.quantity)
        }))
      };

      await axios.post('/jobs', submitData);
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
                Schedule New Delivery
              </h1>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Customer Information */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-900">Customer Information</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  name="customer_name"
                  value={formData.customer_name}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="Enter customer name"
                  required
                />
              </div>

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
                  placeholder="(555) 123-4567"
                />
              </div>

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

              {formData.products.map((product, index) => (
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
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
                        {productOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
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
                </div>
              ))}
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
                  className="h-4 w-4 text-nursery-600 focus:ring-nursery-500 border-gray-300 rounded"
                />
                <label htmlFor="paid" className="ml-2 text-sm text-gray-700">
                  Payment has been received
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
