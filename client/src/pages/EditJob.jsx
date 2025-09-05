import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

const EditJob = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isOffice } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState(null);
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    if (!isOffice) {
      navigate('/jobs');
      return;
    }
    fetchJob();
    fetchDrivers();
  }, [id, isOffice, navigate]);

  const fetchJob = async () => {
    try {
      const response = await axios.get(`/jobs/${id}`);
      setJob(response.data.job);
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
      const response = await axios.get('/users/drivers');
      setDrivers(response.data.drivers || []);
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setJob(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updateData = {
        customer_name: job.customer_name,
        customer_phone: job.customer_phone,
        address: job.address,
        delivery_date: job.delivery_date,
        special_instructions: job.special_instructions,
        paid: job.paid,
        assigned_driver: job.assigned_driver ? parseInt(job.assigned_driver) : null,
        status: job.status
      };

      await axios.put(`/jobs/${id}`, updateData);
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
                Edit Delivery
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
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
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
                />
              </div>
            </div>

            {/* Products (Read-only) */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-900">Products</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                {job.products && job.products.length > 0 ? (
                  <div className="space-y-2">
                    {job.products.map((product, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-gray-900">{product.product_name}</span>
                        <span className="text-gray-600">
                          {product.quantity} {product.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No products listed</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  Product changes require creating a new delivery
                </p>
              </div>
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
                  className="h-4 w-4 text-nursery-600 focus:ring-nursery-500 border-gray-300 rounded"
                />
                <label htmlFor="paid" className="ml-2 text-sm text-gray-700">
                  Payment has been received
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