import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { User, Plus, Edit, Trash2, X, Save, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';

const Users = () => {
  const { isAdmin, makeAuthenticatedRequest } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'driver'
  });

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchUsers();
  }, [isAdmin, navigate]);

  const fetchUsers = async () => {
    try {
      const response = await makeAuthenticatedRequest('get', '/users');
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
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

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'driver'
    });
    setShowAddForm(false);
    setShowEditForm(false);
    setEditingUser(null);
    setShowPassword(false);
  };

  const handleAddUser = () => {
    resetForm();
    setShowAddForm(true);
  };

  const handleEditUser = (user) => {
    setFormData({
      username: user.username,
      email: user.email,
      password: '', // Don't pre-fill password for security
      role: user.role
    });
    setEditingUser(user);
    setShowEditForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.email.trim()) {
      toast.error('Username and email are required');
      return;
    }

    if (showAddForm && !formData.password.trim()) {
      toast.error('Password is required for new users');
      return;
    }

    if (formData.password && formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setFormLoading(true);

    try {
      if (showAddForm) {
        // Add new user
        const response = await makeAuthenticatedRequest('post', '/auth/register', {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role
        });
        toast.success('User created successfully');
        fetchUsers(); // Refresh the list
      } else {
        // Edit existing user
        const updateData = {
          username: formData.username,
          email: formData.email,
          role: formData.role
        };

        await makeAuthenticatedRequest('put', `/users/${editingUser.id}`, updateData);
        
        // If password was provided, update it separately
        if (formData.password.trim()) {
          await makeAuthenticatedRequest('put', `/users/${editingUser.id}/password`, {
            new_password: formData.password
          });
        }
        
        toast.success('User updated successfully');
        fetchUsers(); // Refresh the list
      }
      
      resetForm();
    } catch (error) {
      console.error('Failed to save user:', error);
      const message = error.response?.data?.message || 'Failed to save user';
      toast.error(message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
      return;
    }

    try {
      await makeAuthenticatedRequest('delete', `/users/${userId}`);
      setUsers(users.filter(u => u.id !== userId));
      toast.success('User deleted successfully');
    } catch (error) {
      console.error('Failed to delete user:', error);
      const message = error.response?.data?.message || 'Failed to delete user';
      toast.error(message);
    }
  };

  if (!isAdmin) {
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
          East Meadow User Management
        </h1>
        <button 
          onClick={handleAddUser}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {/* Add/Edit User Form */}
      {(showAddForm || showEditForm) && (
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                {showAddForm ? 'Add New User' : `Edit User: ${editingUser?.username}`}
              </h2>
              <button
                onClick={resetForm}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="Enter username"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="input-field"
                  placeholder="user@eastmeadow.com"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {showAddForm ? 'Password *' : 'New Password (leave blank to keep current)'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="input-field pr-10"
                    placeholder={showAddForm ? "Enter password" : "Enter new password"}
                    required={showAddForm}
                    minLength="6"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
                {formData.password && (
                  <p className="text-xs text-gray-500 mt-1">
                    Password must be at least 6 characters
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="input-field"
                  required
                >
                  <option value="driver">Driver</option>
                  <option value="office">Office</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={formLoading}
                className="btn-primary flex items-center gap-2"
              >
                {formLoading ? (
                  <>
                    <LoadingSpinner size="small" />
                    {showAddForm ? 'Creating...' : 'Updating...'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {showAddForm ? 'Create User' : 'Update User'}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary"
                disabled={formLoading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">All Users ({users.length})</h2>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">No users found</p>
            <p>Add users to manage East Meadow Nursery operations</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-eastmeadow-600 flex items-center justify-center">
                          <User className="h-4 w-4 text-white" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {user.username}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800'
                          : user.role === 'office'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-eastmeadow-100 text-eastmeadow-800'
                      }`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEditUser(user)}
                          className="text-eastmeadow-600 hover:text-eastmeadow-700"
                          title="Edit user"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          title="Delete user"
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
        )}
      </div>

      {/* East Meadow Info */}
      <div className="mt-6 bg-eastmeadow-50 border border-eastmeadow-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-eastmeadow-900 mb-2">User Role Permissions</h3>
        <div className="text-sm text-eastmeadow-700 space-y-1">
          <div><strong>Admin:</strong> Full system access, user management</div>
          <div><strong>Office:</strong> Create/manage deliveries, customers, products</div>
          <div><strong>Driver:</strong> View assigned deliveries, update status</div>
        </div>
      </div>
    </div>
  );
};

export default Users;
