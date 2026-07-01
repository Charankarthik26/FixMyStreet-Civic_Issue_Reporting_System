import React, { useState } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  TextField, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Grid,
  Alert,
  CircularProgress
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Add as AddIcon, PhotoCamera as CameraIcon } from '@mui/icons-material';
import EnhancedMapComponent from '../components/Map/EnhancedMapComponent';

const ReportIssuePage = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    location: null,
    photo: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const categories = [
    { value: 'electricity', label: t('categories.electricity') },
    { value: 'water', label: t('categories.water') },
    { value: 'sanitation', label: t('categories.sanitation') },
    { value: 'roads', label: t('categories.roads') },
    { value: 'streetlights', label: t('categories.streetlights') },
    { value: 'other', label: t('categories.other') }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLocationSelect = (location) => {
    setFormData(prev => ({
      ...prev,
      location: location
    }));
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        photo: file
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validate form
      if (!formData.title || !formData.description || !formData.category || !formData.location) {
        throw new Error('Please fill all required fields and select a location on the map');
      }

      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('category', formData.category);
      submitData.append('latitude', formData.location.lat);
      submitData.append('longitude', formData.location.lng);
      
      if (formData.photo) {
        submitData.append('images', formData.photo);
      }

      // Submit to backend
      const response = await fetch('/api/issues/submit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: submitData
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess('Issue reported successfully!');
        setFormData({
          title: '',
          description: '',
          category: '',
          location: null,
          photo: null
        });
      } else {
        if (result.errors && Array.isArray(result.errors)) {
          const errorMsgs = result.errors.map(err => err.msg).join(', ');
          throw new Error(`Validation failed: ${errorMsgs}`);
        }
        throw new Error(result.message || 'Failed to report issue');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box py={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Report an Issue
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Select Location
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Click on the map to select the exact location of the issue
                </Typography>
                
                <EnhancedMapComponent
                  onLocationSelect={handleLocationSelect}
                  selectedLocation={formData.location}
                  category={formData.category}
                />
                
                {formData.location && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                    <Typography variant="body2">
                      <strong>Selected Location:</strong><br />
                      Latitude: {formData.location.lat.toFixed(6)}<br />
                      Longitude: {formData.location.lng.toFixed(6)}
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Details
                </Typography>
                
                <Box component="form" onSubmit={handleSubmit}>
                  <TextField
                    fullWidth
                    label={'Title'}
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    sx={{ mb: 2 }}
                  />

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Category</InputLabel>
                    <Select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      required
                    >
                      {categories.map((category) => (
                        <MenuItem key={category.value} value={category.value}>
                          {category.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    label={'Description'}
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    multiline
                    rows={4}
                    required
                    sx={{ mb: 2 }}
                  />

                  <Box sx={{ mb: 2 }}>
                    <input
                      accept="image/*"
                      style={{ display: 'none' }}
                      id="photo-upload"
                      type="file"
                      onChange={handlePhotoUpload}
                    />
                    <label htmlFor="photo-upload">
                      <Button
                        variant="outlined"
                        component="span"
                        startIcon={<CameraIcon />}
                        fullWidth
                        className="glass-btn"
                      >
                        {formData.photo ? formData.photo.name : 'Upload Photo'}
                      </Button>
                    </label>
                  </Box>

                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size="large"
                    startIcon={<AddIcon />}
                    disabled={loading || !formData.location}
                    className="glass-btn"
                  >
                    {loading ? <CircularProgress size={24} /> : 'Submit Report'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default ReportIssuePage;
