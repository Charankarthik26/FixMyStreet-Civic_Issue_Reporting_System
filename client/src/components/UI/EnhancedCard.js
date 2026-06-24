import React from 'react';
import { Card, CardContent, CardActions, Box, Typography, Chip, Avatar } from '@mui/material';
import { LocationOn, AccessTime, Person, Category } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const EnhancedCard = ({ 
  title, 
  description, 
  category, 
  status, 
  priority, 
  reporter, 
  createdAt, 
  location,
  ticketNumber,
  onClick,
  elevation = 2,
  sx = {}
}) => {
  const { t } = useTranslation();

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

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'electricity': return '⚡';
      case 'water': return '💧';
      case 'sanitation': return '🧹';
      case 'roads': return '🛣️';
      case 'streetlights': return '💡';
      default: return '📋';
    }
  };

  return (
    <Card 
      elevation={elevation}
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.3s ease-in-out',
        '&:hover': onClick ? {
          elevation: 4,
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
        } : {},
        ...sx
      }}
    >
      <CardContent>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
              {getCategoryIcon(category)}
            </Avatar>
            <Box>
              <Typography variant="h6" component="h3" noWrap>
                {title}
              </Typography>
              {ticketNumber && (
                <Typography variant="caption" color="text.secondary">
                  {t('issues.ticketNumber')}: {ticketNumber}
                </Typography>
              )}
            </Box>
          </Box>
          <Box display="flex" flexDirection="column" gap={0.5} alignItems="flex-end">
            <Chip 
              label={t(`issues.${status}`)} 
              size="small" 
              color={getStatusColor(status)}
              variant="outlined"
            />
            <Chip 
              label={t(`issues.${priority}`)} 
              size="small" 
              color={getPriorityColor(priority)}
              variant="filled"
            />
          </Box>
        </Box>

        {/* Description */}
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ 
            mb: 2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {description}
        </Typography>

        {/* Category */}
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Category fontSize="small" color="action" />
          <Chip 
            label={t(`categories.${category}`)} 
            size="small" 
            variant="outlined"
            color="primary"
          />
        </Box>

        {/* Location */}
        {location && (
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <LocationOn fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary" noWrap>
              {location}
            </Typography>
          </Box>
        )}

        {/* Footer */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <Person fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">
              {reporter}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <AccessTime fontSize="small" color="action" />
            <Typography variant="caption" color="text.secondary">
              {new Date(createdAt).toLocaleDateString()}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default EnhancedCard;


