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
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

const Jobs = () => {
  const { isOffice, user, makeAuthenticatedRequest } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Helper function to normalize dates for comparison
  const normalizeDateForComparison = (dateString) => {
    if (!dateString) return null;
    
    // If it's already in YYYY-MM-DD format, return as-is
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateString;
    }
    
    // If it's a full ISO string or Date object, extract just the date part
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error normalizing date:', dateString, error);
      return null;
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    filterJobs();
  }, [jobs, selectedDate, searchTerm, statusFilter]);

  const fetchJobs = async () => {
    try {
      console.log('=== FETCHING JOBS ===');
      const response = await makeAuthenticatedRequest('get', '/jobs');
      const jobsData = response.data.jobs || [];
      
      console.log(`✅ Fetched ${jobsData.length} jobs from API`);
      console.log('Jobs data sample:', jobsData.slice(0, 3));
      
      // Debug: Log all unique delivery dates and their normalized versions
      const uniqueDates = [...new Set(jobsData.map(job => job.delivery_date))];
      console.log('📅 Raw delivery dates from database:', uniqueDates);
      
      const normalizedDates = [...new Set(jobsData.map(job => normalizeDateForComparison(job.delivery_date)))];
      console.log('📅 Normalized delivery dates:', normalizedDates);
      
      setJobs(jobsData);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const filterJobs = () => {
    console.log('=== FILTERING JOBS ===');
    console.log('Selected date:', selectedDate);
    console.log('Search term:', searchTerm);
    console.log('Status filter:', statusFilter);
    console.log('Total jobs to filter:', jobs.length);
    
    let filtered = jobs;

    // Filter by date with normalized comparison
    if (selectedDate) {
      console.log('🔍 Filtering by date:', selectedDate);
      
      const beforeFilter = filtered.length;
      filtered = filtered.filter(job => {
        const normalizedJobDate = normalizeDateForComparison(job.delivery_date);
        const normalizedSelectedDate = normalizeDateForComparison(selectedDate);
        
        console.log(`Comparing job ${job.id}: normalized="${normalizedJobDate}" vs selected="${normalizedSelectedDate}"`);
        
        return normalizedJobDate === normalizedSelectedDate;
      });
      
      console.log(`📅 Date filter: ${beforeFilter} → ${filtered.length} jobs`);
    }

    // Filter by search term
    if (searchTerm) {
      console.log('🔍 Filtering by search term:', searchTerm);
      const beforeFilter = filtered.length;
      filtered = filtered.filter(job =>
        job.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
      console.log(`🔍 Search filter: ${beforeFilter} → ${filtered.length} jobs`);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      console.log('🔍 Filtering by status:', statusFilter);
      const beforeFilter = filtered.length;
      filtered = filtered.filter(job => job.status === statusFilter);
      console.log(`📊 Status filter: ${beforeFilter} → ${filtered.length} jobs`);
    }

    console.log(`✅ Final filtered jobs: ${filtered.length}`);
    console.log('Filtered jobs:', filtered.map(job => ({
      id: job.id,
      customer: job.customer_name,
      date: job.delivery_date,
      normalized: normalizeDateForComparison(job.delivery_date),
      status: job.status
    })));

    setFilteredJobs(filtered);
  };

  const updateJobStatus = async (jobId, status, driverNotes = '', paymentReceived = 0) => {
    try {
      const updateData = { status };
      if (driverNotes) updateData.driver_notes = driverNotes;
      if (paymentReceived > 0) updateData.payment_received = parseFloat(paymentReceived);

      await makeAuthenticatedRequest('put', `/jobs/${jobId}`, updateData);
      
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
      
      // Use normalized date comparison for calendar day job counts
      const dayJobs = jobs.filter(job => {
        const normalizedJobDate = normalizeDateForComparison(job.delivery_date);
        return normalizedJobDate === dateStr;
      });
      
      days.push({
        date: dateStr,
        displayDate: date.getDate(),
        displayDay: date.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: dateStr === new Date().toISOString().split('T')[0],
        jobCount: dayJobs.length,
        completedCount: dayJobs.filter(job => job.status === 'completed').length
      });
    }
    
    console.log('📅 Generated calendar days with job counts:', days.map(d => ({
      date: d.date,
      jobCount: d.jobCount,
      isToday: d.isToday
    })));
    
    return days;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Calculate jobs for selected date using normalized comparison
  const jobsForSelectedDate = jobs.filter(job => {
    const normalizedJobDate = normalizeDateForComparison(job.delivery_date);
    const normalizedSelectedDate = normalizeDateForComparison(selectedDate);
    return normalizedJobDate === normalizedSelectedDate;
  }).length;

  return (
    <div className="p-6">
      {/* DEBUG INFO PANEL - Enhanced */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-green-800 mb-2">✅ Debug Information (Fixed)</h3>
        <div className="text-sm text-green-700 space-y-1">
          <div><strong>Total Jobs:</strong> {jobs.length}</div>
          <div><strong>Selected Date:</strong> {selectedDate}</div>
          <div><strong>Filtered Jobs:</strong> {filteredJobs.length}</div>
          <div><strong>Today's Date:</strong> {new Date().toISOString().split('T')[0]}</div>
          <div><strong>Jobs for Selected Date (Fixed):</strong> {jobsForSelectedDate}</div>
          {jobs.length > 0 && (
            <>
              <div><strong>Sample Raw Job Dates:</strong> {jobs.slice(0, 3).map(job => job.delivery_date).join(', ')}</div>
              <div><strong>Sample Normalized Dates:</strong> {jobs.slice(0, 3).map(job => normalizeDateForComparison(job.delivery_date)).join(', ')}</div>
            </>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">
          East Meadow Delivery Schedule
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
                onClick={() => {
                  console.log('📅 Date selected:', day.date);
                  setSelectedDate(day.date);
                }}
                className={`flex-shrink-0 min-w-[80px] p-3 rounded-lg border text-center transition-colors ${
                  selectedDate === day.date
                    ? 'bg-eastmeadow-50 border-eastmeadow-200 text-eastmeadow-900'
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
                {day.jobCount === 0 && (
                  <div className="text-xs mt-1 text-gray-400">0</div>
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-eastmeadow-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="sm:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-eastmeadow-500 focus:border-transparent"
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
            Deliveries for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h3>
          <div className="text-sm text-gray-500 mt-1">
            Showing {filteredJobs.length} of {jobs.length} total jobs
          </div>
        </div>
        
        {filteredJobs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">No deliveries found</p>
            <p>
              {jobs.length === 0 
                ? 'No jobs exist in the system'
                : `No jobs found for ${selectedDate}. Try selecting a different date.`
              }
            </p>
            {isOffice && (
              <Link
                to="/jobs/add"
                className="inline-block mt-4 btn-primary"
              >
                Schedule First Delivery
              </Link>
            )}
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
          
          {isOffice && (
            <Link
              to={`/jobs/${job.id}/edit`}
              className="text-eastmeadow-600 hover:text-eastmeadow-700 text-sm font-medium"
            >
              Edit
            </Link>
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
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-eastmeadow-500 focus:border-transparent"
            rows="3"
          />
          
          {!job.paid && (
            <input
              type="number"
              placeholder="Payment received ($)"
              value={paymentReceived}
              onChange={(e) => setPaymentReceived(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-eastmeadow-500 focus:border-transparent"
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
