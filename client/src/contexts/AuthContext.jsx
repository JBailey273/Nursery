import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const AuthContext = createContext();

// Configure axios defaults
const API_URL = import.meta.env.VITE_API_URL || '';
console.log('VITE_API_URL from env:', API_URL);

// Set the base URL - handle both with and without trailing slash
let baseURL;
if (API_URL) {
  baseURL = API_URL.endsWith('/') ? `${API_URL}api` : `${API_URL}/api`;
} else {
  baseURL = '/api';
}

console.log('Final API baseURL:', baseURL);
axios.defaults.baseURL = baseURL;

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
      
      // Handle different response structures
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
      console.log('Login URL:', `${baseURL}/auth/login`);
      
      const response = await axios.post('/auth/login', {
        email,
        password
      });

      console.log('Login response:', response.data);
      
      // Handle different response structures
      const token = response.data.token;
      const userData = response.data.user || response.data;
      
      if (!token) {
        throw new Error('No token received from server');
      }
      
      localStorage.setItem('token', token);
      setUser(userData);
      
      // Safe access to username
      const username = userData?.username || userData?.email || 'User';
      toast.success(`Welcome back, ${username}!`);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      console.error('Full error:', error);
      
      let message = 'Login failed';
      if (error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error.message) {
        message = error.message;
      } else if (error.code === 'ERR_NETWORK') {
        message = 'Cannot connect to server. Please check if the API is running.';
      }
      
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post('/auth/register', userData);
      
      console.log('Register response:', response.data);
      
      const token = response.data.token;
      const newUser = response.data.user || response.data;
      
      localStorage.setItem('token', token);
      setUser(newUser);
      
      const username = newUser?.username || newUser?.email || 'User';
      toast.success(`Account created successfully! Welcome, ${username}!`);
      return { success: true };
    } catch (error) {
      console.error('Register error:', error.response?.data || error.message);
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

  // Helper function to make authenticated requests
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
