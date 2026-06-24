import React, { useState } from 'react';
import { 
  Container, Paper, TextField, Button, Typography, Box, Alert, Grid,
  FormControl, InputLabel, Select, MenuItem, FormControlLabel, Checkbox
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const RegisterPage = () => {
  const { t } = useTranslation();
  const { register, error, clearError } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    aadharNumber: '',
    otp: '',
    role: 'user',
    adminCategories: []
  });
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) clearError();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    
    if (formData.password !== formData.confirmPassword) {
      setLocalError(t('auth.passwordMismatch') || 'Passwords do not match');
      return;
    }
    
    setLoading(true);
    
    const result = await register(formData);
    
    if (result.success) {
      navigate('/issues');
    }
    
    setLoading(false);
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            {t('auth.registerTitle')}
          </Typography>
          
          {(error || localError) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error || localError}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('auth.firstName')}
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('auth.lastName')}
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('auth.email')}
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('auth.phone')}
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('auth.password')}
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('auth.confirmPassword')}
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('auth.aadharNumber')}
                  name="aadharNumber"
                  value={formData.aadharNumber}
                  onChange={handleChange}
                  inputProps={{ maxLength: 12 }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={t('auth.otp')}
                  name="otp"
                  value={formData.otp}
                  onChange={handleChange}
                  inputProps={{ maxLength: 6 }}
                  required
                />
              </Grid>
              
              {/* Role Selection */}
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Account Type</InputLabel>
                  <Select
                    value={formData.role}
                    onChange={handleChange}
                    name="role"
                    label="Account Type"
                  >
                    <MenuItem value="user">Citizen (Report Issues)</MenuItem>
                    <MenuItem value="admin">Department Admin (Manage Issues)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {/* Admin Categories Selection */}
              {formData.role === 'admin' && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Select categories you can manage:
                  </Typography>
                  <Grid container spacing={1}>
                    {['electricity', 'water', 'sanitation', 'roads', 'streetlights', 'other'].map((category) => (
                      <Grid item xs={6} sm={4} key={category}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={formData.adminCategories.includes(category)}
                              onChange={(e) => {
                                const categories = e.target.checked
                                  ? [...formData.adminCategories, category]
                                  : formData.adminCategories.filter(c => c !== category);
                                setFormData({ ...formData, adminCategories: categories });
                              }}
                            />
                          }
                          label={category.charAt(0).toUpperCase() + category.slice(1)}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              )}
            </Grid>
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? t('common.loading') : t('navigation.register')}
            </Button>
            
            <Box textAlign="center">
              <Typography variant="body2">
                {t('auth.alreadyHaveAccount')}{' '}
                <Link to="/login" style={{ textDecoration: 'none' }}>
                  {t('navigation.login')}
                </Link>
              </Typography>
            </Box>
          </form>
        </Paper>
      </Box>
    </Container>
  );
};

export default RegisterPage;
