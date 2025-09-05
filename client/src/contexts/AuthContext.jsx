import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

// Use the correct API URL
const API_URL = 'https://nursery-scheduler-api.onrender.com';
console.log('Using API_URL:', API_URL);

axios.defaults.baseURL = `${API_URL}/api`;
console.log('Final API baseURL:', axios.defaults.baseURL);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is authenticated on app load
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      console.log('Checking auth with token:', token.substring(0, 20) + '...');
      const response = await axios.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('Auth check response:', response.data);
      
      const userData = response.data.user || response.data;
      setUser(userData);
    } catch (error) {
      console.error('Auth check failed:', error.response?.data || error.message);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      console.log('Attempting login for:', email);
      console.log('Login URL will be:', `${axios.defaults.baseURL}/auth/login`);
      
      const response = await axios.post('/auth/login', {
        email,
        password
      });

      console.log('FULL Login response:', response);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      console.log('Response status:', response.status);
      
      const { token, user: userData } = response.data;
      
      if (!token) {
        throw new Error(`No token in response: ${JSON.stringify(response.data)}`);
      }
      
      localStorage.setItem('token', token);
      setUser(userData);
      
      const username = userData?.username || userData?.email || 'User';
      toast.success(`Welcome back to East Meadow, ${username}!`);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      
      let message = 'Login failed';
      if (error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error.message) {
        message = error.message;
      }
      
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post('/auth/register', userData);
      const { token, user: newUser } = response.data;
      
      localStorage.setItem('token', token);
      setUser(newUser);
      
      const username = newUser?.username || newUser?.email || 'User';
      toast.success(`Welcome to East Meadow Nursery, ${username}!`);
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    toast.success('Logged out successfully');
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  const makeAuthenticatedRequest = async (method, url, data = null) => {
    const token = localStorage.getItem('token');
    if (!token) {
      logout();
      throw new Error('No authentication token');
    }

    try {
      const config = {
        method,
        url,
        headers: {
          Authorization: `Bearer ${token}`
        }
      };

      if (data) {
        config.data = data;
      }

      return await axios(config);
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
        toast.error('Session expired. Please log in again.');
      }
      throw error;
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    makeAuthenticatedRequest,
    isAuthenticated: !!user,
    isOffice: user?.role === 'office' || user?.role === 'admin',
    isDriver: user?.role === 'driver',
    isAdmin: user?.role === 'admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
