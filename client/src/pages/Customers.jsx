import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Plus, Edit, Trash2, Phone, MapPin, Calendar, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

const Customers = () => {
  const { isOffice, makeAuthenticatedRequest } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    addresses: [{ address: '', notes: '' }],
    notes: '',
    contractor: false
  });

  useEffect(() => {
    if (!isOffice) {
      navigate('/dashboard');
      return;
    }
    fetchCustomers();
  }, [isOffice, navigate]);

  const fetchCustomers = async () => {
    try {
      const response = await makeAuthenticatedRequest('get', '/customers');
      setCustomers(response.data.customers || []);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddressChange = (index, field, value) => {
    const updatedAddresses = [...formData.addresses];
    updatedAddresses[index][field] = value;
    setFormData(prev => ({
      ...prev,
      addresses: updatedAddresses
    }));
  };

  const addAddress = () => {
    setFormData(prev => ({
      ...prev,
      addresses: [...prev.addresses, { address: '', notes: '' }]
    }));
  };

  const removeAddress = (index) => {
    if (formData.addresses.length > 1) {
      const updatedAddresses = formData.addresses.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        addresses: updatedAddresses
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Customer name is required');
      return;
    }

    if (formData.addresses.some(addr => !addr.address.trim())) {
      toast.error('All addresses must be filled in');
      return;
    }

    try {
      const customerData = {
        ...formData,
        addresses: formData.addresses.filter(addr => addr.address.trim())
      };

      if (editingCustomer) {
        await makeAuthenticatedRequest('put', `/customers/${editingCustomer.id}`, customerData);
        toast.success('Customer updated successfully');
      } else {
        await makeAuthenticatedRequest('post', '/customers', customerData);
        toast.success('Customer added successfully');
      }

      resetForm();
      fetchCustomers();
    } catch (error) {
      console.error('Failed to save customer:', error);
      toast.error('Failed to save customer');
    }
  };

  const handleEdit = (customer) => {
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      addresses: customer.addresses && customer.addresses.length > 0 
        ? customer.addresses 
        : [{ address: '', notes: '' }],
      notes: customer.notes || '',
      contractor: customer.contractor || false
    });
    setEditingCustomer(customer);
    setShowAddForm(true);
  };

  const handleDelete = async (customerId) => {
    if (!confirm('Are you sure you want to delete this customer? This will not affect existing deliveries.')) {
      return;
    }

    try {
      await makeAuthenticatedRequest('delete', `/customers/${customerId}`);
      toast.success('Customer deleted successfully');
      fetchCustomers();
    } catch (error) {
      console.error('Failed to delete customer:', error);
      toast.error('Failed to delete customer');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      addresses: [{ address: '', notes: '' }],
      notes: '',
      contractor: false
    });
    setShowAddForm(false);
    setEditingCustomer(null);
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">
          Customer Management
        </h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="p-4">
          <input
            type="text"
            placeholder="Search customers by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="p-6 border-b">
            <h2 className="text-lg font-medium text-gray-900">
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </h2>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="John Smith"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            {/* Contractor Status */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="contractor"
                  name="contractor"
                  checked={formData.contractor}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="contractor" className="ml-3 flex items-center">
                  <Users className="h-5 w-5 text-blue-600 mr-2" />
                  <div>
                    <span className="text-sm font-medium text-blue-900">Contractor Customer</span>
                    <p className="text-xs text-blue-700">
                      Contractors receive special pricing on all products
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Addresses */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  Delivery Addresses *
                </label>
                <button
                  type="button"
                  onClick={addAddress}
                  className="text-nursery-600 hover:text-nursery-700 text-sm font-medium"
                >
                  + Add Address
                </button>
              </div>

              {formData.addresses.map((address, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Address {index + 1}
                    </span>
                    {formData.addresses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAddress(index)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <textarea
                      value={address.address}
                      onChange={(e) => handleAddressChange(index, 'address', e.target.value)}
                      className="input-field"
                      rows="2"
                      placeholder="123 Main Street, Springfield, MA 01103"
                      required
                    />
                    <input
                      type="text"
                      value={address.notes}
                      onChange={(e) => handleAddressChange(index, 'notes', e.target.value)}
                      className="input-field"
                      placeholder="Address notes (gate code, special instructions, etc.)"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Customer Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                className="input-field"
                rows="3"
                placeholder="General notes about this customer..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="btn-primary"
              >
                {editingCustomer ? 'Update Customer' : 'Add Customer'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Customers List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">
            All Customers ({filteredCustomers.length})
          </h2>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">
              {searchTerm ? 'No customers found' : 'No customers yet'}
            </p>
            <p>
              {searchTerm 
                ? 'Try adjusting your search terms'
                : 'Add your first customer to get started'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredCustomers.map((customer) => (
              <div key={customer.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <User className="h-5 w-5 text-gray-400" />
                      <h3 className="text-lg font-medium text-gray-900">
                        {customer.name}
                      </h3>
                      {customer.contractor && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Users className="h-3 w-3 mr-1" />
                          Contractor
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {customer.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-4 w-4" />
                          <span>{customer.phone}</span>
                        </div>
                      )}
                      
                      {customer.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>📧</span>
                          <span>{customer.email}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>Customer since {new Date(customer.created_at).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>📦</span>
                        <span>{customer.total_deliveries || 0} deliveries</span>
                      </div>
                    </div>

                    {/* Contractor Benefits */}
                    {customer.contractor && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                        <p className="text-sm text-blue-800">
                          <strong>Contractor Benefits:</strong> Receives special pricing on all products
                        </p>
                      </div>
                    )}

                    {/* Addresses */}
                    {customer.addresses && customer.addresses.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Delivery Addresses:</h4>
                        <div className="space-y-2">
                          {customer.addresses.map((address, index) => (
                            <div key={index} className="flex items-start gap-2 text-sm text-gray-600">
                              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              <div>
                                <div>{address.address}</div>
                                {address.notes && (
                                  <div className="text-gray-500 italic">{address.notes}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Customer Notes */}
                    {customer.notes && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                        <p className="text-sm text-yellow-800">
                          <strong>Notes:</strong> {customer.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(customer)}
                      className="text-nursery-600 hover:text-nursery-700 p-2"
                      title="Edit customer"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(customer.id)}
                      className="text-red-600 hover:text-red-700 p-2"
                      title="Delete customer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Customers;
