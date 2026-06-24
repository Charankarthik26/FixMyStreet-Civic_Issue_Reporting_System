import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Divider,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Avatar
} from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { divIcon } from 'leaflet';
import {
  ArrowBack,
  LocationOn,
  Person,
  AccessTime,
  Visibility,
  ThumbUp,
  ThumbDown,
  AdminPanelSettings,
  Send
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const customMarkerIcon = divIcon({
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="#f44336"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
  className: 'custom-leaflet-marker',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36]
});

const IssueDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [voteError, setVoteError] = useState('');
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const { user } = useAuth();
  const [newStatus, setNewStatus] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [adminError, setAdminError] = useState('');

  useEffect(() => {
    fetchIssue();
  }, [id]);

  const fetchIssue = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/issues/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (response.ok) {
        setIssue(data.issue);
      } else {
        throw new Error(data.message || 'Failed to fetch issue');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (voteType) => {
    setVoteError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/issues/${id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ voteType })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Voting is currently unavailable');
      }

      // Optimistic: adjust a local count if present
      setIssue((prev) => prev ? { ...prev, severity_score: (prev.severity_score || 0) + (voteType === 'upvote' ? 1 : -1) } : prev);
    } catch (e) {
      setVoteError(e.message);
    }
  };

  const handleAddComment = async () => {
    setCommentError('');
    if (!comment || comment.trim().length < 3) {
      setCommentError('Please enter a longer comment');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/issues/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ comment: comment.trim() })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Comments are currently unavailable');
      }
      setComment('');
      fetchIssue();
    } catch (e) {
      setCommentError(e.message);
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    setAdminError('');
    setStatusUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/issues/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to update status');
      }
      setNewStatus('');
      fetchIssue();
    } catch (e) {
      setAdminError(e.message);
    } finally {
      setStatusUpdating(false);
    }
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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  if (error) {
    return (
      <Container maxWidth="lg">
        <Box py={4}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
          <Button
            variant="contained"
            startIcon={<ArrowBack />}
            onClick={() => navigate('/issues')}
          >
            Back to Issues
          </Button>
        </Box>
      </Container>
    );
  }

  if (!issue) {
    return (
      <Container maxWidth="lg">
        <Box py={4}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Issue not found
          </Alert>
          <Button
            variant="contained"
            startIcon={<ArrowBack />}
            onClick={() => navigate('/issues')}
          >
            Back to Issues
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box py={4}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={4}>
          <IconButton onClick={() => navigate('/issues')}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" component="h1">
            Issue Details
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Main Issue Card */}
          <Grid item xs={12} md={8}>
            <Card className="glass-card">
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
                  <Typography variant="h5" component="h2" sx={{ flexGrow: 1 }}>
                    {issue.title}
                  </Typography>
                  <Box display="flex" gap={1}>
                    <Chip
                      label={issue.category}
                      color={getCategoryColor(issue.category)}
                    />
                    <Chip
                      label={issue.status}
                      color={getStatusColor(issue.status)}
                    />
                    <Chip
                      label={issue.priority}
                      color={getPriorityColor(issue.priority)}
                    />
                  </Box>
                </Box>

                <Typography variant="body1" paragraph>
                  {issue.description}
                </Typography>

                <Divider sx={{ my: 3 }} />

                {/* Issue Information */}
                <Grid container spacing={2} sx={{ mb: 4 }}>
                  <Grid item xs={12} sm={6}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', transition: 'all 0.3s ease', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', bgcolor: 'rgba(255,255,255,0.06)' } }}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar sx={{ bgcolor: 'primary.dark' }}><Person /></Avatar>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Reported by</Typography>
                          <Typography variant="body1" fontWeight="600">{issue.reporter_name}</Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', transition: 'all 0.3s ease', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', bgcolor: 'rgba(255,255,255,0.06)' } }}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar sx={{ bgcolor: 'secondary.dark' }}><AccessTime /></Avatar>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Reported on</Typography>
                          <Typography variant="body1" fontWeight="600">{formatDate(issue.created_at)}</Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', transition: 'all 0.3s ease', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', bgcolor: 'rgba(255,255,255,0.06)' } }}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar sx={{ bgcolor: 'success.dark' }}><LocationOn /></Avatar>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Location</Typography>
                          <Typography variant="body1" fontWeight="600">{issue.address || `${issue.latitude}, ${issue.longitude}`}</Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', transition: 'all 0.3s ease', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', bgcolor: 'rgba(255,255,255,0.06)' } }}>
                      <Box display="flex" alignItems="center" gap={1.5}>
                        <Avatar sx={{ bgcolor: 'warning.dark' }}><Visibility /></Avatar>
                        <Box>
                          <Typography variant="body2" color="text.secondary">Department</Typography>
                          <Typography variant="body1" fontWeight="600">{getDepartmentForCategory(issue.category)}</Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>

                {issue.latitude && issue.longitude && (
                  <Box sx={{ height: 350, width: '100%', borderRadius: 2, overflow: 'hidden', mb: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                    <MapContainer 
                      center={[issue.latitude, issue.longitude]} 
                      zoom={15} 
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                      />
                      <Marker 
                        position={[issue.latitude, issue.longitude]}
                        icon={customMarkerIcon}
                      >
                        <Popup>{issue.address || 'Issue Location'}</Popup>
                      </Marker>
                    </MapContainer>
                  </Box>
                )}

                {issue.severity_score > 0 && (
                  <>
                    <Divider sx={{ my: 3 }} />
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Issue Statistics
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Severity Score:</strong> {issue.severity_score}
                      </Typography>
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Sidebar */}
          <Grid item xs={12} md={4}>
            {user?.role === 'admin' && (
              <Card 
                className="glass-card" 
                sx={{ 
                  mb: 3, 
                  border: '1px solid rgba(144, 202, 249, 0.5)',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={3}>
                    <AdminPanelSettings color="primary" />
                    <Typography variant="h6" sx={{ m: 0, fontWeight: 600 }}>
                      Admin Actions
                    </Typography>
                  </Box>

                  {adminError && (
                    <Alert severity="error" sx={{ mb: 2 }}>{adminError}</Alert>
                  )}
                  
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Update Status</InputLabel>
                    <Select
                      value={newStatus || issue.status}
                      onChange={(e) => setNewStatus(e.target.value)}
                      label="Update Status"
                    >
                      <MenuItem value="reported">Reported</MenuItem>
                      <MenuItem value="acknowledged">Acknowledged</MenuItem>
                      <MenuItem value="in_progress">In Progress</MenuItem>
                      <MenuItem value="resolved">Resolved</MenuItem>
                      <MenuItem value="rejected">Rejected</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <Button 
                    variant="contained" 
                    color="primary"
                    fullWidth 
                    onClick={handleUpdateStatus}
                    disabled={statusUpdating || (!newStatus || newStatus === issue.status)}
                    sx={{ 
                      mt: 1, 
                      py: 1.5, 
                      fontWeight: 'bold',
                      textTransform: 'none',
                      fontSize: '1rem',
                      '&.Mui-disabled': {
                        backgroundColor: 'rgba(144, 202, 249, 0.3) !important',
                        color: 'rgba(255, 255, 255, 0.9) !important',
                        boxShadow: 'none'
                      }
                    }}
                  >
                    {statusUpdating ? <CircularProgress size={24} color="inherit" /> : 'Apply Status Update'}
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="glass-card" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Issue Status
                </Typography>
                <Box display="flex" flexDirection="column" gap={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Current Status
                    </Typography>
                    <Chip
                      label={issue.status}
                      color={getStatusColor(issue.status)}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Priority Level
                    </Typography>
                    <Chip
                      label={issue.priority}
                      color={getPriorityColor(issue.priority)}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Assigned Department
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 1 }}>
                      {getDepartmentForCategory(issue.category)}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Actions and Discussion */}
            <Card sx={{ mt: 3, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }} className="glass-card">
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Vote & Discuss
                </Typography>
                {voteError && (
                  <Alert severity="warning" sx={{ mb: 2 }}>{voteError}</Alert>
                )}
                
                <Box display="flex" gap={2} sx={{ mb: 3 }}>
                  <Button 
                    variant={issue.userVote === 'upvote' ? 'contained' : 'outlined'}
                    color="success" 
                    startIcon={<ThumbUp />} 
                    onClick={() => handleVote('upvote')}
                    sx={{ flexGrow: 1, py: 1, fontWeight: 'bold' }}
                  >
                    Upvote
                  </Button>
                  <Button 
                    variant={issue.userVote === 'downvote' ? 'contained' : 'outlined'}
                    color="error" 
                    startIcon={<ThumbDown />} 
                    onClick={() => handleVote('downvote')}
                    sx={{ flexGrow: 1, py: 1, fontWeight: 'bold' }}
                  >
                    Downvote
                  </Button>
                </Box>

                <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }} />
                
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Send fontSize="small" /> Discussion
                </Typography>
                
                {commentError && (
                  <Alert severity="warning" sx={{ mb: 2 }}>{commentError}</Alert>
                )}
                
                <Box display="flex" gap={1} sx={{ mb: 3 }}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    placeholder="Write a comment..." 
                    value={comment} 
                    onChange={(e) => setComment(e.target.value)} 
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.05)'
                      }
                    }}
                  />
                  <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={handleAddComment}
                    sx={{ px: 3, borderRadius: 2, fontWeight: 'bold' }}
                  >
                    Post
                  </Button>
                </Box>
                
                <Box sx={{ mt: 2, maxHeight: '300px', overflowY: 'auto', pr: 1 }}>
                  {(issue.comments || []).length === 0 ? (
                    <Box sx={{ py: 4, textAlign: 'center' }}>
                      <Typography variant="body1" color="text.secondary">No comments yet. Be the first to start the discussion!</Typography>
                    </Box>
                  ) : (
                    (issue.comments || []).map((c, idx) => (
                      <Paper key={idx} elevation={0} sx={{ p: 2, mb: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                          <Avatar sx={{ width: 24, height: 24, fontSize: '0.8rem', bgcolor: 'primary.main' }}>
                            {(c.author || 'U').charAt(0).toUpperCase()}
                          </Avatar>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.author || 'User'}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                            {new Date(c.created_at).toLocaleDateString()}
                          </Typography>
                        </Box>
                        <Typography variant="body1" sx={{ mt: 1, pl: 4 }}>{c.text}</Typography>
                      </Paper>
                    ))
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default IssueDetailPage;