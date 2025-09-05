import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoadingSpinner from './components/LoadingSpinner';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import AddJob from './pages/AddJob';
import EditJob from './pages/EditJob';
import Users from './pages/Users';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Profile from './pages/Profile';
import Layout from './components/Layout';

function App() {
  const { loading, isAuthenticated, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Determine default route based on user role
  const getDefaultRoute = () => {
    if (user?.role === 'driver') {
      return '/jobs'; // Drivers go straight to their schedule
    }
    return '/dashboard'; // Office and admin go to dashboard
  };

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to={getDefaultRoute()} replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/add" element={<AddJob />} />
        <Route path="/jobs/:id/edit" element={<EditJob />} />
        <Route path="/users" element={<Users />} />
        <Route path="/products" element={<Products />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Navigate to={getDefaultRoute()} replace />} />
        <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
