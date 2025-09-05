import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Package, Users, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const Dashboard = () => {
  const { user, isOffice, makeAuthenticatedRequest } = useAuth();
  const [stats, setStats] = useState({
    todayJobs: 0,
    totalJobs: 0,
    completedJobs: 0,
    pendingPayments: 0
  });
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Use makeAuthenticatedRequest instead of regular axios
      const [jobsResponse, todayJobsResponse] = await Promise.all([
        makeAuthenticatedRequest('get', '/jobs'),
        makeAuthenticatedRequest('get', `/jobs?date=${today}`)
      ]);

      const allJobs = jobsResponse.data.jobs || [];
      const todayJobs = todayJobsResponse.data.jobs || [];

      setStats({
        todayJobs: todayJobs.length,
        totalJobs: allJobs.length,
        completedJobs: allJobs.filter(job => job.status === 'completed').length,
        pendingPayments: allJobs.filter(job => {
          const total = job.total_amount || 0;
          const received = job.payment_received || 0;
          return job.status === 'completed' && total > 0 && received < total;
        }).length
      });

      // Get recent jobs (last 5)
      setRecentJobs(allJobs.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // Set default stats if fetch fails
      setStats({
        todayJobs: 0,
        totalJobs: 0,
        completedJobs: 0,
        pendingPayments: 0
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back to East Meadow, {user?.username}!
        </h1>
        <p className="text-gray-600">
          Here's what's happening with your deliveries today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Today's Deliveries"
          value={stats.todayJobs}
          icon={Calendar}
          color="blue"
        />
        <StatCard
          title="Total Jobs"
          value={stats.totalJobs}
          icon={Package}
          color="green"
        />
        <StatCard
          title="Completed"
          value={stats.completedJobs}
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          title="Pending Payments"
          value={stats.pendingPayments}
          icon={TrendingUp}
          color="orange"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            {isOffice && (
              <Link
                to="/jobs/add"
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <Package className="h-5 w-5 text-eastmeadow-600 mr-3" />
                <span className="font-medium text-gray-900">Add New Delivery</span>
              </Link>
            )}
            <Link
              to="/jobs"
              className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Calendar className="h-5 w-5 text-eastmeadow-600 mr-3" />
              <span className="font-medium text-gray-900">View Schedule</span>
            </Link>
            {isOffice && (
              <>
                <Link
                  to="/customers"
                  className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <Users className="h-5 w-5 text-eastmeadow-600 mr-3" />
                  <span className="font-medium text-gray-900">Manage Customers</span>
                </Link>
                <Link
                  to="/products"
                  className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <Package className="h-5 w-5 text-eastmeadow-600 mr-3" />
                  <span className="font-medium text-gray-900">Manage Products</span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Jobs</h2>
          {recentJobs.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No recent jobs</p>
              {isOffice && (
                <Link
                  to="/jobs/add"
                  className="inline-block mt-2 text-eastmeadow-600 hover:text-eastmeadow-700 font-medium"
                >
                  Create your first delivery
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{job.customer_name}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(job.delivery_date).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`status-${job.status}`}>
                      {job.status.replace('_', ' ')}
                    </span>
                    {job.status === 'scheduled' && (
                      <Clock className="h-4 w-4 text-yellow-600" />
                    )}
                    {job.status === 'completed' && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t">
                <Link
                  to="/jobs"
                  className="text-sm text-eastmeadow-600 hover:text-eastmeadow-700 font-medium"
                >
                  View all deliveries →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* East Meadow Nursery Info */}
      <div className="mt-8 bg-gradient-to-r from-eastmeadow-50 to-green-50 border border-eastmeadow-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-center sm:text-left">
            <h3 className="text-lg font-semibold text-eastmeadow-900">East Meadow Nursery</h3>
            <p className="text-eastmeadow-700">Professional Landscape Supply & Delivery</p>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-2xl font-bold text-eastmeadow-900 whitespace-nowrap">413-566-TREE</div>
            <div className="text-sm text-eastmeadow-600">Western Massachusetts</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-eastmeadow-50 text-eastmeadow-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    orange: 'bg-orange-50 text-orange-600'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
