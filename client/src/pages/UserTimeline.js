import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Assignment,
  TrendingUp,
  CheckCircle,
  Schedule,
  Warning,
  Add,
  Send,
  Refresh,
  FilterList
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const UserTimeline = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: 'all'
  });
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    fetchMyIssues();
  }, [filters]);

  const fetchMyIssues = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams();
      
      if (filters.status !== 'all') queryParams.append('status', filters.status);
      
      const response = await fetch(`/api/user-timeline/my-issues?${queryParams}`, {
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

  const fetchIssueTimeline = async (issueId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/user-timeline/issues/${issueId}/timeline`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (response.ok) {
        setSelectedIssue(data);
      } else {
        throw new Error(data.message || 'Failed to fetch issue timeline');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddComment = async (issueId) => {
    if (!newComment.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/user-timeline/issues/${issueId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ comment: newComment })
      });
      const data = await response.json();
      
      if (response.ok) {
        setNewComment('');
        // Refresh the timeline
        fetchIssueTimeline(issueId);
      } else {
        throw new Error(data.message || 'Failed to add comment');
      }
    } catch (err) {
      setError(err.message);
    }
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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'reported': return <Assignment />;
      case 'acknowledged': return <Schedule />;
      case 'in_progress': return <TrendingUp />;
      case 'resolved': return <CheckCircle />;
      case 'rejected': return <Warning />;
      default: return <Assignment />;
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimelineSteps = (timeline) => {
    const hasRejected = timeline.some(entry => entry.new_status === 'rejected');
    const statusOrder = ['reported', 'acknowledged', 'in_progress', hasRejected ? 'rejected' : 'resolved'];
    const steps = [];
    
    statusOrder.forEach(status => {
      const timelineEntry = timeline.find(entry => entry.new_status === status);
      if (timelineEntry) {
        steps.push({
          label: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
          description: timelineEntry.description,
          timestamp: timelineEntry.created_at,
          user: timelineEntry.user_name,
          completed: true
        });
      }
    });
    
    return steps;
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
            My Issues & Timeline
          </Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={fetchMyIssues}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate('/report')}
            >
              Report New Issue
            </Button>
          </Box>
        </Box>

        {/* Error Message */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <FilterList />
              <Typography variant="h6">Filters</Typography>
            </Box>
            <Grid container spacing={2}>
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
            </Grid>
          </CardContent>
        </Card>

        <Grid container spacing={3}>
          {/* Issues List */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              My Issues ({issues.length})
            </Typography>
            
            {issues.length === 0 ? (
              <Card>
                <CardContent>
                  <Box textAlign="center" py={4}>
                    <Typography variant="h6" color="text.secondary">
                      No issues found
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {filters.status !== 'all'
                        ? 'Try adjusting your filters'
                        : 'You haven\'t reported any issues yet!'
                      }
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            ) : (
              <Box display="flex" flexDirection="column" gap={2}>
                {issues.map((issue) => (
                  <Card 
                    key={issue.id} 
                    sx={{ 
                      cursor: 'pointer',
                      border: selectedIssue?.issue?.id === issue.id ? 2 : 1,
                      borderColor: selectedIssue?.issue?.id === issue.id ? 'primary.main' : 'divider'
                    }}
                    onClick={() => fetchIssueTimeline(issue.id)}
                  >
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
                        </Box>
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Ticket: {issue.ticket_number}
                      </Typography>

                      <Box display="flex" alignItems="center" gap={1}>
                        {getStatusIcon(issue.status)}
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(issue.created_at)}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Grid>

          {/* Timeline View */}
          <Grid item xs={12} md={6}>
            {selectedIssue ? (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Timeline: {selectedIssue.issue.title}
                </Typography>
                
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Issue Details
                    </Typography>
                    <Box display="flex" gap={1} mb={2}>
                      <Chip
                        label={selectedIssue.issue.category}
                        color={getCategoryColor(selectedIssue.issue.category)}
                        size="small"
                      />
                      <Chip
                        label={selectedIssue.issue.status}
                        color={getStatusColor(selectedIssue.issue.status)}
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Ticket: {selectedIssue.issue.ticket_number}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Department: {selectedIssue.issue.department_name || 'Not assigned'}
                    </Typography>

                    {selectedIssue.issue.status === 'rejected' && selectedIssue.issue.rejection_reason && (
                      <Box mt={2}>
                        <Alert severity="error" className="glass-panel">
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Rejection Reason:</Typography>
                          <Typography variant="body2">{selectedIssue.issue.rejection_reason}</Typography>
                        </Alert>
                      </Box>
                    )}
                  </CardContent>
                </Card>

                {/* Timeline Stepper */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Progress Timeline
                    </Typography>
                    <Stepper orientation="vertical">
                      {getTimelineSteps(selectedIssue.timeline).map((step, index) => (
                        <Step key={index} completed={step.completed}>
                          <StepLabel>{step.label}</StepLabel>
                          <StepContent>
                            <Typography variant="body2" color="text.secondary">
                              {step.description}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(step.timestamp)} by {step.user}
                            </Typography>
                          </StepContent>
                        </Step>
                      ))}
                    </Stepper>
                  </CardContent>
                </Card>

                {/* Comments Section */}
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      Comments
                    </Typography>
                    
                    {/* Add Comment */}
                    <Box display="flex" gap={1} mb={2}>
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        size="small"
                      />
                      <Button
                        variant="contained"
                        startIcon={<Send />}
                        onClick={() => handleAddComment(selectedIssue.issue.id)}
                        disabled={!newComment.trim()}
                      >
                        Send
                      </Button>
                    </Box>

                    {/* Comments List */}
                    {selectedIssue.comments.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No comments yet
                      </Typography>
                    ) : (
                      <Box display="flex" flexDirection="column" gap={2}>
                        {selectedIssue.comments.map((comment) => (
                          <Paper key={comment.id} sx={{ p: 2 }}>
                            <Typography variant="body2">
                              {comment.comment}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(comment.created_at)} by {comment.commenter_name}
                            </Typography>
                          </Paper>
                        ))}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Box>
            ) : (
              <Card>
                <CardContent>
                  <Box textAlign="center" py={4}>
                    <Typography variant="h6" color="text.secondary">
                      Select an issue to view timeline
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Click on any issue from the list to see its progress and timeline
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default UserTimeline;
