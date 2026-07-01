import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Chip,
  Grid,
  Alert
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import GoogleMapComponent from '../components/Map/GoogleMapComponent';
import { useAuth } from '../contexts/AuthContext';

const MapPage = () => {
  const { t } = useTranslation();
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

  useEffect(() => {
    fetchIssues();
  }, []);

  useEffect(() => {
    filterIssues();
  }, [issues, filters]);

  const fetchIssues = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/issues', {
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
      setLoading(false);
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
    const colors = {
      'reported': 'default',
      'acknowledged': 'primary',
      'in_progress': 'warning',
      'resolved': 'success',
      'rejected': 'error'
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'low': 'success',
      'medium': 'warning',
      'high': 'error',
      'critical': 'error'
    };
    return colors[priority] || 'default';
  };

  const categories = [
    { value: 'all', label: t('filters.allCategories') },
    ...((!user || user.role !== 'admin') ? [
      { value: 'electricity', label: t('categories.electricity') },
      { value: 'water', label: t('categories.water') },
      { value: 'sanitation', label: t('categories.sanitation') },
      { value: 'roads', label: t('categories.roads') },
      { value: 'streetlights', label: t('categories.streetlights') },
      { value: 'other', label: t('categories.other') }
    ] : (user.adminCategories || []).map(cat => ({
      value: cat,
      label: cat.charAt(0).toUpperCase() + cat.slice(1)
    })))
  ];

  const statuses = [
    { value: 'all', label: t('filters.allStatuses') },
    { value: 'reported', label: t('status.reported') },
    { value: 'acknowledged', label: t('status.acknowledged') },
    { value: 'in_progress', label: t('status.inProgress') },
    { value: 'resolved', label: t('status.resolved') },
    { value: 'rejected', label: t('status.rejected') }
  ];

  const priorities = [
    { value: 'all', label: t('filters.allPriorities') },
    { value: 'low', label: t('priority.low') },
    { value: 'medium', label: t('priority.medium') },
    { value: 'high', label: t('priority.high') },
    { value: 'critical', label: t('priority.critical') }
  ];

  if (loading) {
    return (
      <Container maxWidth="lg">
        <Box py={4} textAlign="center">
          <Typography>Loading map...</Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box py={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('navigation.map')}
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('filters.filters')}
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>{t('issue.category')}</InputLabel>
                  <Select
                    value={filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                  >
                    {categories.map((category) => (
                      <MenuItem key={category.value} value={category.value}>
                        {category.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>{t('status.status')}</InputLabel>
                  <Select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                  >
                    {statuses.map((status) => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>{t('priority.priority')}</InputLabel>
                  <Select
                    value={filters.priority}
                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                  >
                    {priorities.map((priority) => (
                      <MenuItem key={priority.value} value={priority.value}>
                        {priority.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>{t('map.totalIssues')}:</strong> {filteredIssues.length}
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('map.legend')}
                </Typography>
                
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>{t('status.status')}:</strong>
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    <Chip label={t('status.reported')} size="small" color="default" />
                    <Chip label={t('status.acknowledged')} size="small" color="primary" />
                    <Chip label={t('status.inProgress')} size="small" color="warning" />
                    <Chip label={t('status.resolved')} size="small" color="success" />
                  </Box>
                </Box>

                <Box>
                  <Typography variant="body2" gutterBottom>
                    <strong>{t('priority.priority')}:</strong>
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    <Chip label={t('priority.low')} size="small" color="success" />
                    <Chip label={t('priority.medium')} size="small" color="warning" />
                    <Chip label={t('priority.high')} size="small" color="error" />
                    <Chip label={t('priority.critical')} size="small" color="error" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={9}>
            <Card>
              <CardContent sx={{ p: 0 }}>
                <GoogleMapComponent
                  height="600px"
                  issues={filteredIssues}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default MapPage;
