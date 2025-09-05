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
      console.log(`📊 Status filter: ${beforeFilter} → ${filtere
