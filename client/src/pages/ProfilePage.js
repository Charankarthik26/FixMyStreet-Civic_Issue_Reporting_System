import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Avatar,
  TextField,
  Button,
  Divider,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Snackbar,
  MenuItem,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import BadgeIcon from '@mui/icons-material/Badge';
import SecurityIcon from '@mui/icons-material/Security';
import PostAddIcon from '@mui/icons-material/PostAdd';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import CommentIcon from '@mui/icons-material/Comment';
import axios from 'axios';

const ProfilePage = () => {
  const { t, i18n } = useTranslation();
  const { user: authUser, dispatch } = useAuth();
  
  const [profileData, setProfileData] = useState(null);
  const [stats, setStats] = useState({ totalIssues: 0, totalVotes: 0, totalComments: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Edit Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  
  // Photo Upload State
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/users/profile');
      if (res.data && res.data.success) {
        const u = res.data.data.user;
        setProfileData(u);
        setStats(res.data.data.stats || { totalIssues: 0, totalVotes: 0, totalComments: 0 });
        
        // Initialize form
        setFirstName(u.firstName || '');
        setLastName(u.lastName || '');
        setPhone(u.phone || '');
        setPreferredLanguage(u.preferredLanguage || 'en');
        if (u.profileImage) {
          setImagePreview(u.profileImage.startsWith('http') ? u.profileImage : `http://localhost:5000${u.profileImage}`);
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err.response?.data?.message || 'Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size too large. Maximum size is 5MB.');
        return;
      }
      setProfileImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      
      const formData = new FormData();
      formData.append('firstName', firstName);
      formData.append('lastName', lastName);
      formData.append('phone', phone);
      formData.append('preferredLanguage', preferredLanguage);
      
      if (profileImageFile) {
        formData.append('profileImage', profileImageFile);
      }

      const res = await axios.put('/api/users/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data && res.data.success) {
        setSuccess('Profile updated successfully!');
        const updatedUser = res.data.data.user;
        setProfileData(updatedUser);
        
        // Update auth context
        dispatch({
          type: 'UPDATE_USER',
          payload: updatedUser
        });

        // Update active language if changed
        if (updatedUser.preferredLanguage) {
          i18n.changeLanguage(updatedUser.preferredLanguage);
        }
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const errorDetails = err.response.data.errors.map(e => e.msg).join(', ');
        setError(`${err.response.data.message || 'Validation failed'}: ${errorDetails}`);
      } else {
        setError(err.response?.data?.message || 'Failed to update profile.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={4}>
        {/* Left Column: Avatar and Stats */}
        <Grid item xs={12} md={4}>
          <Card 
            className="glass-card" 
            sx={{ 
              height: '100%',
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 3,
              overflow: 'hidden'
            }}
          >
            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 5, pb: 4 }}>
              {/* Photo Input (Hidden) */}
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              
              {/* Avatar Box with Edit Overlay */}
              <Box sx={{ position: 'relative', mb: 3 }}>
                <Avatar
                  src={imagePreview}
                  sx={{
                    width: 150,
                    height: 150,
                    fontSize: 48,
                    fontWeight: 700,
                    bgcolor: 'secondary.main',
                    color: 'secondary.contrastText',
                    boxShadow: '0 8px 32px rgba(29, 185, 84, 0.25)',
                    border: '4px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: '0 8px 32px rgba(29, 185, 84, 0.45)',
                      borderColor: 'primary.main'
                    }
                  }}
                >
                  {(!firstName && !lastName) 
                    ? 'U' 
                    : `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()}
                </Avatar>
                
                <IconButton
                  onClick={handlePhotoClick}
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    bgcolor: 'primary.main',
                    color: '#fff',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    }
                  }}
                >
                  <PhotoCameraIcon fontSize="small" />
                </IconButton>
              </Box>

              <Typography variant="h5" component="h2" sx={{ fontWeight: 800, mb: 1, textAlign: 'center' }}>
                {firstName} {lastName}
              </Typography>

              {/* Role badge */}
              <Chip
                label={profileData?.role?.toUpperCase().replace('_', ' ') || 'CITIZEN'}
                color={profileData?.role === 'user' ? 'default' : 'secondary'}
                sx={{ 
                  mb: 4, 
                  fontWeight: 700, 
                  px: 1.5,
                  background: profileData?.role === 'user' 
                    ? 'rgba(255, 255, 255, 0.08)' 
                    : 'linear-gradient(90deg, #1DB954 0%, #198754 100%)',
                  color: '#fff'
                }}
              />

              <Divider sx={{ width: '100%', mb: 4, borderColor: 'rgba(255,255,255,0.08)' }} />

              {/* Stats Grid */}
              <Typography variant="subtitle2" color="text.secondary" sx={{ alignSelf: 'flex-start', mb: 2, fontWeight: 700, textTransform: 'uppercase' }}>
                Your Contribution
              </Typography>
              <Grid container spacing={2} width="100%">
                <Grid item xs={4} textAlign="center">
                  <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <PostAddIcon color="primary" sx={{ mb: 0.5 }} />
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>{stats.totalIssues}</Typography>
                    <Typography variant="caption" color="text.secondary">Issues</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4} textAlign="center">
                  <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <ThumbUpIcon color="primary" sx={{ mb: 0.5 }} />
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>{stats.totalVotes}</Typography>
                    <Typography variant="caption" color="text.secondary">Votes</Typography>
                  </Box>
                </Grid>
                <Grid item xs={4} textAlign="center">
                  <Box sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <CommentIcon color="primary" sx={{ mb: 0.5 }} />
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>{stats.totalComments}</Typography>
                    <Typography variant="caption" color="text.secondary">Comments</Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column: Profile Form */}
        <Grid item xs={12} md={8}>
          <Card 
            className="glass-card"
            sx={{ 
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 3,
              p: 3
            }}
          >
            <CardContent>
              <Typography variant="h5" component="h2" sx={{ fontWeight: 800, mb: 4 }}>
                Profile Settings
              </Typography>
              
              <Box component="form" onSubmit={handleSubmit} noValidate>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      required
                      fullWidth
                      label="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      required
                      fullWidth
                      label="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      disabled
                      label="Email Address"
                      value={profileData?.email || ''}
                      InputProps={{
                        startAdornment: <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      required
                      fullWidth
                      label="Phone Number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      InputProps={{
                        startAdornment: <PhoneIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      disabled
                      label="Aadhar Number"
                      value={`XXXX XXXX ${profileData?.aadharLastFour || 'XXXX'}`}
                      InputProps={{
                        startAdornment: <BadgeIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel id="language-select-label">Preferred Language</InputLabel>
                      <Select
                        labelId="language-select-label"
                        value={preferredLanguage}
                        label="Preferred Language"
                        onChange={(e) => setPreferredLanguage(e.target.value)}
                      >
                        <MenuItem value="en">English</MenuItem>
                        <MenuItem value="hi">Hindi (हिन्दी)</MenuItem>
                        <MenuItem value="sat">Santali (ᱥᱟᱱᱛᱟᱲᱤ)</MenuItem>
                        <MenuItem value="bn">Bengali (বাংলা)</MenuItem>
                        <MenuItem value="or">Odia (ଓଡ଼ିଆ)</MenuItem>
                        <MenuItem value="ur">Urdu (اردو)</MenuItem>
                        <MenuItem value="sa">Sanskrit (संस्कृतम्)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {profileData?.role !== 'user' && profileData?.adminCategories && (
                    <Grid item xs={12}>
                      <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SecurityIcon color="secondary" fontSize="small" /> Managed Departments
                        </Typography>
                        <Box display="flex" flexWrap="wrap" gap={1} mt={1.5}>
                          {profileData.adminCategories.map((cat, idx) => (
                            <Chip 
                              key={idx} 
                              label={cat.toUpperCase()} 
                              size="small" 
                              color="secondary" 
                              variant="outlined" 
                              sx={{ fontWeight: 600 }} 
                            />
                          ))}
                        </Box>
                      </Box>
                    </Grid>
                  )}

                  <Grid item xs={12} sx={{ mt: 2 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      size="large"
                      disabled={saving}
                      sx={{ 
                        px: 4, 
                        fontWeight: 700,
                        boxShadow: '0 8px 24px rgba(29, 185, 84, 0.25)',
                        '&:hover': {
                          boxShadow: '0 8px 32px rgba(29, 185, 84, 0.4)'
                        }
                      }}
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Success SnackBar */}
      <Snackbar 
        open={!!success} 
        autoHideDuration={4000} 
        onClose={() => setSuccess(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ProfilePage;
