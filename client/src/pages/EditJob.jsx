import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

const EditJob = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isOffice, makeAuthenticatedRequest } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const unitOptions = ['yards', 'tons', 'bales', 'each'];

  useEffect(() => {
    if (!isOffice) {
      navigate('/jobs');
      return;
    }
    fetchJob();
    fetchDrivers();
  }, [id, isOffice, navigate]);

  useEffect(() => {
    if (job) {
      fetchProducts();
    }
  }, [job]);

  const fetchJob = async () => {
    try {
      // Use makeAuthenticatedRequest instead of regular axios
      const response = await makeAuthenticatedRequest('get', `/jobs/${id}`);
      const jobData = response.data.job;
      if (!jobData.products || jobData.products.length === 0) {
        jobData.products = [
          { product_name: '', quantity: '', unit: 'yards', unit_price: 0, total_price: 0 }
        ];
      }
      setJob(jobData);
    } catch (error) {
      console.error('Failed to fetch job:', error);
      toast.error('Failed to load job details');
      navigate('/jobs');
    } finally {
      setLoading(false);
    }
  };

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
      let response;
      if (job?.customer_id) {
        response = await makeAuthenticatedRequest('get', `/products/pricing/${job.customer_id}`);
      } else {
        response = await makeAuthenticatedRequest('get', '/products/active');
      }
      setAvailableProducts(response.data.products || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setJob(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleProductChange = (index, field, value) => {
    const updatedProducts = [...job.products];
    updatedProducts[index][field] = value;

    if (field === 'product_name' || field === 'quantity') {
      const selectedProduct = availableProducts.find(p => p.name === updatedProducts[index].product_name);
      if (selectedProduct && updatedProducts[index].quantity) {
        const unitPrice = selectedProduct.current_price || 0;
        const quantity = parseFloat(updatedProducts[index].quantity) || 0;
        updatedProducts[index].unit_price = unitPrice;
        updatedProducts[index].total_price = unitPrice * quantity;
        updatedProducts[index].price_type = selectedProduct.price_type || 'retail';
      } else {
        updatedProducts[index].unit_price = 0;
        updatedProducts[index].total_price = 0;
      }
    }

    setJob(prev => ({ ...prev, products: updatedProducts }));
  };

  const addProduct = () => {
    setJob(prev => ({
      ...prev,
      products: [...prev.products, { product_name: '', quantity: '', unit: 'yards', unit_price: 0, total_price: 0 }]
    }));
  };

  const removeProduct = (index) => {
    if (job.products.length > 1) {
      const updatedProducts = job.products.filter((_, i) => i !== index);
      setJob(prev => ({ ...prev, products: updatedProducts }));
    }
  };

  const calculateTotal = () => {
    return job.products.reduce((total, p) => total + (p.total_price || 0), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (job.products.some(p => !p.product_name || !p.quantity)) {
        toast.error('All products must have a name and quantity');
        setSaving(false);
        return;
      }

      const updateData = {
        customer_name: job.customer_name,
        customer_phone: job.customer_phone,
        address: job.address,
        delivery_date: job.delivery_date,
        special_instructions: job.special_instructions,
        paid: job.paid,
        assigned_driver: job.assigned_driver ? parseInt(job.assigned_driver) : null,
        status: job.status,
        products: job.products.map(p => ({
          product_name: p.product_name,
          quantity: parseFloat(p.quantity),
          unit: p.unit,
          unit_price: p.unit_price,
          total_price: p.total_price,
          price_type: p.price_type || 'retail'
        })),
        total_amount: calculateTotal(),
        contractor_discount: job.contractor_discount || false
      };

      await makeAuthenticatedRequest('put', `/jobs/${id}`, updateData);
      toast.success('Job updated successfully!');
      navigate('/jobs');
    } catch (error) {
      console.error('Failed to update job:', error);
      const message = error.response?.data?.message || 'Failed to update job';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOffice) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6">
        <div className="text-center">
          <p className="text-gray-500">Job not found</p>
          <button
            onClick={() => navigate('/jobs')}
            className="mt-4 btn-primary"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
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
                Edit East Meadow Delivery
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
                  value={job.customer_name || ''}
                  onChange={handleInputChange}
                  className="input-field"
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
                  value={job.customer_phone || ''}
                  onChange={handleInputChange}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Address *
                </label>
                <textarea
                  name="address"
                  value={job.address || ''}
                  onChange={handleInputChange}
                  className="input-field"
                  rows="3"
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
                    value={job.delivery_date || ''}
                    onChange={handleInputChange}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={job.status || 'scheduled'}
                    onChange={handleInputChange}
                    className="input-field"
                  >
                    <option value="scheduled">Scheduled</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign Driver
                </label>
                <select
                  name="assigned_driver"
                  value={job.assigned_driver || ''}
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Special Instructions
                </label>
                <textarea
                  name="special_instructions"
                  value={job.special_instructions || ''}
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
                <h2 className="text-lg font-medium text-gray-900">Products</h2>
                <button
                  type="button"
                  onClick={addProduct}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </button>
              </div>

              {job.products && job.products.map((product, index) => {
                const selectedProduct = availableProducts.find(p => p.name === product.product_name);
                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">
                        Product {index + 1}
                      </span>
                      {job.products.length > 1 && (
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
                          {availableProducts.map(p => (
                            <option key={p.id} value={p.name}>
                              {p.name} - ${parseFloat(p.current_price || 0).toFixed(2)}/{p.unit}
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
            </div>

            {/* Payment Status */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-900">Payment</h2>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="paid"
                  name="paid"
                  checked={job.paid || false}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-eastmeadow-600 focus:ring-eastmeadow-500 border-gray-300 rounded"
                />
                <label htmlFor="paid" className="ml-2 text-sm text-gray-700">
                  Payment has been received
                  {calculateTotal() > 0 && (
                    <span className="ml-1 text-gray-500">
                      (${calculateTotal().toFixed(2)})
                    </span>
                  )}
                </label>
              </div>
            </div>

            {/* Driver Notes (Read-only if present) */}
            {job.driver_notes && (
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-gray-900">Driver Notes</h2>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-700">{job.driver_notes}</p>
                </div>
              </div>
            )}

            {/* Payment Received (Read-only if present) */}
            {job.payment_received > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-gray-900">Payment Collected</h2>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-700 font-medium">${job.payment_received}</p>
                </div>
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <LoadingSpinner size="small" />
                    Updating...
                  </>
                ) : (
                  'Update Delivery'
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate('/jobs')}
                className="btn-secondary px-6"
                disabled={saving}
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

export default EditJob;
