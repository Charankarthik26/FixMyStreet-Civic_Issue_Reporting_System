import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardActions,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress
} from '@mui/material';
//
import {
  LocationOn,
  Person,
  AccessTime,
  Visibility,
  FilterList,
  Refresh
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const IssuesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [issues, setIssues] = useState([]);
  const [filteredIssues, setFilteredIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all',
    priority: 'all'
  });
  const [locationState, setLocationState] = useState({ latitude: null, longitude: null, radiusKm: 5, usedNearby: false });

  useEffect(() => {
    // Fetch all issues immediately so the page is responsive and interactive right away
    fetchIssues(null, null, null, true);

    // Try to get browser location to fetch nearby issues in the background
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setLocationState(prev => ({ ...prev, ...coords, usedNearby: true }));
          // Fetch nearby issues in the background without blocking the UI
          fetchIssues(coords.latitude, coords.longitude, locationState.radiusKm, false);
        },
        (err) => {
          console.log('Geolocation skipped or failed:', err.message);
        },
        { enableHighAccuracy: false, timeout: 4000 } // shorter timeout, do not require high accuracy for speed
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filterIssues();
  }, [issues, filters]);

  const fetchIssues = async (latitude, longitude, radiusKm, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const token = localStorage.getItem('token');
      const hasCoords = typeof latitude === 'number' && typeof longitude === 'number';
      const query = hasCoords
        ? `?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&radius=${encodeURIComponent(radiusKm || 5)}`
        : '';
      const response = await fetch(`/api/issues${query}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (response.ok) {
        setIssues(data.issues || []);
      } else {
        throw new Error(data.message || 'Failed to fetch issues');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const filterIssues = () => {
    let filtered = [...issues];

    if (filters.category !== 'all') {
      filtered = filtered.filter(issue => issue.category === filters.category);
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(issue => issue.status === filters.status);
    }

    if (filters.priority !== 'all') {
      filtered = filtered.filter(issue => issue.priority === filters.priority);
    }

    setFilteredIssues(filtered);
  };

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'reported': return 'default';
      case 'acknowledged': return 'info';
      case 'in_progress': return 'warning';
      case 'resolved': return 'success';
      case 'rejected': return 'error';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'error';
      default: return 'default';
    }
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'electricity': return 'warning';
      case 'water': return 'info';
      case 'sanitation': return 'default';
      case 'roads': return 'error';
      case 'streetlights': return 'secondary';
      case 'other': return 'default';
      default: return 'default';
    }
  };

  const getDepartmentForCategory = (category) => {
    switch (category) {
      case 'electricity': return 'Electricity Department';
      case 'water': return 'Water Department';
      case 'sanitation': return 'Sanitation Department';
      case 'roads': return 'Public Works Department';
      case 'streetlights': return 'Public Works Department';
      case 'other': return 'Municipal Corporation';
      default: return 'Municipal Corporation';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewIssue = (issueId) => {
    navigate(`/issues/${issueId}`);
  };

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box py={4}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Typography variant="h4" component="h1">
            {t('navigation.issues')}
          </Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchIssues}
              className="glass-btn"
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate('/report')}
              className="glass-btn"
            >
              Report New Issue
            </Button>
          </Box>
        </Box>

        {/* Filters */}
        <Card sx={{ mb: 3 }} className="glass-card">
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <FilterList />
              <Typography variant="h6">Filters</Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                  >
                    <MenuItem value="all">All Categories</MenuItem>
                    {(!user || user.role !== 'admin') ? (
                      [
                        <MenuItem key="electricity" value="electricity">Electricity</MenuItem>,
                        <MenuItem key="water" value="water">Water</MenuItem>,
                        <MenuItem key="sanitation" value="sanitation">Sanitation</MenuItem>,
                        <MenuItem key="roads" value="roads">Roads</MenuItem>,
                        <MenuItem key="streetlights" value="streetlights">Streetlights</MenuItem>,
                        <MenuItem key="other" value="other">Other</MenuItem>
                      ]
                    ) : (
                      (user.adminCategories || []).map(cat => (
                        <MenuItem key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                  >
                    <MenuItem value="all">All Status</MenuItem>
                    <MenuItem value="reported">Reported</MenuItem>
                    <MenuItem value="acknowledged">Acknowledged</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                    <MenuItem value="rejected">Rejected</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filters.priority}
                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                  >
                    <MenuItem value="all">All Priority</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="critical">Critical</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Issues Count */}
        <Box mb={3}>
          <Typography variant="h6" color="text.secondary">
            Showing {filteredIssues.length} of {issues.length} issues
            {locationState.usedNearby && locationState.latitude && (
              <>
                {' '}within {locationState.radiusKm} km of your location
              </>
            )}
          </Typography>
        </Box>

        {/* Issues List */}
        {filteredIssues.length === 0 ? (
          <Card className="glass-card">
            <CardContent>
              <Box textAlign="center" py={4}>
                <Typography variant="h6" color="text.secondary">
                  No issues found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {filters.category !== 'all' || filters.status !== 'all' || filters.priority !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Be the first to report an issue!'
                  }
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3} className="issues-grid">
            {filteredIssues.map((issue, idx) => (
              <Grid item xs={12} key={issue.id} style={{ animation: `fadeIn 320ms ease-out ${(idx * 40)}ms both` }}>
                <Card className="issue-list-card glass-card">
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
                        {issue.title}
                      </Typography>
                      <Box display="flex" gap={1}>
                        <Chip
                          label={issue.category}
                          color={getCategoryColor(issue.category)}
                          size="small"
                        />
                        <Chip
                          label={issue.status}
                          color={getStatusColor(issue.status)}
                          size="small"
                        />
                        <Chip
                          label={issue.priority}
                          color={getPriorityColor(issue.priority)}
                          size="small"
                        />
                      </Box>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {issue.description}
                    </Typography>

                    <Box display="flex" flexWrap="wrap" gap={2} mb={2}>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Person fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {issue.reporter_name}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <LocationOn fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {issue.address || `${issue.latitude}, ${issue.longitude}`}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <AccessTime fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(issue.created_at)}
                        </Typography>
                      </Box>
                    </Box>

                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Submitted to:</strong> {getDepartmentForCategory(issue.category)}
                      </Typography>
                    </Box>

                    {issue.severity_score > 0 && (
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" color="text.secondary">
                          <strong>Severity Score:</strong> {issue.severity_score}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<Visibility />}
                      onClick={() => handleViewIssue(issue.id)}
                      className="glass-btn"
                    >
                      View Details
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Container>
  );
};

export default IssuesPage;