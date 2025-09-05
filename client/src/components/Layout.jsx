import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Truck, 
  Calendar, 
  Users, 
  Plus, 
  Menu, 
  X, 
  LogOut, 
  User,
  Home,
  Package,
  UserCheck
} from 'lucide-react';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, isOffice, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, show: true },
    { name: 'Schedule', href: '/jobs', icon: Calendar, show: true },
    { name: 'Add Delivery', href: '/jobs/add', icon: Plus, show: isOffice },
    { name: 'Customers', href: '/customers', icon: UserCheck, show: isOffice },
    { name: 'Products', href: '/products', icon: Package, show: isOffice },
    { name: 'Users', href: '/users', icon: Users, show: isAdmin },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Mobile sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:hidden ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <div className="flex items-center">
            <Truck className="h-8 w-8 text-eastmeadow-600" />
            <div className="ml-2">
              <div className="text-lg font-semibold text-gray-900">East Meadow</div>
              <div className="text-xs text-eastmeadow-600 font-medium">Delivery Scheduler</div>
            </div>
          </div>
          <button
            onClick={closeSidebar}
            className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <SidebarContent 
          navigation={navigation} 
          location={location} 
          user={user}
          onLogout={handleLogout}
          onNavigate={closeSidebar}
        />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex items-center h-16 px-4 border-b border-gray-200">
            <Truck className="h-8 w-8 text-eastmeadow-600" />
            <div className="ml-2">
              <div className="text-lg font-semibold text-gray-900">East Meadow</div>
              <div className="text-xs text-eastmeadow-600 font-medium">Delivery Scheduler</div>
            </div>
          </div>
          <SidebarContent 
            navigation={navigation} 
            location={location} 
            user={user}
            onLogout={handleLogout}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 lg:hidden">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center">
              <Truck className="h-6 w-6 text-eastmeadow-600" />
              <div className="ml-2">
                <span className="font-semibold text-gray-900">East Meadow</span>
                <span className="text-xs text-eastmeadow-600 ml-1">Delivery</span>
              </div>
            </div>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};

const SidebarContent = ({ navigation, location, user, onLogout, onNavigate }) => {
  return (
    <div className="flex flex-col flex-grow">
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navigation.filter(item => item.show).map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={onNavigate}
              className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
                isActive
                  ? 'bg-eastmeadow-100 text-eastmeadow-900 border-r-2 border-eastmeadow-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon
                className={`mr-3 flex-shrink-0 h-5 w-5 ${
                  isActive ? 'text-eastmeadow-600' : 'text-gray-400 group-hover:text-gray-500'
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User menu */}
      <div className="flex-shrink-0 border-t border-gray-200 p-4">
        <div className="flex items-center mb-3">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-eastmeadow-600 flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.username}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {user?.role}
            </p>
          </div>
        </div>
        
        <div className="space-y-1">
          <Link
            to="/profile"
            onClick={onNavigate}
            className="group flex items-center px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
          >
            <User className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
            Profile
          </Link>
          
          <button
            onClick={onLogout}
            className="group flex items-center w-full px-2 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
          >
            <LogOut className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default Layout;
