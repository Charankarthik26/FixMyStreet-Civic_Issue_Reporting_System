import React, { useState, useEffect } from 'react';
import { 
  AppBar, Toolbar, Typography, Button, Box, Container, IconButton, 
  Tooltip, Avatar, Menu, MenuItem, Divider, ListItemIcon,
  Drawer, List, ListItem, ListItemButton, ListItemText 
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import EmailIcon from '@mui/icons-material/Email';
import MenuIcon from '@mui/icons-material/Menu';
import MapIcon from '@mui/icons-material/Map';
import HomeIcon from '@mui/icons-material/Home';
import BugReportIcon from '@mui/icons-material/BugReport';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PlaceIcon from '@mui/icons-material/Place';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import LanguageSelector from '../LanguageSelector';
import { styled, useTheme } from '@mui/material/styles';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useThemeContext } from '../../contexts/ThemeContext';

const NavButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'active',
})(({ theme, active }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    borderRadius: '12px',
    padding: '6px 16px',
    textTransform: 'none',
    fontWeight: 600,
    letterSpacing: '0.3px',
    color: active 
      ? (isDark ? '#fff' : '#111827') 
      : (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'),
    background: active 
      ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') 
      : 'transparent',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    border: '1px solid transparent',
    '&:hover': {
      background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
      color: isDark ? '#fff' : '#000',
      transform: 'translateY(-2px)',
      border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.1)',
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.15)' : '0 4px 12px rgba(0,0,0,0.05)'
    },
    '&:active': {
      transform: 'translateY(0)',
    }
  };
});

const InteractiveToggleButton = styled(Button)(({ theme }) => ({
  minWidth: 'unset',
  width: 44,
  height: 44,
  borderRadius: '14px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
  color: theme.palette.mode === 'dark' ? '#fff' : '#111827',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  border: theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
  boxShadow: theme.palette.mode === 'dark' ? 'inset 0 2px 4px rgba(255,255,255,0.05)' : 'inset 0 2px 4px rgba(255,255,255,0.5), 0 2px 5px rgba(0,0,0,0.05)',
  overflow: 'hidden',
  position: 'relative',
  '&:hover': {
    transform: 'translateY(-2px)',
    background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
    boxShadow: theme.palette.mode === 'dark' ? '0 6px 12px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.1)' : '0 6px 12px rgba(0,0,0,0.1), inset 0 2px 4px rgba(255,255,255,0.8)',
  },
  '&:active': {
    transform: 'scale(0.92)',
    boxShadow: 'none',
  },
  '& svg': {
    transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s',
    position: 'absolute',
  }
}));

const ScrambleText = ({ text }) => {
  const [displayText, setDisplayText] = useState(text);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!<>-_\\\\/[]{}—=+*^?#________';
  const intervalRef = React.useRef(null);

  const scramble = () => {
    let iteration = 0;
    clearInterval(intervalRef.current);
    
    intervalRef.current = setInterval(() => {
      setDisplayText(
        text.split('').map((letter, index) => {
          if (index < iteration) {
            return text[index];
          }
          return chars[Math.floor(Math.random() * chars.length)];
        }).join('')
      );
      
      if (iteration >= text.length) {
        clearInterval(intervalRef.current);
      }
      
      iteration += 1 / 3;
    }, 30);
  };

  React.useEffect(() => {
    const timer = setTimeout(scramble, 500);
    const loop = setInterval(scramble, 12000);
    return () => {
      clearTimeout(timer);
      clearInterval(loop);
      clearInterval(intervalRef.current);
    };
  }, [text]);

  return (
    <Box 
      component="span" 
      onMouseEnter={scramble} 
      sx={{ 
        fontFamily: '"Fira Code", "Source Code Pro", monospace', 
        color: 'primary.main',
        cursor: 'crosshair',
        fontWeight: 600,
        display: 'inline-block',
        transition: 'text-shadow 0.3s ease',
        '&:hover': { textShadow: '0 0 12px rgba(29,185,84,0.8)' }
      }}
    >
      {displayText}
    </Box>
  );
};

const Layout = ({ children }) => {
  const { t } = useTranslation();
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleTheme } = useThemeContext();
  const muiTheme = useTheme();
  const [profileMenuAnchor, setProfileMenuAnchor] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isProfileMenuOpen = Boolean(profileMenuAnchor);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleOpenProfileMenu = (event) => {
    setProfileMenuAnchor(event.currentTarget);
  };

  const handleCloseProfileMenu = () => {
    setProfileMenuAnchor(null);
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const navigateAndClose = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setHasScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const drawerContent = (
    <Box sx={{ textAlign: 'center', bgcolor: 'background.paper', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ my: 3, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            mr: 1,
            borderRadius: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0B1220',
          }}
        >
          <PlaceIcon sx={{ color: '#1DB954' }} fontSize="small" />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.4 }}>
          FixmyStreet
        </Typography>
      </Box>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={() => navigateAndClose('/')}>
            <ListItemIcon><HomeIcon /></ListItemIcon>
            <ListItemText primary={t('navigation.home')} />
          </ListItemButton>
        </ListItem>
        
        {isAuthenticated ? (
          <>
            {user?.role === 'user' && (
              <>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => navigateAndClose('/my-issues')}>
                    <ListItemIcon><DashboardIcon /></ListItemIcon>
                    <ListItemText primary={t('navigation.myIssues')} />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton onClick={() => navigateAndClose('/report')}>
                    <ListItemIcon><BugReportIcon /></ListItemIcon>
                    <ListItemText primary={t('navigation.report')} />
                  </ListItemButton>
                </ListItem>
              </>
            )}
            {(user?.role === 'admin' || user?.role === 'super_admin') && (
              <ListItem disablePadding>
                <ListItemButton onClick={() => navigateAndClose('/admin')}>
                  <ListItemIcon><DashboardIcon /></ListItemIcon>
                  <ListItemText primary={t('admin.dashboard')} />
                </ListItemButton>
              </ListItem>
            )}
            <ListItem disablePadding>
              <ListItemButton onClick={() => navigateAndClose('/issues')}>
                <ListItemIcon><ListAltIcon /></ListItemIcon>
                <ListItemText primary={t('navigation.issues')} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => navigateAndClose('/map')}>
                <ListItemIcon><MapIcon /></ListItemIcon>
                <ListItemText primary={t('navigation.map')} />
              </ListItemButton>
            </ListItem>
          </>
        ) : (
          <>
            <ListItem disablePadding>
              <ListItemButton onClick={() => navigateAndClose('/map')}>
                <ListItemIcon><MapIcon /></ListItemIcon>
                <ListItemText primary={t('navigation.map')} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => navigateAndClose('/login')}>
                <ListItemIcon><LoginIcon /></ListItemIcon>
                <ListItemText primary={t('navigation.login')} />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton onClick={() => navigateAndClose('/register')}>
                <ListItemIcon><PersonAddIcon /></ListItemIcon>
                <ListItemText primary={t('navigation.register')} />
              </ListItemButton>
            </ListItem>
          </>
        )}
      </List>

      {/* Settings section pushed to the bottom of mobile drawer */}
      <Box sx={{ mt: 'auto', p: 3, borderTop: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.02)' }}>
        <Box display="flex" alignItems="center" gap={1.5} mb={2.5} width="100%" justifyContent="center">
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Language:
          </Typography>
          <LanguageSelector />
        </Box>
        <Box display="flex" alignItems="center" gap={2.5} width="100%" justifyContent="center">
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Theme:
          </Typography>
          <InteractiveToggleButton 
            onClick={(e) => toggleTheme(e.clientX, e.clientY)} 
            sx={{ border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <LightModeIcon sx={{ opacity: mode === 'dark' ? 1 : 0, transform: mode === 'dark' ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0)' }} />
            <DarkModeIcon sx={{ opacity: mode === 'light' ? 1 : 0, transform: mode === 'light' ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0)' }} />
          </InteractiveToggleButton>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar 
        position="sticky" 
        elevation={0} 
        sx={{
          background: hasScrolled 
            ? (muiTheme.palette.mode === 'dark' ? 'rgba(11, 15, 25, 0.75)' : 'rgba(255, 255, 255, 0.85)')
            : (muiTheme.palette.mode === 'dark' ? 'rgba(29, 185, 84, 0.1)' : 'rgba(29, 185, 84, 0.05)'),
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: hasScrolled 
            ? (muiTheme.palette.mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)')
            : '1px solid transparent',
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: hasScrolled 
            ? (muiTheme.palette.mode === 'dark' ? '0 8px 32px rgba(0, 0, 0, 0.3)' : '0 4px 16px rgba(0, 0, 0, 0.05)')
            : 'none',
          color: muiTheme.palette.mode === 'dark' ? '#fff' : '#111827'
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 60, md: 80 }, py: { xs: 0.5, md: 1.5 }, px: { xs: 2, md: 3 } }}>
          
          {/* Mobile Menu Icon */}
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo */}
          <Box 
            display="flex" 
            alignItems="center" 
            onClick={() => navigate('/')}
            sx={{ 
              flexGrow: { xs: 1, md: 0 }, 
              mr: { md: 4 },
              cursor: 'pointer',
              '&:hover .logo-icon': {
                transform: 'scale(1.1) rotate(-8deg)',
                boxShadow: '0 12px 28px rgba(29,185,84,0.4)',
              },
              '&:hover .logo-text': {
                background: 'linear-gradient(90deg, #1DB954 0%, #4ED17A 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                transform: 'translateX(2px)'
              }
            }}
          >
            <Box
              className="logo-icon"
              sx={{
                width: 42,
                height: 42,
                mr: 1.5,
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1DB954 0%, #149943 100%)',
                boxShadow: '0 8px 20px rgba(29,185,84,0.25)',
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              <PlaceIcon sx={{ color: '#fff' }} fontSize="medium" />
            </Box>
            <Typography 
              className="logo-text"
              variant="h5" 
              component="div" 
              sx={{ 
                fontWeight: 900, 
                letterSpacing: '-0.5px', 
                display: 'block',
                background: muiTheme.palette.mode === 'dark' 
                  ? 'linear-gradient(90deg, #ffffff 0%, #a1a1aa 100%)' 
                  : 'linear-gradient(90deg, #111827 0%, #4b5563 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                transition: 'all 0.3s ease'
              }}
            >
              FixmyStreet
            </Typography>
          </Box>

          {/* Desktop Navigation */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, flexGrow: 1, alignItems: 'center', gap: 1 }}>
            {isAuthenticated ? (
              <>
                <NavButton active={location.pathname === '/'} onClick={() => navigate('/')} startIcon={<HomeIcon />}>{t('navigation.home')}</NavButton>
                {user?.role === 'user' && (
                  <>
                    <Tooltip title={t('navigation.myIssues')}>
                      <NavButton active={location.pathname === '/my-issues'} onClick={() => navigate('/my-issues')} startIcon={<DashboardIcon />}>{t('navigation.myIssues')}</NavButton>
                    </Tooltip>
                    <Tooltip title={t('navigation.report')}>
                      <NavButton active={location.pathname === '/report'} onClick={() => navigate('/report')} startIcon={<BugReportIcon />}>{t('navigation.report')}</NavButton>
                    </Tooltip>
                  </>
                )}
                {(user?.role === 'admin' || user?.role === 'super_admin') && (
                  <NavButton active={location.pathname === '/admin'} onClick={() => navigate('/admin')} startIcon={<DashboardIcon />}>{t('admin.dashboard')}</NavButton>
                )}
                <NavButton active={location.pathname === '/issues'} onClick={() => navigate('/issues')} startIcon={<ListAltIcon />}>{t('navigation.issues')}</NavButton>
                <NavButton active={location.pathname === '/map'} onClick={() => navigate('/map')} startIcon={<MapIcon />}>{t('navigation.map')}</NavButton>
              </>
            ) : (
              <>
                <NavButton active={location.pathname === '/'} onClick={() => navigate('/')} startIcon={<HomeIcon />}>{t('navigation.home')}</NavButton>
                <NavButton active={location.pathname === '/map'} onClick={() => navigate('/map')} startIcon={<MapIcon />}>{t('navigation.map')}</NavButton>
              </>
            )}
          </Box>

          {/* Right side items */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            
            {/* Theme Toggle Button */}
            <InteractiveToggleButton 
              onClick={(e) => toggleTheme(e.clientX, e.clientY)} 
              sx={{ ml: 1, display: { xs: 'none', md: 'inline-flex' } }}
            >
              <LightModeIcon sx={{ opacity: mode === 'dark' ? 1 : 0, transform: mode === 'dark' ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0)' }} />
              <DarkModeIcon sx={{ opacity: mode === 'light' ? 1 : 0, transform: mode === 'light' ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0)' }} />
            </InteractiveToggleButton>

            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
              <LanguageSelector />
            </Box>

            {!isAuthenticated && (
              <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
                <Button className="glass-btn" color="inherit" onClick={() => navigate('/login')}>{t('navigation.login')}</Button>
                <Button variant="contained" color="secondary" onClick={() => navigate('/register')} sx={{ borderRadius: 8 }}>{t('navigation.register')}</Button>
              </Box>
            )}

            {isAuthenticated && (
              <>
                <IconButton onClick={handleOpenProfileMenu} color="inherit" aria-label="Open profile menu" sx={{ ml: 1, p: 0.5, border: '2px solid rgba(255,255,255,0.2)' }}>
                  <Avatar 
                    src={user?.profileImage ? (user.profileImage.startsWith('http') ? user.profileImage : `http://localhost:5000${user.profileImage}`) : null}
                    sx={{ width: 34, height: 34, bgcolor: 'secondary.main', color: 'secondary.contrastText', fontSize: 15, fontWeight: 'bold' }}
                  >
                    {(user?.first_name?.[0] || user?.firstName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                  </Avatar>
                </IconButton>
                <Menu
                  anchorEl={profileMenuAnchor}
                  open={isProfileMenuOpen}
                  onClose={handleCloseProfileMenu}
                  onClick={handleCloseProfileMenu}
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                  PaperProps={{
                    elevation: 4,
                    sx: { mt: 1.5, minWidth: 200, borderRadius: 2 }
                  }}
                >
                  <MenuItem disabled sx={{ opacity: '1 !important', py: 1.5 }}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        {(user?.first_name && user?.last_name) ? `${user.first_name} ${user.last_name}` : (user?.firstName && user?.lastName) ? `${user.firstName} ${user.lastName}` : 'Profile'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                        {user?.email}
                      </Typography>
                      {user?.role && (
                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem', mt: 0.5, display: 'inline-block', bgcolor: 'primary.50', px: 1, py: 0.25, borderRadius: 1 }}>
                          {String(user.role).replace('_', ' ')}
                        </Typography>
                      )}
                    </Box>
                  </MenuItem>
                  <Divider />
                  <MenuItem onClick={() => navigate('/profile')}>
                    <ListItemIcon><AccountCircleIcon fontSize="small" /></ListItemIcon>
                    {t('navigation.profile')}
                  </MenuItem>
                  <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                    <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
                    {t('navigation.logout')}
                  </MenuItem>
                </Menu>
              </>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }} // Better open performance on mobile.
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 250 },
        }}
      >
        {drawerContent}
      </Drawer>

      <Container key={location.pathname} component="main" maxWidth="xl" sx={{ flexGrow: 1, py: { xs: 2, md: 3 } }} className="route-fade">
        {children}
      </Container>

      <Box component="footer" sx={{ 
        mt: 'auto', 
        py: 6, 
        bgcolor: muiTheme.palette.mode === 'dark' ? 'rgba(11, 15, 25, 0.8)' : 'rgba(255, 255, 255, 0.8)', 
        borderTop: muiTheme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}>
        <Container maxWidth="xl">
          <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'center', md: 'flex-start' }} justifyContent="space-between" gap={4}>
            
            <Box textAlign={{ xs: 'center', md: 'left' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: 'text.primary' }}>
                FixmyStreet
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                Report, track, and fix civic issues faster.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', md: 'flex-start' }, gap: 1 }}>
                Developed and debugged with <Box component="span" sx={{ color: '#ef4444', animation: 'pulse 2s infinite' }}>❤</Box>
              </Typography>
            </Box>

            <Box textAlign={{ xs: 'center', md: 'right' }}>
              <Typography variant="body1" sx={{ mb: 1, color: 'text.secondary' }}>
                Developed by <ScrambleText text="Charan Karthik" />, <ScrambleText text="Asma Fathima" /> and <ScrambleText text="Chandru" />
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.7 }}>
                © {new Date().getFullYear()} FixmyStreet. Built for Smart India Hackathon
              </Typography>
            </Box>

          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default Layout;
