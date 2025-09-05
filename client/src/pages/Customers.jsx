import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Plus, Edit, Trash2, Phone, MapPin, Calendar } from 'lucide-react';
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
    notes: ''
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
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
      notes: customer.notes || ''
    });
    setEditingCustomer(customer);
    setShowAddForm(true);
  };

  const handleDelete
