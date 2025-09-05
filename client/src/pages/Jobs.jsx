import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Calendar,
  Plus,
  Search,
  MapPin,
  Package,
  Phone,
  CheckCircle,
  Clock,
  DollarSign,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  User,
  Truck
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import JobDetailModal from '../components/JobDetailModal';
import toast from 'react-hot-toast';

const LOCAL_TIME_ZONE = 'America/New_York';

// Returns current date in YYYY-MM-DD format for the configured timezone
const getTodayDate = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: LOCAL_TIME_ZONE });

const Jobs = () => {
  const { isOffice, user, makeAuthenticatedRequest } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayDate());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [drivers, setDrivers] = useState([]);
  const [showToBeScheduled, setShowToBeScheduled] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobModal, setShowJobModal] = useState(false);

  // Helper function to safely format dates
  const formatDate = (dateString) => {
    if (!dateString) return null;
    
    try {
      // Handle different date formats
      let date;
      if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Already in YYYY-MM-DD format, add time to avoid timezone issues
        date = new Date(dateString + 'T12:00:00');
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) {
        console.warn('Invalid date:', dateString);
        return null;
      }
      
      return date;
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return null;
    }
  };

  // Helper function to normalize dates for comparison (always returns YYYY-MM-DD)
  const normalizeDateForComparison = (dateString) => {
    if (!dateString) return null;

    try {
      if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return dateString;
      }

      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;

      return date.toLocaleDateString('en-CA', { timeZone: LOCAL_TIME_ZONE });
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
        filtered = filtered.filter(job => {
          const normalizedJobDate = normalizeDateForComparison(job.delivery_date);
          const normalizedSelectedDate = normalizeDateForComparison(selectedDate);
          return normalizedJobDate === normalizedSelectedDate;
        });
      }
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(job =>
        job.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status (unless showing to_be_scheduled)
    if (statusFilter !== 'all' && !showToBeScheduled) {
      filtered = filtered.filter(job => job.status === statusFilter);
    }

    setFilteredJobs(filtered);
  };

  const updateJobSchedule = async (jobId, deliveryDate, assignedDriver = null) => {
    try {
      const updateData = {
        delivery_date: deliveryDate,
        assigned_driver: assignedDriver ? parseInt(assignedDriver) : null,
        status: 'scheduled'
      };

      await makeAuthenticatedRequest('put', `/jobs/${jobId}`, updateData);
      
      fetchJobs(); // Refresh all jobs
      toast.success('Delivery scheduled successfully!');
    } catch (error) {
      console.error('Failed to schedule job:', error);
      toast.error('Failed to schedule delivery');
    }
  };

  const handleJobClick = (job) => {
    setSelectedJob(job);
    setShowJobModal(true);
  };

  const handleJobUpdate = () => {
    fetchJobs(); // Refresh jobs after any update
    setShowJobModal(false);
    setSelectedJob(null);
  };

  const generateCalendarDays = () => {
    const today = new Date(getTodayDate());
    const days = [];

    for (let i = -3; i <= 10; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toLocaleDateString('en-CA', { timeZone: LOCAL_TIME_ZONE });

      const dayJobs = jobs.filter(job => {
        if (job.status === 'to_be_scheduled' || !job.delivery_date) return false;
        const normalizedJobDate = normalizeDateForComparison(job.delivery_date);
        return normalizedJobDate === dateStr;
      });

      days.push({
        date: dateStr,
        displayDate: date.getDate(),
        displayDay: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: LOCAL_TIME_ZONE }),
        isToday: dateStr === getTodayDate(),
        jobCount: dayJobs.length,
        completedCount: dayJobs.filter(job => job.status === 'completed').length
      });
    }

    return days;
  };

  // Get driver name helper
  const getDriverName = (driverId) => {
    if (!driverId) return 'Unassigned';
    const driver = drivers.find(d => d.id === driverId);
    return driver ? driver.username : 'Unknown Driver';
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

  // Count unpaid jobs for current user (drivers see only their assigned jobs)
  const unpaidJobs = jobs.filter(job => {
    const isPaid = job.paid || (job.total_amount > 0 && job.payment_received >= job.total_amount);
    if (user?.role === 'driver') {
      return !isPaid && job.assigned_driver === user.userId && job.status !== 'to_be_scheduled';
    }
    return !isPaid && job.status !== 'to_be_scheduled';
  }).length;

  // DRIVER VIEW: Simple, focused interface
  if (user?.role === 'driver') {
    const myJobs = jobs.filter(job =>
      job.assigned_driver === user.userId &&
      job.status !== 'to_be_scheduled' &&
      job.delivery_date
    );

    const selectedDayJobs = myJobs.filter(job => {
      const jobDate = normalizeDateForComparison(job.delivery_date);
      return jobDate === selectedDate;
    });

    const upcomingJobs = myJobs.filter(job => {
      const jobDate = normalizeDateForComparison(job.delivery_date);
      return jobDate && jobDate > selectedDate;
    });

    const changeWeek = (direction) => {
      const date = new Date(selectedDate);
      date.setDate(date.getDate() + direction * 7);
      setSelectedDate(date.toISOString().split('T')[0]);
    };

    const generateDriverWeekDays = () => {
      const current = new Date(selectedDate);
      const start = new Date(current);
      start.setDate(current.getDate() - current.getDay());
      const days = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        const dayJobs = myJobs.filter(job => {
          const jobDate = normalizeDateForComparison(job.delivery_date);
          return jobDate === dateStr;
        });
        days.push({
          date: dateStr,
          displayDate: date.getDate(),
          displayDay: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' }),
          jobCount: dayJobs.length
        });
      }
      return days;
    };

    return (
      <div className="p-4 sm:p-6">
        {/* Driver Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Truck className="h-8 w-8 text-eastmeadow-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Deliveries</h1>
              <p className="text-gray-600">Welcome {user.username}!</p>
            </div>
          </div>
        </div>

        {/* Payment Alert for Drivers */}
        {unpaidJobs > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-red-600" />
              <span className="font-medium text-red-900">
                {unpaidJobs} delivery{unpaidJobs > 1 ? 's' : ''} need payment collection
              </span>
            </div>
          </div>
        )}

        {/* Driver Week Navigation and Selected Day Jobs */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="flex items-center justify-between p-4 border-b bg-blue-50">
            <button
              onClick={() => changeWeek(-1)}
              className="p-2 text-blue-700 hover:bg-blue-100 rounded-lg"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'America/New_York'
              })} ({selectedDayJobs.length})
            </h2>
            <button
              onClick={() => changeWeek(1)}
              className="p-2 text-blue-700 hover:bg-blue-100 rounded-lg"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="p-4">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {generateDriverWeekDays().map((day) => (
                <button
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  className={`flex-shrink-0 min-w-[80px] p-3 rounded-lg border text-center transition-colors ${
                    selectedDate === day.date
                      ? 'bg-eastmeadow-50 border-eastmeadow-200 text-eastmeadow-900'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <div className="text-xs text-gray-600 mb-1">{day.displayDay}</div>
                  <div className="font-medium">{day.displayDate}</div>
                  <div className="text-xs mt-1 text-gray-400">{day.jobCount}</div>
                </button>
              ))}
            </div>
          </div>

          {selectedDayJobs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No deliveries</p>
              <p>Enjoy your day!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {selectedDayJobs.map((job) => (
                <DriverJobCard
                  key={job.id}
                  job={job}
                  onClick={() => handleJobClick(job)}
                  drivers={drivers}
                  getDriverName={getDriverName}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Jobs */}
        {upcomingJobs.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                Upcoming Deliveries ({upcomingJobs.length})
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {upcomingJobs.slice(0, 5).map((job) => (
                <DriverJobCard
                  key={job.id}
                  job={job}
                  onClick={() => handleJobClick(job)}
                  drivers={drivers}
                  getDriverName={getDriverName}
                  formatDate={formatDate}
                  showDate={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* Job Detail Modal */}
        <JobDetailModal
          job={selectedJob}
          isOpen={showJobModal}
          onClose={() => {
            setShowJobModal(false);
            setSelectedJob(null);
          }}
          onUpdate={handleJobUpdate}
          drivers={drivers}
        />
      </div>
    );
  }

  // OFFICE/ADMIN VIEW: Full interface (existing code continues...)
  return (
    <div className="p-4 sm:p-6">
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

      {/* Alerts */}
      <div className="space-y-3 mb-6">
        {/* Unpaid Jobs Alert */}
        {unpaidJobs > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="font-medium text-red-900">
                {unpaidJobs} delivery{unpaidJobs > 1 ? 's' : ''} need{unpaidJobs === 1 ? 's' : ''} payment collection
              </span>
            </div>
          </div>
        )}

        {/* Unscheduled Jobs Alert - Office Only */}
        {unscheduledJobs > 0 && isOffice && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
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
      </div>

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

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
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
                day: 'numeric',
                timeZone: 'America/New_York'
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
              <MobileJobCard
                key={job.id}
                job={job}
                onClick={() => handleJobClick(job)}
                onUpdateSchedule={updateJobSchedule}
                isOffice={isOffice}
                showScheduling={showToBeScheduled}
                drivers={drivers}
                getDriverName={getDriverName}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Job Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        isOpen={showJobModal}
        onClose={() => {
          setShowJobModal(false);
          setSelectedJob(null);
        }}
        onUpdate={handleJobUpdate}
        drivers={drivers}
      />
    </div>
  );
};

// Driver-optimized job card
const DriverJobCard = ({ job, onClick, drivers, getDriverName, formatDate, showDate = false }) => {
  // Calculate payment status
  const totalDue = job.total_amount || 0;
  const alreadyPaid = job.payment_received || 0;
  const amountDue = Math.max(0, totalDue - alreadyPaid);
  const isFullyPaid = job.paid || amountDue <= 0;

  return (
    <button
      onClick={onClick}
      className="w-full p-4 text-left hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-50"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Customer name and urgent payment indicator */}
          <div className="flex items-center gap-3 mb-2">
            <h4 className="font-semibold text-gray-900 truncate">{job.customer_name}</h4>
            
            {/* PROMINENT payment indicator for drivers */}
            {!isFullyPaid && totalDue > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-800 animate-pulse border-2 border-red-200">
                <DollarSign className="h-4 w-4 mr-1" />
                COLLECT ${amountDue.toFixed(2)}
              </span>
            )}

            {isFullyPaid && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                PAID
              </span>
            )}
          </div>
          
          {/* Address */}
          <div className="flex items-center gap-2 text-gray-600 mb-2">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{job.address}</span>
          </div>

          {/* Phone */}
          {job.customer_phone && (
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <Phone className="h-4 w-4 flex-shrink-0" />
              <a href={`tel:${job.customer_phone}`} className="text-blue-600 font-medium">
                {job.customer_phone}
              </a>
            </div>
          )}

          {/* Date if needed */}
          {showDate && job.delivery_date && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>
                {formatDate(job.delivery_date)?.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'America/New_York'
                }) || 'Invalid Date'}
              </span>
            </div>
          )}

          {/* Products preview */}
          {job.products && job.products.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
              <Package className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                {job.products.length === 1 
                  ? `${job.products[0].quantity} ${job.products[0].unit} ${job.products[0].product_name}`
                  : `${job.products.length} items`
                }
              </span>
            </div>
          )}
        </div>

        {/* Status and arrow */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          <span className={`status-${job.status} text-xs`}>
            {job.status.replace('_', ' ').toUpperCase()}
          </span>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      </div>
    </button>
  );
};

// Office/Admin job card (existing MobileJobCard with improvements)
const MobileJobCard = ({ job, onClick, onUpdateSchedule, isOffice, showScheduling, drivers, getDriverName, formatDate }) => {
  const [showSchedulingForm, setShowSchedulingForm] = useState(false);
  const [schedulingData, setSchedulingData] = useState({
    delivery_date: getTodayDate(),
    assigned_driver: ''
  });

  // Calculate payment status
  const totalDue = job.total_amount || 0;
  const alreadyPaid = job.payment_received || 0;
  const amountDue = Math.max(0, totalDue - alreadyPaid);
  const isFullyPaid = job.paid || amountDue <= 0;
  const isToBeScheduled = job.status === 'to_be_scheduled' || !job.delivery_date;

  const handleScheduleJob = () => {
    if (!schedulingData.delivery_date) {
      toast.error('Please select a delivery date');
      return;
    }
    
    onUpdateSchedule(job.id, schedulingData.delivery_date, schedulingData.assigned_driver);
    setShowSchedulingForm(false);
    setSchedulingData({
      delivery_date: getTodayDate(),
      assigned_driver: ''
    });
  };

  const handleQuickSchedule = (daysFromToday) => {
    const date = new Date(getTodayDate());
    date.setDate(date.getDate() + daysFromToday);
    const dateStr = date.toLocaleDateString('en-CA', { timeZone: LOCAL_TIME_ZONE });

    onUpdateSchedule(job.id, dateStr, null);
  };

  return (
    <div className="relative">
      {/* Main clickable card */}
      <button
        onClick={onClick}
        className="w-full p-4 text-left hover:bg-gray-50 transition-colors focus:outline-none focus:bg-gray-50"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Header with customer name and status */}
            <div className="flex items-center gap-3 mb-2">
              <h4 className="font-semibold text-gray-900 truncate">{job.customer_name}</h4>
              
              {/* Status indicators */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {isToBeScheduled ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    <Clock className="h-3 w-3 mr-1" />
                    To Schedule
                  </span>
                ) : (
                  <span className={`status-${job.status} text-xs`}>
                    {job.status.replace('_', ' ').toUpperCase()}
                  </span>
                )}

                {/* Payment indicator - prominent for unpaid */}
                {!isFullyPaid && totalDue > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 animate-pulse">
                    <DollarSign className="h-3 w-3 mr-1" />
                    ${amountDue.toFixed(2)} DUE
                  </span>
                )}

                {isFullyPaid && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    PAID
                  </span>
                )}
              </div>
            </div>
            
            {/* Address and phone */}
            <div className="space-y-1 text-sm text-gray-600 mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{job.address}</span>
              </div>
              
              {job.customer_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>{job.customer_phone}</span>
                </div>
              )}
            </div>

            {/* Products preview */}
            {job.products && job.products.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <Package className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">
                  {job.products.length === 1 
                    ? `${job.products[0].quantity} ${job.products[0].unit} ${job.products[0].product_name}`
                    : `${job.products.length} items`
                  }
                </span>
              </div>
            )}

            {/* Delivery date and driver for scheduled jobs */}
            {!isToBeScheduled && (
              <div className="space-y-1 text-sm text-gray-600">
                {job.delivery_date && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span>
                      {formatDate(job.delivery_date)?.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'America/New_York'
                      }) || 'Invalid Date'}
                    </span>
                  </div>
                )}
                
                {job.assigned_driver && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 flex-shrink-0" />
                    <span>{getDriverName(job.assigned_driver)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Arrow indicator */}
          <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
        </div>
      </button>

      {/* Quick scheduling buttons for to_be_scheduled jobs */}
      {isToBeScheduled && isOffice && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleQuickSchedule(0);
              }}
              className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 transition-colors"
            >
              Today
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleQuickSchedule(1);
              }}
              className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 transition-colors"
            >
              Tomorrow
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSchedulingForm(!showSchedulingForm);
              }}
              className="text-xs bg-eastmeadow-100 text-eastmeadow-700 px-3 py-1 rounded-full hover:bg-eastmeadow-200 transition-colors"
            >
              Choose Date
            </button>
          </div>

          {/* Expanded scheduling form */}
          {showSchedulingForm && (
            <div className="mt-3 space-y-3 bg-gray-50 rounded-lg p-3" onClick={(e) => e.stopPropagation()}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    value={schedulingData.delivery_date}
                    onChange={(e) => setSchedulingData(prev => ({
                      ...prev,
                      delivery_date: e.target.value
                    }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-eastmeadow-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Driver
                  </label>
                  <select
                    value={schedulingData.assigned_driver}
                    onChange={(e) => setSchedulingData(prev => ({
                      ...prev,
                      assigned_driver: e.target.value
                    }))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-eastmeadow-500"
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
                  className="flex-1 bg-eastmeadow-600 text-white py-2 px-3 rounded-lg text-sm font-medium hover:bg-eastmeadow-700"
                >
                  Schedule
                </button>
                <button
                  onClick={() => setShowSchedulingForm(false)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Jobs;
