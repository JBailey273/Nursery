import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Calendar, 
  Plus, 
  Search, 
  Filter,
  MapPin,
  Package,
  Phone,
  CheckCircle,
  Clock,
  DollarSign
} from 'lucide-react';
import axios from 'axios';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const Jobs = () => {
  const { isOffice, user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    filterJobs();
  }, [jobs, selectedDate, searchTerm, statusFilter]);

  const fetchJobs = async () => {
    try {
      const response = await axios.get('/jobs');
      setJobs(response.data.jobs || []);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const filterJobs = () => {
    let filtered = jobs;

    // Filter by date
    if (selectedDate) {
      filtered = filtered.filter(job => job.delivery_date === selectedDate);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(job =>
        job.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(job => job.status === statusFilter);
    }

    setFilteredJobs(filtered);
  };

  const updateJobStatus = async (jobId, status, driverNotes = '', paymentReceived = 0) => {
    try {
      const updateData = { status };
      if (driverNotes) updateData.driver_notes = driverNotes;
      if (paymentReceived > 0) updateData.payment_received = parseFloat(paymentReceived);

      await axios.put(`/jobs/${jobId}`, updateData);
      
      // Update local state
      setJobs(jobs.map(job =>
        job.id === jobId
          ? { ...job, status, driver_notes: driverNotes, payment_received: paymentReceived }
          : job
      ));
      
      toast.success('Job updated successfully');
    } catch (error) {
      console.error('Failed to update job:', error);
      toast.error('Failed to update job');
    }
  };

  const generateCalendarDays = () => {
    const today = new Date();
    const days = [];
    
    for (let i = -3; i <= 10; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayJobs = jobs.filter(job => job.delivery_date === dateStr);
      
      days.push({
        date: dateStr,
        displayDate: date.getDate(),
        displayDay: date.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: dateStr === new Date().toISOString().split('T')[0],
        jobCount: dayJobs.length,
        completedCount: dayJobs.filter(job => job.status === 'completed').length
      });
    }
    
    return days;
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">
          Delivery Schedule
        </h1>
        {isOffice && (
          <Link
            to="/jobs/add"
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Delivery
          </Link>
        )}
      </div>

      {/* Calendar Days */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="p-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">Select Date</h2>
        </div>
        <div className="p-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {generateCalendarDays().map((day) => (
              <button
                key={day.date}
                onClick={() => setSelectedDate(day.date)}
                className={`flex-shrink-0 min-w-[80px] p-3 rounded-lg border text-center transition-colors ${
                  selectedDate === day.date
                    ? 'bg-nursery-50 border-nursery-200 text-nursery-900'
                    : day.isToday
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="text-xs text-gray-600 mb-1">{day.displayDay}</div>
                <div className="font-medium">{day.displayDate}</div>
                {day.jobCount > 0 && (
                  <div className="text-xs mt-1">
                    <span className="text-green-600">{day.completedCount}</span>
                    <span className="text-gray-400">/{day.jobCount}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers or addresses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nursery-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="sm:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nursery-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h3 className="font-medium text-gray-900">
            Deliveries for {new Date(selectedDate).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h3>
        </div>
        
        {filteredJobs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">No deliveries found</p>
            <p>Try adjusting your filters or selecting a different date</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onUpdateStatus={updateJobStatus}
                isDriver={user?.role === 'driver'}
                isOffice={isOffice}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const JobCard = ({ job, onUpdateStatus, isDriver, isOffice }) => {
  const [showActions, setShowActions] = useState(false);
  const [driverNotes, setDriverNotes] = useState('');
  const [paymentReceived, setPaymentReceived] = useState('');

  const handleCompleteJob = () => {
    onUpdateStatus(job.id, 'completed', driverNotes, paymentReceived);
    setShowActions(false);
    setDriverNotes('');
    setPaymentReceived('');
  };

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-semibold text-gray-900">{job.customer_name}</h4>
            <span className={`status-${job.status}`}>
              {job.status.replace('_', ' ')}
            </span>
            {!job.paid && (
              <span className="payment-unpaid">
                Not Paid
              </span>
            )}
          </div>
          
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>{job.address}</span>
            </div>
            
            {job.customer_phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <span>{job.customer_phone}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span>
                {job.products?.map((product, index) => (
                  <span key={index}>
                    {product.quantity} {product.unit} {product.product_name}
                    {index < job.products.length - 1 ? ', ' : ''}
                  </span>
                )) || 'No products listed'}
              </span>
            </div>

            {job.special_instructions && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                <p className="text-yellow-800 text-sm">
                  <strong>Special Instructions:</strong> {job.special_instructions}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {job.status === 'completed' ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <Clock className="h-5 w-5 text-yellow-600" />
          )}
          
          {isDriver && job.status === 'scheduled' && (
            <button
              onClick={() => setShowActions(!showActions)}
              className="btn-primary text-sm"
            >
              Mark Complete
            </button>
          )}
        </div>
      </div>

      {/* Driver Actions */}
      {showActions && (
        <div className="border-t pt-4 space-y-3">
          <textarea
            placeholder="Add delivery notes..."
            value={driverNotes}
            onChange={(e) => setDriverNotes(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nursery-500 focus:border-transparent"
            rows="3"
          />
          
          {!job.paid && (
            <input
              type="number"
              placeholder="Payment received ($)"
              value={paymentReceived}
              onChange={(e) => setPaymentReceived(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nursery-500 focus:border-transparent"
            />
          )}
          
          <div className="flex gap-2">
            <button
              onClick={handleCompleteJob}
              className="btn-primary flex-1"
            >
              Complete Delivery
            </button>
            <button
              onClick={() => setShowActions(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Completed Job Info */}
      {job.status === 'completed' && (job.driver_notes || job.payment_received > 0) && (
        <div className="border-t pt-4 space-y-2 text-sm">
          {job.driver_notes && (
            <div>
              <strong className="text-gray-900">Driver Notes:</strong>
              <p className="text-gray-600">{job.driver_notes}</p>
            </div>
          )}
          
          {job.payment_received > 0 && (
            <div className="flex items-center gap-2 text-green-700">
              <DollarSign className="h-4 w-4" />
              <span><strong>Payment Collected:</strong> ${job.payment_received}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Jobs;