import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Edit, Trash2, DollarSign, Users, User } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

const Products = () => {
  const { isOffice, makeAuthenticatedRequest } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    unit: 'yards',
    retail_price: '',
    contractor_price: '',
    active: true
  });

  const unitOptions = ['yards', 'tons', 'bags', 'each'];

  useEffect(() => {
    if (!isOffice) {
      navigate('/dashboard');
      return;
    }
    fetchProducts();
  }, [isOffice, navigate]);

  const fetchProducts = async () => {
    try {
      const response = await makeAuthenticatedRequest('get', '/products');
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('Failed to load products');
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

  const calculateContractorPrice = (retailPrice) => {
    const price = parseFloat(retailPrice);
    if (price > 0) {
      return (price * 0.9).toFixed(2); // 10% discount
    }
    return '';
  };

  const handleRetailPriceChange = (e) => {
    const retailPrice = e.target.value;
    setFormData(prev => ({
      ...prev,
      retail_price: retailPrice,
      contractor_price: calculateContractorPrice(retailPrice)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Product name is required');
      return;
    }

    try {
      const productData = {
        ...formData,
        retail_price: parseFloat(formData.retail_price) || null,
        contractor_price: parseFloat(formData.contractor_price) || null
      };

      if (editingProduct) {
        await makeAuthenticatedRequest('put', `/products/${editingProduct.id}`, productData);
        toast.success('Product updated successfully');
      } else {
        await makeAuthenticatedRequest('post', '/products', productData);
        toast.success('Product added successfully');
      }

      setFormData({ name: '', unit: 'yards', retail_price: '', contractor_price: '', active: true });
      setShowAddForm(false);
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      console.error('Failed to save product:', error);
      toast.error('Failed to save product');
    }
  };

  const handleEdit = (product) => {
    setFormData({
      name: product.name,
      unit: product.unit,
      retail_price: product.retail_price || '',
      contractor_price: product.contractor_price || '',
      active: product.active
    });
    setEditingProduct(product);
    setShowAddForm(true);
  };

  const handleDelete = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      await makeAuthenticatedRequest('delete', `/products/${productId}`);
      toast.success('Product deleted successfully');
      fetchProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast.error('Failed to delete product');
    }
  };

  const cancelForm = () => {
    setFormData({ name: '', unit: 'yards', retail_price: '', contractor_price: '', active: true });
    setShowAddForm(false);
    setEditingProduct(null);
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

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6
