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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
       <h1 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">
         Product Management
       </h1>
       <button
         onClick={() => setShowAddForm(true)}
         className="btn-primary flex items-center gap-2"
       >
         <Plus className="h-4 w-4" />
         Add Product
       </button>
     </div>

     {/* Add/Edit Form */}
     {showAddForm && (
       <div className="bg-white rounded-lg shadow-sm border mb-6">
         <div className="p-6 border-b">
           <h2 className="text-lg font-medium text-gray-900">
             {editingProduct ? 'Edit Product' : 'Add New Product'}
           </h2>
         </div>
         
         <form onSubmit={handleSubmit} className="p-6">
           <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 Product Name *
               </label>
               <input
                 type="text"
                 name="name"
                 value={formData.name}
                 onChange={handleInputChange}
                 className="input-field"
                 placeholder="e.g., Premium Mulch"
                 required
               />
             </div>

             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 Unit
               </label>
               <select
                 name="unit"
                 value={formData.unit}
                 onChange={handleInputChange}
                 className="input-field"
               >
                 {unitOptions.map(unit => (
                   <option key={unit} value={unit}>{unit}</option>
                 ))}
               </select>
             </div>

             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 <div className="flex items-center gap-1">
                   <User className="h-4 w-4" />
                   Retail Price ($)
                 </div>
               </label>
               <input
                 type="number"
                 step="0.01"
                 min="0"
                 name="retail_price"
                 value={formData.retail_price}
                 onChange={handleRetailPriceChange}
                 className="input-field"
                 placeholder="0.00"
               />
             </div>

             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 <div className="flex items-center gap-1">
                   <Users className="h-4 w-4" />
                   Contractor Price ($)
                 </div>
               </label>
               <input
                 type="number"
                 step="0.01"
                 min="0"
                 name="contractor_price"
                 value={formData.contractor_price}
                 onChange={handleInputChange}
                 className="input-field"
                 placeholder="0.00"
               />
               {formData.retail_price && formData.contractor_price && (
                 <p className="text-xs text-green-600 mt-1">
                   {(((parseFloat(formData.retail_price) - parseFloat(formData.contractor_price)) / parseFloat(formData.retail_price)) * 100).toFixed(1)}% discount
                 </p>
               )}
             </div>

             <div className="flex items-end">
               <label className="flex items-center">
                 <input
                   type="checkbox"
                   name="active"
                   checked={formData.active}
                   onChange={handleInputChange}
                   className="h-4 w-4 text-nursery-600 focus:ring-nursery-500 border-gray-300 rounded"
                 />
                 <span className="ml-2 text-sm text-gray-700">Active</span>
               </label>
             </div>
           </div>

           <div className="flex gap-3 mt-6">
             <button
               type="submit"
               className="btn-primary"
             >
               {editingProduct ? 'Update Product' : 'Add Product'}
             </button>
             <button
               type="button"
               onClick={cancelForm}
               className="btn-secondary"
             >
               Cancel
             </button>
           </div>
         </form>
       </div>
     )}

     {/* Products List */}
     <div className="bg-white rounded-lg shadow-sm border">
       <div className="p-4 border-b">
         <h2 className="text-lg font-medium text-gray-900">All Products</h2>
       </div>

       {products.length === 0 ? (
         <div className="text-center py-12 text-gray-500">
           <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
           <p className="text-lg font-medium mb-2">No products found</p>
           <p>Add your first product to get started</p>
         </div>
       ) : (
         <>
           <div className="md:hidden divide-y">
             {products.map((product) => (
               <div key={product.id} className="p-4">
                 <div className="flex justify-between">
                   <div className="flex items-center">
                     <Package className="h-5 w-5 text-gray-400 mr-3" />
                     <span className="text-sm font-medium text-gray-900">
                       {product.name}
                     </span>
                   </div>
                   <div className="flex items-center gap-2">
                     <button
                       onClick={() => handleEdit(product)}
                       className="text-nursery-600 hover:text-nursery-700"
                     >
                       <Edit className="h-4 w-4" />
                     </button>
                     <button
                       onClick={() => handleDelete(product.id)}
                       className="text-red-600 hover:text-red-700"
                     >
                       <Trash2 className="h-4 w-4" />
                     </button>
                   </div>
                 </div>
                 <div className="mt-2 text-sm text-gray-600 space-y-1">
                   <div>
                     <span className="font-medium">Unit:</span> {product.unit}
                   </div>
                   <div className="flex items-center gap-1">
                     <User className="h-4 w-4 text-gray-400" />
                     {product.retail_price ? (
                       <span>{parseFloat(product.retail_price).toFixed(2)}</span>
                     ) : (
                       <span className="text-gray-400">No price</span>
                     )}
                   </div>
                   <div className="flex items-center gap-1">
                     <Users className="h-4 w-4 text-gray-400" />
                     {product.contractor_price ? (
                       <>
                         <span>{parseFloat(product.contractor_price).toFixed(2)}</span>
                         {product.retail_price && (
                           <span className="ml-1 text-xs text-green-600">
                             ({(((parseFloat(product.retail_price) - parseFloat(product.contractor_price)) / parseFloat(product.retail_price)) * 100).toFixed(0)}% off)
                           </span>
                         )}
                       </>
                     ) : (
                       <span className="text-gray-400">No price</span>
                     )}
                   </div>
                   <div>
                     <span
                       className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                         product.active
                           ? 'bg-green-100 text-green-800'
                           : 'bg-gray-100 text-gray-800'
                       }`}
                     >
                       {product.active ? 'Active' : 'Inactive'}
                     </span>
                   </div>
                 </div>
               </div>
             ))}
           </div>

           <div className="hidden md:block overflow-x-auto">
             <table className="w-full">
               <thead className="bg-gray-50">
                 <tr>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Product
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Unit
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     <div className="flex items-center gap-1">
                       <User className="h-4 w-4" />
                       Retail Price
                     </div>
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     <div className="flex items-center gap-1">
                       <Users className="h-4 w-4" />
                       Contractor Price
                     </div>
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Status
                   </th>
                   <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Actions
                   </th>
                 </tr>
               </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                 {products.map((product) => (
                   <tr key={product.id} className="hover:bg-gray-50">
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex items-center">
                         <Package className="h-5 w-5 text-gray-400 mr-3" />
                         <span className="text-sm font-medium text-gray-900">
                           {product.name}
                         </span>
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                       {product.unit}
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                       {product.retail_price ? (
                         <div className="flex items-center">
                           <DollarSign className="h-4 w-4 text-gray-400" />
                           {parseFloat(product.retail_price).toFixed(2)}
                         </div>
                       ) : (
                         <span className="text-gray-400">No price</span>
                       )}
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                       {product.contractor_price ? (
                         <div className="flex items-center">
                           <DollarSign className="h-4 w-4 text-gray-400" />
                           {parseFloat(product.contractor_price).toFixed(2)}
                           {product.retail_price && (
                             <span className="ml-2 text-xs text-green-600">
                               ({(((parseFloat(product.retail_price) - parseFloat(product.contractor_price)) / parseFloat(product.retail_price)) * 100).toFixed(0)}% off)
                             </span>
                           )}
                         </div>
                       ) : (
                         <span className="text-gray-400">No price</span>
                       )}
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                         product.active
                           ? 'bg-green-100 text-green-800'
                           : 'bg-gray-100 text-gray-800'
                       }`}>
                         {product.active ? 'Active' : 'Inactive'}
                       </span>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                       <div className="flex items-center justify-end gap-2">
                         <button
                           onClick={() => handleEdit(product)}
                           className="text-nursery-600 hover:text-nursery-700"
                         >
                           <Edit className="h-4 w-4" />
                         </button>
                         <button
                           onClick={() => handleDelete(product.id)}
                           className="text-red-600 hover:text-red-700"
                         >
                           <Trash2 className="h-4 w-4" />
                         </button>
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         </>
       )}
     </div>
   </div>
 );
};

export default Products;
