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
  DollarSign,
  Edit3,
  Save,
  X
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
  const [drivers, setDrivers] = useState([]);
  const [showToBeScheduled, setShowToBeScheduled] = useState(false);

  // Helper function to normalize dates for comparison
  const normalizeDateForComparison = (dateString) => {
    if (!dateString) return null;
    
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateString;
    }
    
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
    if (isOffice) {
      fetchDrivers();
    }
  }, [isOffice]);

  useEffect(() => {
    filterJobs();
  }, [jobs, selectedDate, searchTerm, statusFilter, showToBeScheduled]);

  const fetchDrivers = async () => {
    try {
      const response = await makeAuthenticatedRequest('get', '/users/drivers');
      setDrivers(response.data.drivers || []);
    } catch (error) {
      console.error('Failed to fetch drivers:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      console.log('=== FETCHING JOBS ===');
      const response = await makeAuthenticatedRequest('get', '/jobs');
      const jobsData = response.data.jobs || [];
      
      console.log(`✅ Fetched ${jobsData.length} jobs from API`);
      
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
    let filtered = jobs;

    // Show "To Be Scheduled" jobs separately
    if (showToBeScheduled) {
      filtered = filtered.filter(job => 
        job.status === 'to_be_scheduled' || 
        !job.delivery_date || 
        job.delivery_date === null
      );
    } else {
      // Normal date-based filtering (exclude to_be_scheduled)
      filtered = filtered.filter(job => 
        job.status !== 'to_be_scheduled' && 
        job.delivery_date !== null
      );

      // Filter by date
      if (selectedDate) {
        const beforeFilter = filtered.length;
        filtered = filtered.filter(job => {
          const normalizedJobDate = normalizeDateForComparison(job.delivery_date);
          const normalizedSelectedDate = normalizeDateForComparison(selectedDate);
          return normalizedJobDate === normalizedSelectedDate;
        });
        console.log(`📅 Date filter: ${beforeFilter} → ${filtered.length} jobs`);
      }
    }

    // Filter by search term
    if (searchTerm) {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(job =>
        job.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
      console.log(`🔍 Search filter: ${beforeFilter} → ${filtered.length} jobs`);
    }

    // Filter by status (unless showing to_be_scheduled)
    if (statusFilter !== 'all' && !showToBeScheduled) {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(job => job.status === statusFilter);
      console.log(`📊 Status filter: ${beforeFilter} → ${filtered.length} jobs`);
    }

    console.log(`✅ Final filtered jobs: ${filtered.length}`);
    setFilteredJobs(filtered);
  };

  const updateJobStatus = async (jobId, status, driverNotes = '', paymentReceived = 0) => {
    try {
      const updateData = { status };
      if (driverNotes) updateData.driver_notes = driverNotes;
      if (paymentReceived > 0) updateData.payment_received = parseFloat(paymentReceived);

      await makeAuthenticatedRequest('put', `/jobs/${jobId}`, updateData);
      
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

  const updateJobSchedule = async (jobId, deliveryDate, assignedDriver = null) => {
    try {
      const updateData = {
        delivery_date: deliveryDate,
        assigned_driver: assignedDriver ? parseInt(assignedDriver) : null,
        status: 'scheduled' // Change from to_be_scheduled to scheduled
      };

      await makeAuthenticatedRequest('put', `/jobs/${jobId}`, updateData);
      
      setJobs(jobs.map(job =>
        job.id === jobId
          ? { ...job, ...updateData }
          : job
      ));
      
      toast.success('Delivery scheduled successfully!');
    } catch (error) {
      console.error('Failed to schedule job:', error);
      toast.error('Failed to schedule delivery');
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
        if (job.status === 'to_be_scheduled' || !job.delivery_date) return false;
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
    
    return days;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Count unscheduled jobs
  const unscheduledJobs = jobs.filter(job => 
    job.status === 'to_be_scheduled' || 
    !job.delivery_date || 
    job.delivery_date === null
  ).length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">
          East Meadow Delivery Schedule
        </h1>
        <div className="flex gap-2">
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
      </div>

      {/* Unscheduled Jobs Alert */}
      {unscheduledJobs > 0 && isOffice && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <span className="font-medium text-orange-900">
                {unscheduledJobs} order{unscheduledJobs > 1 ? 's' : ''} waiting to be scheduled
              </span>
            </div>
            <button
              onClick={() => setShowToBeScheduled(!showToBeScheduled)}
              className={`text-sm font-medium px-3 py-1 rounded-lg transition-colors ${
                showToBeScheduled 
                  ? 'bg-orange-200 text-orange-800' 
                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              }`}
            >
              {showToBeScheduled ? 'Hide Unscheduled' : 'Show Unscheduled'}
            </button>
          </div>
        </div>
      )}

      {/* Calendar Days - Hide when showing unscheduled */}
      {!showToBeScheduled && (
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
      )}

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

            {/* Status Filter - Hide when showing unscheduled */}
            {!showToBeScheduled && (
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
            )}
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b">
          <h3 className="font-medium text-gray-900">
            {showToBeScheduled ? (
              `Orders To Be Scheduled (${filteredJobs.length})`
            ) : (
              `Deliveries for ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}`
            )}
          </h3>
          <div className="text-sm text-gray-500 mt-1">
            Showing {filteredJobs.length} of {jobs.length} total jobs
          </div>
        </div>
        
        {filteredJobs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium mb-2">
              {showToBeScheduled ? 'No orders waiting to be scheduled' : 'No deliveries found'}
            </p>
            <p>
              {showToBeScheduled 
                ? 'All orders have been scheduled'
                : jobs.length === 0 
                ? 'No jobs exist in the system'
                : `No jobs found for ${selectedDate}. Try selecting a different date.`
              }
            </p>
            {isOffice && (
              <Link
                to="/jobs/add"
                className="inline-block mt-4 btn-primary"
              >
                Schedule New Delivery
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
                onUpdateSchedule={updateJobSchedule}
                isDriver={user?.role === 'driver'}
                isOffice={isOffice}
                drivers={drivers}
                showScheduling={showToBeScheduled}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const JobCard = ({ job, onUpdateStatus, onUpdateSchedule, isDriver, isOffice, drivers, showScheduling }) => {
  const [showActions, setShowActions] = useState(false);
  const [showSchedulingForm, setShowSchedulingForm] = useState(false);
  const [driverNotes, setDriverNotes] = useState('');
  const [paymentReceived, setPaymentReceived] = useState('');
  const [schedulingData, setSchedulingData] = useState({
    delivery_date: new Date().toISOString().split('T')[0],
    assigned_driver: ''
  });

  const handleCompleteJob = () => {
    onUpdateStatus(job.id, 'completed', driverNotes, paymentReceived);
    setShowActions(false);
    setDriverNotes('');
    setPaymentReceived('');
  };

  const handleScheduleJob = () => {
    if (!schedulingData.delivery_date) {
      toast.error('Please select a delivery date');
      return;
    }
    
    onUpdateSchedule(job.id, schedulingData.delivery_date, schedulingData.assigned_driver);
    setShowSchedulingForm(false);
    setSchedulingData({
      delivery_date: new Date().toISOString().split('T')[0],
      assigned_driver: ''
    });
  };

  const handleQuickSchedule = (daysFromToday) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromToday);
    const dateStr = date.toISOString().split('T')[0];
    
    onUpdateSchedule(job.id, dateStr, null);
  };

  const isToBeScheduled = job.status === 'to_be_scheduled' || !job.delivery_date;

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-semibold text-gray-900">{job.customer_name}</h4>
            {isToBeScheduled ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                <Clock className="h-3 w-3 mr-1" />
                To Be Scheduled
              </span>
            ) : (
              <span className={`status-${job.status}`}>
                {job.status.replace('_', ' ')}
              </span>
            )}
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

            {!isToBeScheduled && job.delivery_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  Scheduled for {new Date(job.delivery_date + 'T00:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short', 
                    day: 'numeric'
                  })}
                </span>
              </div>
            )}

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
          {isToBeScheduled ? (
            isOffice && (
              <div className="flex gap-2">
                {/* Quick schedule buttons */}
                <button
                  onClick={() => handleQuickSchedule(0)}
                  className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                >
                  Today
                </button>
                <button
                  onClick={() => handleQuickSchedule(1)}
                  className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                >
                  Tomorrow
                </button>
                <button
                  onClick={() => setShowSchedulingForm(!showSchedulingForm)}
                  className="btn-primary text-sm"
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Schedule
                </button>
              </div>
            )
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Scheduling Form */}
      {showSchedulingForm && isOffice && (
        <div className="border-t pt-4 space-y-3">
          <h5 className="font-medium text-gray-900">Schedule Delivery</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Date *
              </label>
              <input
                type="date"
                value={schedulingData.delivery_date}
                onChange={(e) => setSchedulingData(prev => ({
                  ...prev,
                  delivery_date: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-eastmeadow-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assign Driver
              </label>
              <select
                value={schedulingData.assigned_driver}
                onChange={(e) => setSchedulingData(prev => ({
                  ...prev,
                  assigned_driver: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-eastmeadow-500 focus:border-transparent"
              >
                <option value="">Select driver (optional)</option>
                {drivers.map(driver => (
                  <option key={driver.id} value={driver.id}>
                    {driver.username}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleScheduleJob}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Schedule Delivery
            </button>
            <button
              onClick={() => setShowSchedulingForm(false)}
              className="btn-secondary flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

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
