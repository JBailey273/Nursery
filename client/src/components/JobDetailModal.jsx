import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Phone,
  Package,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Edit,
  Save,
  Clock,
  User,
  FileText,
  Trash2,
  Plus
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from './StatusBadge';
import toast from 'react-hot-toast';

const JobDetailModal = ({ job, isOpen, onClose, onUpdate, drivers = [] }) => {
  const { user, isOffice, isAdmin, makeAuthenticatedRequest } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [driverNotes, setDriverNotes] = useState('');
  const [paymentReceived, setPaymentReceived] = useState('');
  const [loading, setLoading] = useState(false);
  const [editProducts, setEditProducts] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const unitOptions = ['yards', 'tons', 'bales', 'each'];

  // Fetch available products when editing
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

  useEffect(() => {
    if (isEditing && (isOffice || isAdmin) && job) {
      setEditProducts(
        job.products && job.products.length > 0
          ? job.products.map(p => ({ ...p }))
          : [{ product_name: '', quantity: '', unit: 'yards', unit_price: 0, total_price: 0 }]
      );
      fetchProducts();
    }
  }, [isEditing, job]);

  if (!isOpen || !job) return null;

  // Helper function to safely format dates
  const formatDate = (dateString) => {
    if (!dateString) return null;
    
    try {
      let date;
      if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Already in YYYY-MM-DD format, add time to avoid timezone issues
        date = new Date(dateString + 'T12:00:00');
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return null;
      }
      
      return date;
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return null;
    }
  };

  // Get driver name helper
  const getDriverName = (driverId) => {
    if (!driverId) return 'Unassigned';
    const driver = drivers.find(d => d.id === driverId);
    return driver ? driver.username : `Driver ID: ${driverId}`;
  };

  // Calculate total amount due
  // Ensure numeric values to prevent toFixed errors when API returns strings
  const productsSource = isEditing ? editProducts : job.products;
  const productsTotal = productsSource?.reduce(
    (sum, p) => sum + (parseFloat(p.total_price) || 0),
    0
  ) || 0;
  const totalDue = parseFloat(job.total_amount) || productsTotal;
  const alreadyPaid = parseFloat(job.payment_received) || 0;
  const amountDue = job.paid ? 0 : Math.max(0, totalDue - alreadyPaid);
  const isFullyPaid = job.paid || (totalDue > 0 && alreadyPaid >= totalDue);
  const isPartiallyPaid = !isFullyPaid && alreadyPaid > 0;

  const handleEditChange = (field, value) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleProductChange = (index, field, value) => {
    const updated = [...editProducts];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'product_name' || field === 'quantity') {
      const selected = availableProducts.find(p => p.name === updated[index].product_name);
      if (selected && updated[index].quantity) {
        const unitPrice = selected.current_price || 0;
        const quantity = parseFloat(updated[index].quantity) || 0;
        updated[index].unit_price = unitPrice;
        updated[index].total_price = unitPrice * quantity;
        updated[index].price_type = selected.price_type || 'retail';
        if (field === 'product_name' && selected.unit) {
          updated[index].unit = selected.unit;
        }
      } else {
        updated[index].unit_price = 0;
        updated[index].total_price = 0;
      }
    }

    setEditProducts(updated);
  };

  const addProduct = () => {
    setEditProducts(prev => [
      ...prev,
      { product_name: '', quantity: '', unit: 'yards', unit_price: 0, total_price: 0 }
    ]);
  };

  const removeProduct = (index) => {
    if (editProducts.length > 1) {
      setEditProducts(editProducts.filter((_, i) => i !== index));
    }
  };

  const calculateEditTotal = () => {
    return editProducts.reduce((total, p) => total + (p.total_price || 0), 0);
  };

  const handleSaveEdit = async () => {
    if (!(isOffice || isAdmin)) return;

    setLoading(true);
    try {
      const updateData = { ...editData };
      if (updateData.assigned_driver !== undefined) {
        updateData.assigned_driver = updateData.assigned_driver
          ? parseInt(updateData.assigned_driver)
          : null;
      }
      if (updateData.delivery_date) {
        updateData.status = 'scheduled';
      }
      if (editProducts.length > 0) {
        updateData.products = editProducts.map(p => ({
          product_name: p.product_name,
          quantity: parseFloat(p.quantity),
          unit: p.unit,
          unit_price: p.unit_price,
          total_price: p.total_price,
          price_type: p.price_type || 'retail'
        }));
        updateData.total_amount = calculateEditTotal();
      }

      await makeAuthenticatedRequest('put', `/jobs/${job.id}`, updateData);
      onUpdate();
      setIsEditing(false);
      setEditData({});
      setEditProducts([]);
      toast.success('Job updated successfully');
    } catch (error) {
      console.error('Failed to update job:', error);
      toast.error('Failed to update job');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteDelivery = async () => {
    setLoading(true);
    try {
      const updateData = {
        status: 'completed',
        driver_notes: driverNotes || undefined,
        payment_received: paymentReceived ? parseFloat(paymentReceived) : undefined
      };

      await makeAuthenticatedRequest('put', `/jobs/${job.id}`, updateData);
      onUpdate();
      onClose();
      toast.success('Delivery completed successfully!');
    } catch (error) {
      console.error('Failed to complete delivery:', error);
      toast.error('Failed to complete delivery');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!isAdmin) return;
    if (!confirm('Are you sure you want to delete this delivery?')) {
      return;
    }

    setLoading(true);
    try {
      await makeAuthenticatedRequest('delete', `/jobs/${job.id}`);
      onUpdate();
      onClose();
      toast.success('Job deleted successfully');
    } catch (error) {
      console.error('Failed to delete job:', error);
      toast.error('Failed to delete job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Delivery Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Payment Status - Prominent for drivers */}
          <div className={`rounded-lg p-4 border-2 ${
            isFullyPaid
              ? 'bg-green-50 border-green-200'
              : isPartiallyPaid
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-red-50 border-red-200 animate-pulse'
          }`}>
            <div className="flex items-center gap-3">
              {isFullyPaid ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : isPartiallyPaid ? (
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-red-600" />
              )}
              <div className="flex-1">
                <div className={`text-lg font-bold ${
                  isFullyPaid ? 'text-green-900' : isPartiallyPaid ? 'text-yellow-900' : 'text-red-900'
                }`}>
                  {isFullyPaid
                    ? 'PAID IN FULL'
                    : isPartiallyPaid
                      ? `PARTIAL - COLLECT $${amountDue.toFixed(2)}`
                      : `COLLECT $${amountDue.toFixed(2)}`}
                </div>
                {!isFullyPaid && (
                  <div className={`text-sm ${isPartiallyPaid ? 'text-yellow-700' : 'text-red-700'}`}>
                    Total: ${totalDue.toFixed(2)}
                    {alreadyPaid > 0 && ` (${alreadyPaid.toFixed(2)} already paid)`}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Information
            </h3>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <div className="text-sm font-medium text-gray-700">Customer Name</div>
                {isEditing && (isOffice || isAdmin) ? (
                  <input
                    type="text"
                    value={editData.customer_name ?? job.customer_name}
                    onChange={(e) => handleEditChange('customer_name', e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-eastmeadow-500"
                  />
                ) : (
                  <div className="text-lg font-semibold text-gray-900">{job.customer_name}</div>
                )}
              </div>

              {job.customer_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  {isEditing && (isOffice || isAdmin) ? (
                    <input
                      type="tel"
                      value={editData.customer_phone ?? job.customer_phone}
                      onChange={(e) => handleEditChange('customer_phone', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-eastmeadow-500"
                    />
                  ) : (
                    <a href={`tel:${job.customer_phone}`} className="text-blue-600 font-medium">
                      {job.customer_phone}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Delivery Address
            </h3>
            
            <div className="bg-gray-50 rounded-lg p-4">
              {isEditing && (isOffice || isAdmin) ? (
                <textarea
                  value={editData.address ?? job.address}
                  onChange={(e) => handleEditChange('address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-eastmeadow-500"
                  rows="3"
                />
              ) : (
                <div className="text-gray-900 whitespace-pre-wrap">{job.address}</div>
              )}
              
              {/* Map link for mobile */}
              <div className="mt-3">
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-blue-600 font-medium"
                >
                  <MapPin className="h-4 w-4" />
                  Open in Maps
                </a>
              </div>
            </div>
          </div>

          {/* Materials to Deliver */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Materials to Deliver
            </h3>
            
            <div className="bg-gray-50 rounded-lg p-4">
              {isEditing && (isOffice || isAdmin) ? (
                <div className="space-y-4">
                  {editProducts.map((product, index) => {
                    const selectedProduct = availableProducts.find(p => p.name === product.product_name);
                    return (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">Product {index + 1}</span>
                          {editProducts.length > 1 && (
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                            <select
                              value={product.product_name}
                              onChange={(e) => handleProductChange(index, 'product_name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={product.quantity}
                              onChange={(e) => handleProductChange(index, 'quantity', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              placeholder="0.0"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                            <select
                              value={product.unit}
                              onChange={(e) => handleProductChange(index, 'unit', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                              {unitOptions.map(unit => (
                                <option key={unit} value={unit}>{unit}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {selectedProduct && product.quantity && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">
                                {product.quantity} {product.unit} × ${parseFloat(selectedProduct.current_price || 0).toFixed(2)}
                              </span>
                              <span className="font-medium text-gray-900">${product.total_price.toFixed(2)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={addProduct}
                    className="mt-2 btn-secondary flex items-center gap-2 text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Add Product
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {job.products && job.products.length > 0 ? (
                    job.products.map((product, index) => (
                      <div key={index} className="flex justify-between items-center bg-white p-3 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">{product.product_name}</div>
                          <div className="text-sm text-gray-600">
                            {product.quantity} {product.unit}
                          </div>
                        </div>
                        {product.total_price > 0 && (
                          <div className="text-right">
                            <div className="font-medium text-gray-900">
                              ${product.total_price.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-500">
                              ${product.unit_price.toFixed(2)}/{product.unit}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 italic">No specific products listed</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Special Instructions */}
          {job.special_instructions && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Special Instructions
              </h3>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                {isEditing && (isOffice || isAdmin) ? (
                  <textarea
                    value={editData.special_instructions ?? job.special_instructions}
                    onChange={(e) => handleEditChange('special_instructions', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-eastmeadow-500"
                    rows="3"
                  />
                ) : (
                  <div className="text-yellow-800 whitespace-pre-wrap">{job.special_instructions}</div>
                )}
              </div>
            </div>
          )}

          {/* Delivery Status & Actions */}
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Delivery Status
            </h3>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Current Status</span>
                <StatusBadge status={job.status} />
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Scheduled Date</span>
                {isEditing && (isOffice || isAdmin) ? (
                  <input
                    type="date"
                    value={
                      editData.delivery_date ??
                      (formatDate(job.delivery_date)?.toLocaleDateString('en-CA', {
                        timeZone: 'America/New_York'
                      }) || '')
                    }
                    onChange={(e) => handleEditChange('delivery_date', e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-eastmeadow-500"
                  />
                ) : (
                  <span className="text-gray-900">
                    {formatDate(job.delivery_date)?.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      timeZone: 'America/New_York'
                    }) || 'Not scheduled'}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Assigned Driver</span>
                {isEditing && (isOffice || isAdmin) ? (
                  <select
                    value={editData.assigned_driver ?? (job.assigned_driver || '')}
                    onChange={(e) => handleEditChange('assigned_driver', e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-eastmeadow-500"
                  >
                    <option value="">Unassigned</option>
                    {drivers.map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.username}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-gray-900">
                    {getDriverName(job.assigned_driver)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Complete Delivery - available to assigned driver, office, or admin */}
          {(
            (user?.role === 'driver' &&
              job.status === 'scheduled' &&
              job.assigned_driver === (user.id ?? user.userId)) ||
            ((isOffice || isAdmin) && job.status !== 'completed')
          ) && (
            <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900">Complete Delivery</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Notes (Optional)
                  </label>
                  <textarea
                    value={driverNotes}
                    onChange={(e) => setDriverNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Any notes about the delivery..."
                  />
                </div>

                {!isFullyPaid && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Collected ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      max={amountDue}
                      value={paymentReceived}
                      onChange={(e) => setPaymentReceived(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder={`Amount due: $${amountDue.toFixed(2)}`}
                    />
                  </div>
                )}

                <button
                  onClick={handleCompleteDelivery}
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      Mark as Completed
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Previous Driver Notes */}
          {job.driver_notes && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-gray-900">Driver Notes</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-gray-900 whitespace-pre-wrap">{job.driver_notes}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions - Office/Admin Only */}
        {(isOffice || isAdmin) && (
          <div className="sticky bottom-0 bg-white border-t p-4 flex gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  disabled={loading}
                  className="flex-1 bg-eastmeadow-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-eastmeadow-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditData({});
                    setEditProducts([]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-1 bg-eastmeadow-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-eastmeadow-700 flex items-center justify-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit Job
                </button>
                {isAdmin && (
                  <button
                    onClick={handleDeleteJob}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Job
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobDetailModal;
