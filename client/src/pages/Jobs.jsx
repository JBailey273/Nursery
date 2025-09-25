import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  ChevronRight,
  User,
  Truck
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import JobDetailModal from '../components/JobDetailModal';
import StatusBadge from '../components/StatusBadge';
import toast from 'react-hot-toast';

const LOCAL_TIME_ZONE = 'America/New_York';

// Returns current date in YYYY-MM-DD format for the configured timezone
const getTodayDate = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: LOCAL_TIME_ZONE }).format(new Date());

const Jobs = () => {
  const { isOffice, isAdmin, user, makeAuthenticatedRequest } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const weekScrollRef = useRef(null);

  // Ensure calendar starts on the current day
  useEffect(() => {
    setSelectedDate(getTodayDate());
  }, []);

  // Helper function to safely format dates
  const formatDate = (dateString) => {
    if (!dateString) return null;
    
    try {
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
    if (isOffice || isAdmin) {
      fetchDrivers();
    }
  }, [isOffice, isAdmin, user]);

  useEffect(() => {
    filterJobs();
  }, [jobs, selectedDate, searchTerm, statusFilter, showToBeScheduled]);

  useEffect(() => {
    if (weekScrollRef.current) {
      const selectedButton = weekScrollRef.current.querySelector('[data-selected="true"]');
      selectedButton?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
    // Include loading so scroll happens after jobs are fetched
  }, [selectedDate, loading]);

  useEffect(() => {
    const jobIdParam = searchParams.get('jobId');
    if (jobIdParam && jobs.length > 0) {
      const jobToOpen = jobs.find(job => job.id === parseInt(jobIdParam));
      if (jobToOpen) {
        setSelectedJob(jobToOpen);
        setShowJobModal(true);
      }
    }
  }, [searchParams, jobs]);

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

      if (user?.role === 'driver') {
        const currentUserId = user.id ?? user.userId;
        const myJobs = jobsData.filter(
          job => job.assigned_driver === currentUserId
        );
        setJobs(myJobs);
      } else {
        setJobs(jobsData);
      }
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

    // Place completed jobs at the bottom of the list for easier scanning
    filtered = filtered.sort((a, b) => {
      const aCompleted = a.status === 'completed';
      const bCompleted = b.status === 'completed';
      if (aCompleted === bCompleted) return 0;
      return aCompleted ? 1 : -1;
    });

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

  // Enhanced calendar generation with better visual indicators (keeping -3 to +10 range)
  const generateCalendarDays = () => {
    const today = new Date(getTodayDate() + 'T12:00:00');
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

      const completedJobs = dayJobs.filter(job => job.status === 'completed');
      const pendingJobs = dayJobs.filter(job => job.status !== 'completed');

      days.push({
        date: dateStr,
        displayDate: date.getDate(),
        displayDay: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: LOCAL_TIME_ZONE }),
        displayMonth: date.toLocaleDateString('en-US', { month: 'short', timeZone: LOCAL_TIME_ZONE }),
        isToday: dateStr === getTodayDate(),
        isPast: dateStr < getTodayDate(),
        isFuture: dateStr > getTodayDate(),
        jobCount: dayJobs.length,
        completedCount: completedJobs.length,
        pendingCount: pendingJobs.length,
        hasJobs: dayJobs.length > 0
      });
    }

    return days;
  };

  // Get driver name helper
  const getDriverName = (driverId) => {
    if (!driverId) return 'Unassigned';
    const driver = drivers.find(d => d.id === driverId);
    if (driver) return driver.username;
    const currentUserId = user?.id ?? user?.userId;
    if (currentUserId === driverId) return user?.username || 'Unknown Driver';
    return 'Unknown Driver';
  };

  // Enhanced payment calculation function (from current version)
  const calculateUnpaidJobs = (jobList) =>
    jobList.filter(job => {
      const total = parseFloat(job.total_amount) || 0;
      const received = parseFloat(job.payment_received) || 0;
      const requiresCollection = total > 0;
      const isPaid = job.paid || !requiresCollection || received >= total;
      return requiresCollection && !isPaid && job.status !== 'to_be_scheduled';
    }).length;

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

  // OFFICE/ADMIN VIEW: Enhanced interface with improved calendar
  const unpaidJobs = calculateUnpaidJobs(filteredJobs);

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4 sm:mb-0">
          East Meadow Delivery Schedule
        </h1>
        <div className="flex gap-2">
          {(isOffice || isAdmin) && (
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
                {unpaidJobs} {unpaidJobs === 1 ? 'delivery' : 'deliveries'} need{unpaidJobs === 1 ? 's' : ''} payment collection
              </span>
            </div>
          </div>
        )}

        {/* Unscheduled Jobs Alert - Office/Admin */}
        {unscheduledJobs > 0 && (isOffice || isAdmin) && (
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

      {/* Enhanced Calendar Days - Hide when showing unscheduled */}
      {!showToBeScheduled && (
        <div className="relative z-10 bg-white rounded-xl shadow-sm border mb-6 overflow-visible">
          <div className="p-4 border-b bg-gradient-to-r from-eastmeadow-50 to-blue-50">
            <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-eastmeadow-600" />
              Select Delivery Date
            </h2>
            <p className="text-sm text-gray-600 mt-1">Choose a date to view scheduled deliveries</p>
          </div>
          <div className="p-4 pb-6">
            <div
              className="relative flex gap-3 overflow-x-auto overflow-y-visible pb-4 scrollbar-hide"
              ref={weekScrollRef}
            >
              {generateCalendarDays().map((day) => (
                <button
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  data-selected={selectedDate === day.date}
                  className={`relative flex-shrink-0 min-w-[110px] p-4 rounded-xl border-2 text-center transition-all duration-200 ${
                    selectedDate === day.date
                      ? 'z-50 bg-eastmeadow-500 border-eastmeadow-600 text-white shadow-lg scale-105 origin-top transform'
                      : day.isToday
                        ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-md'
                        : day.isPast
                          ? 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                          : day.hasJobs
                            ? 'bg-orange-50 border-orange-200 hover:bg-orange-100 text-orange-900'
                            : 'bg-green-50 border-green-200 hover:bg-green-100 text-green-700'
                  }`}
                >
                  <div className="text-xs text-current opacity-80 mb-1 font-medium uppercase tracking-wide">
                    {day.displayDay}
                  </div>
                  <div className="text-2xl font-bold mb-1">{day.displayDate}</div>
                  <div className="text-xs opacity-80 mb-3">{day.displayMonth}</div>
                  
                  {day.hasJobs ? (
                    <div className="space-y-1">
                      <div className={`text-xs font-bold px-3 py-1 rounded-full ${
                        selectedDate === day.date 
                          ? 'bg-white/20 text-white' 
                          : day.isToday
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-orange-100 text-orange-800'
                      }`}>
                        {day.jobCount} job{day.jobCount !== 1 ? 's' : ''}
                      </div>
                      
                      <div className="flex gap-1 justify-center">
                        {day.completedCount > 0 && (
                          <div className={`text-xs px-2 py-0.5 rounded-full ${
                            selectedDate === day.date 
                              ? 'bg-green-200 text-green-800' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            ✓ {day.completedCount}
                          </div>
                        )}
                        {day.pendingCount > 0 && (
                          <div className={`text-xs px-2 py-0.5 rounded-full ${
                            selectedDate === day.date 
                              ? 'bg-blue-200 text-blue-800' 
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            TO DO {day.pendingCount}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className={`text-xs px-3 py-1 rounded-full ${
                      selectedDate === day.date 
                        ? 'bg-white/20 text-white' 
                        : day.isToday
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                      No jobs
                    </div>
                  )}
                  
                  {day.isToday && (
                    <div className={`text-xs mt-2 font-bold ${
                      selectedDate === day.date ? 'text-white' : 'text-blue-600'
                    }`}>
                      TODAY
                    </div>
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
                  <option value="completed">Completed</option>
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
              `Deliveries for ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: LOCAL_TIME_ZONE
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
            {(isOffice || isAdmin) && (
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
                isOffice={isOffice || isAdmin}
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
          const params = new URLSearchParams(searchParams);
          params.delete('jobId');
          setSearchParams(params);
        }}
        onUpdate={handleJobUpdate}
        drivers={drivers}
      />
    </div>
  );
};

// Enhanced Office/Admin job card
const MobileJobCard = ({ job, onClick, onUpdateSchedule, isOffice, showScheduling, drivers, getDriverName, formatDate }) => {
  const [showSchedulingForm, setShowSchedulingForm] = useState(false);
  const [schedulingData, setSchedulingData] = useState({
    delivery_date: getTodayDate(),
    assigned_driver: ''
  });

  // Payment collection logic
  const totalDue = parseFloat(job.total_amount) || 0;
  const alreadyPaid = parseFloat(job.payment_received) || 0;
  const requiresCollection = totalDue > 0;
  const amountDue = requiresCollection ? Math.max(0, totalDue - alreadyPaid) : 0;
  const isFullyPaid = job.paid || !requiresCollection || alreadyPaid >= totalDue;
  const isPartiallyPaid = requiresCollection && !isFullyPaid && alreadyPaid > 0;
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
              {/* Status indicators */}
              <div className="flex items-center gap-2 flex-shrink-0 order-1 sm:order-2">
                {isToBeScheduled ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    <Clock className="h-3 w-3 mr-1" />
                    To Schedule
                  </span>
                ) : (
                  <StatusBadge status={job.status} />
                )}

                {/* Payment indicator - prominent for unpaid */}
                {requiresCollection ? (
                  isFullyPaid ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      COLLECTION COMPLETE
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 animate-pulse">
                        <DollarSign className="h-3 w-3 mr-1" />
                        ${amountDue.toFixed(2)} DUE
                      </span>
                      {isPartiallyPaid && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          PARTIAL
                        </span>
                      )}
                    </>
                  )
                ) : (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    NO COLLECTION
                  </span>
                )}
              </div>

              <h4 className="font-semibold text-gray-900 truncate order-2 sm:order-1">{job.customer_name}</h4>
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

                {job.truck && (
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 flex-shrink-0" />
                    <span>{job.truck}</span>
                  </div>
                )}
              </div>
            )}

            {isToBeScheduled && job.truck && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Truck className="h-4 w-4 flex-shrink-0" />
                <span>{job.truck}</span>
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
