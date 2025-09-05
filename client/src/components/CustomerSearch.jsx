import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User, Plus, MapPin } from 'lucide-react';

const CustomerSearch = ({ onCustomerSelect, selectedCustomer, onAddressSelect, selectedAddress }) => {
  const { makeAuthenticatedRequest } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchCustomers();
    } else {
      setCustomers([]);
      setShowDropdown(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (selectedCustomer) {
      setSearchTerm(selectedCustomer.name);
      setShowDropdown(false);
    }
  }, [selectedCustomer]);

  const searchCustomers = async () => {
    setLoading(true);
    try {
      const response = await makeAuthenticatedRequest('get', `/customers/search?q=${encodeURIComponent(searchTerm)}`);
      setCustomers(response.data.customers || []);
      setShowDropdown(true);
    } catch (error) {
      console.error('Failed to search customers:', error);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSelect = (customer) => {
    onCustomerSelect(customer);
    setShowDropdown(false);
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (!value) {
      onCustomerSelect(null);
      onAddressSelect(null);
    }
  };

  const handleClickOutside = (e) => {
    if (searchRef.current && !searchRef.current.contains(e.target)) {
      setShowDropdown(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={searchRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Customer Name *
      </label>
      <input
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => searchTerm.length >= 2 && setShowDropdown(true)}
        className="input-field"
        placeholder="Start typing customer name..."
        required
      />

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-center text-gray-500">Searching...</div>
          ) : customers.length === 0 ? (
            <div className="p-3 text-center text-gray-500">
              No customers found. Customer will be created automatically.
            </div>
          ) : (
            customers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => handleCustomerSelect(customer)}
                className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    {customer.phone && (
                      <div className="text-sm text-gray-600">{customer.phone}</div>
                    )}
                    <div className="text-xs text-gray-500">
                      {customer.total_deliveries || 0} deliveries
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Address Selection */}
      {selectedCustomer && selectedCustomer.addresses && selectedCustomer.addresses.length > 0 && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Address or Enter New One
          </label>
          <div className="space-y-2">
            {selectedCustomer.addresses.map((address, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onAddressSelect(address)}
                className={`w-full p-3 text-left rounded-lg border transition-colors ${
                  selectedAddress === address
                    ? 'border-nursery-500 bg-nursery-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                  <div>
                    <div className="text-sm text-gray-900">{address.address}</div>
                    {address.notes && (
                      <div className="text-xs text-gray-500 mt-1">{address.notes}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => onAddressSelect(null)}
              className="w-full p-3 text-left rounded-lg border border-dashed border-gray-300 hover:bg-gray-50 text-gray-600"
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>Use different address</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSearch;
