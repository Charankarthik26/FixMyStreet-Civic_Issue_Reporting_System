import React from 'react';
import { Container, Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

const ProfilePage = () => {
  const { t } = useTranslation();

  return (
    <Container maxWidth="md">
      <Box py={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('navigation.profile')}
        </Typography>
        <Typography variant="body1">
          User profile will be implemented here.
        </Typography>
      </Box>
    </Container>
  );
};

export default ProfilePage;
