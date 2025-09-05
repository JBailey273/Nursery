import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, Package, Users, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';

const Dashboard = () => {
  const { user, isOffice } = useAuth();
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
      const [jobsResponse, todayJobsResponse] = await Promise.all([
        axios.get('/jobs'),
        axios.get(`/jobs?date=${today}`)
      ]);

      const allJobs = jobsResponse.data.jobs || [];
      const todayJobs = todayJobsResponse.data.jobs || [];

      setStats({
        todayJobs: todayJobs.length,
        totalJobs: allJobs.length,
        completedJobs: allJobs.filter(job => job.status === 'completed').length,
        pendingPayments: allJobs.filter(job => !job.paid && job.status === 'completed').length
      });

      // Get recent jobs (last 5)
      setRecentJobs(allJobs.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
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
          Welcome back, {user?.username}!
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
                <Package className="h-5 w-5 text-nursery-600 mr-3" />
                <span className="font-medium text-gray-900">Add New Delivery</span>
              </Link>
            )}
            <Link
              to="/jobs"
              className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Calendar className="h-5 w-5 text-nursery-600 mr-3" />
              <span className="font-medium text-gray-900">View Schedule</span>
            </Link>
            {isOffice && (
              <Link
                to="/users"
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <Users className="h-5 w-5 text-nursery-600 mr-3" />
                <span className="font-medium text-gray-900">Manage Users</span>
              </Link>
            )}
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Jobs</h2>
          {recentJobs.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No recent jobs</p>
          ) : (
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{job.customer_name}</p>
                    <p className="text-sm text-gray-600">{job.delivery_date}</p>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
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