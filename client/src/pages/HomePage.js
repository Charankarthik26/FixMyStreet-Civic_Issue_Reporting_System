import React, { useState, useEffect, useRef } from 'react';
import { Container, Typography, Box, Button, Grid, Card, CardContent, Stack, Fade, Paper } from '@mui/material';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const civicFacts = [
  "India generates over 62 million tons of municipal solid waste every year.",
  "Proper street lighting can reduce traffic accidents by up to 30% and improve pedestrian safety.",
  "Only 20-30% of sewage generated in Indian cities is treated before entering water bodies.",
  "Potholes and bad road conditions account for thousands of traffic-related accidents annually in India.",
  "Over 30% of the urban population in India lives in informal settlements, making civic tracking vital.",
  "Active citizen participation in civic reporting improves resolution times by over 40%."
];

const HomePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const features = [
    {
      title: t('issue.reportIssue', 'Report Issue'),
      description: 'Report civic issues with photos and location',
      icon: '📱'
    },
    {
      title: t('issue.upvote', 'Vote & Discuss'),
      description: 'Support issues in your community',
      icon: '👍'
    },
    {
      title: t('navigation.map', 'Interactive Map'),
      description: 'View issues on interactive maps',
      icon: '🗺️'
    },
    {
      title: t('admin.dashboard', 'Admin Dashboard'),
      description: 'Track resolution progress',
      icon: '📊'
    }
  ];

  const [currentFact, setCurrentFact] = useState(0);
  const [factVisible, setFactVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFactVisible(false);
      setTimeout(() => {
        setCurrentFact((prev) => (prev + 1) % civicFacts.length);
        setFactVisible(true);
      }, 500); // 500ms fade out duration
    }, 6000); // Change fact every 6 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Scroll reveal on mount and on scroll
  useEffect(() => {
    const revealEls = document.querySelectorAll('.reveal');
    const onScroll = () => {
      const trigger = window.innerHeight * 0.9;
      revealEls.forEach((el) => {
        const top = el.getBoundingClientRect().top;
        if (top < trigger) el.classList.add('revealed');
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Simple parallax for hero heading
  const headingRef = useRef(null);
  useEffect(() => {
    const onScroll = () => {
      if (!headingRef.current) return;
      const y = window.scrollY * 0.05;
      headingRef.current.style.transform = `translateY(${y}px)`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Container maxWidth="lg">
      {/* Hero Section */}
      <Box
        sx={{
          textAlign: 'center',
          py: { xs: 8, md: 12 },
          px: { xs: 2, md: 4 },
          borderRadius: 4,
          background: 'radial-gradient(1000px 300px at 50% -100px, rgba(29,185,84,0.35), rgba(17,24,39,0) 60%)',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="hero-section"
      >
        {/* Floating orbs accents */}
        <Box className="hero-orb orb-1" />
        <Box className="hero-orb orb-2" />
        <Box className="hero-orb orb-3" />
        <Typography
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 900,
            letterSpacing: 0.3,
            lineHeight: 1.1,
            fontSize: { xs: '2.25rem', sm: '2.75rem', md: '3.25rem' },
            color: 'text.primary',
          }}
          className="parallax-slow"
          ref={headingRef}
        >
          FixmyStreet: Report Civic Issues. Get Them Fixed.
        </Typography>
        <Typography
          sx={{
            color: 'text.primary',
            fontSize: { xs: '1rem', sm: '1.125rem', md: '1.25rem' },
          }}
          paragraph
        >
          Simple, transparent, and fast civic issue tracking for your city.
        </Typography>
        <Typography
          sx={{
            color: 'text.primary',
            opacity: 0.9,
            fontSize: { xs: '0.95rem', sm: '1rem' },
          }}
          paragraph
        >
          Snap a photo, add location, and submit. Track progress in real time.
        </Typography>

        {!isAuthenticated && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ mt: 4 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/register')}
            >
              {t('navigation.register')}
            </Button>
            <Button
              variant="outlined"
              color="primary"
              size="large"
              onClick={() => navigate('/login')}
            >
              {t('navigation.login')}
            </Button>
          </Stack>
        )}

        {isAuthenticated && (
          <Box mt={4}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/report')}
              sx={{ mr: 2 }}
            >
              {t('navigation.report')}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/issues')}
            >
              {t('navigation.issues')}
            </Button>
          </Box>
        )}
      </Box>

      {/* Feature Cards */}
      <Grid container spacing={4} py={6} className="reveal">
        {features.map((feature, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card 
              className="feature-card glass-card" 
              sx={{ 
                height: '100%', 
                textAlign: 'center', 
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.05)',
                '&:hover': {
                  transform: 'translateY(-12px)',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.3), 0 0 20px rgba(29,185,84,0.15)',
                  bgcolor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(29,185,84,0.3)',
                }
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h2" component="div" gutterBottom sx={{ 
                  transition: 'transform 0.3s ease',
                  '.feature-card:hover &': { transform: 'scale(1.2)' }
                }}>
                  {feature.icon}
                </Typography>
                <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 700, mt: 2 }}>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  {feature.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Dynamic Civic Facts Section */}
      <Box py={6} px={4} className="reveal" sx={{ 
        bgcolor: 'rgba(29,185,84,0.05)', 
        borderRadius: 4, 
        border: '1px solid rgba(29,185,84,0.1)',
        mb: 6,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Box sx={{
          position: 'absolute', top: '-50%', left: '-10%', width: '120%', height: '200%',
          background: 'radial-gradient(circle, rgba(29,185,84,0.05) 0%, transparent 60%)',
          pointerEvents: 'none', zIndex: 0
        }} />
        <Typography variant="overline" sx={{ color: '#1DB954', fontWeight: 800, letterSpacing: 2, position: 'relative', zIndex: 1 }}>
          Civic Reality Check
        </Typography>
        <Box sx={{ minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <Fade in={factVisible} timeout={500}>
            <Typography variant="h5" sx={{ fontStyle: 'italic', maxWidth: '800px', margin: '0 auto', fontWeight: 300, lineHeight: 1.6 }}>
              "{civicFacts[currentFact]}"
            </Typography>
          </Fade>
        </Box>
      </Box>

      {/* About Section */}
      <Box py={4} className="reveal">
        <Typography variant="h4" gutterBottom align="center">
          About FixmyStreet
        </Typography>
        <Typography variant="body1" color="text.primary" align="center" sx={{ opacity: 0.9 }}>
          FixmyStreet makes city services responsive and citizen-centric by enabling
          quick reporting, transparent tracking, and data-driven prioritization of civic issues.
        </Typography>
      </Box>

      {/* How It Works */}
      <Box textAlign="center" py={8} className="reveal">
        <Typography variant="h3" gutterBottom sx={{ fontWeight: 800, mb: 6 }}>
          How It Works
        </Typography>
        <Grid container spacing={4} mt={2}>
          {[
            {
              title: "Register & Verify",
              desc: "Create account with Aadhar verification for authenticity",
              icon: <HowToRegIcon sx={{ fontSize: 48, color: '#1DB954' }} />,
              step: "01"
            },
            {
              title: "Report Issues",
              desc: "Upload photos and location of civic problems",
              icon: <AddAPhotoIcon sx={{ fontSize: 48, color: '#1DB954' }} />,
              step: "02"
            },
            {
              title: "Track Progress",
              desc: "Monitor resolution status and get updates",
              icon: <AutorenewIcon sx={{ fontSize: 48, color: '#1DB954' }} />,
              step: "03"
            }
          ].map((item, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  height: '100%',
                  borderRadius: 4,
                  bgcolor: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.4s ease',
                  '&:hover': {
                    transform: 'translateY(-10px)',
                    bgcolor: 'rgba(29,185,84,0.05)',
                    border: '1px solid rgba(29,185,84,0.3)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    '& .step-icon': {
                      transform: 'scale(1.1) rotate(5deg)',
                      filter: 'drop-shadow(0 0 12px rgba(29,185,84,0.6))'
                    }
                  }
                }}
              >
                <Typography 
                  variant="h1" 
                  sx={{ 
                    position: 'absolute', 
                    top: -10, 
                    right: 10, 
                    fontWeight: 900, 
                    color: 'rgba(255,255,255,0.03)', 
                    fontSize: '8rem',
                    zIndex: 0,
                    pointerEvents: 'none'
                  }}
                >
                  {item.step}
                </Typography>
                
                <Box className="step-icon" sx={{ transition: 'all 0.4s ease', mb: 3, position: 'relative', zIndex: 1 }}>
                  {item.icon}
                </Box>
                
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, position: 'relative', zIndex: 1 }}>
                  {item.title}
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.6, position: 'relative', zIndex: 1 }}>
                  {item.desc}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Container>
  );
};

export default HomePage;
