import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, Card, CardContent } from '@mui/material';
import { Add as AddIcon, LocationOn as LocationIcon } from '@mui/icons-material';

const GoogleMapComponent = ({ 
  center = { lat: 23.6102, lng: 85.2799 }, // Jharkhand center
  zoom = 10,
  onLocationSelect,
  issues = [],
  height = '400px'
}) => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load Google Maps API
    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        initializeMap();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'AIzaSyDASYZd9MwWKIR2Jkzpu88T8EQtO20Jkvw'}&libraries=places&callback=initMap`;
      script.async = true;
      script.defer = true;
      
      window.initMap = initializeMap;
      document.head.appendChild(script);
    };

    loadGoogleMaps();

    return () => {
      // Cleanup
      if (window.initMap) {
        delete window.initMap;
      }
    };
  }, []);

  const initializeMap = () => {
    if (mapRef.current && !map) {
      const newMap = new window.google.maps.Map(mapRef.current, {
        center: center,
        zoom: zoom,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });

      setMap(newMap);
      setIsLoaded(true);

      // Add click listener for location selection
      if (onLocationSelect) {
        newMap.addListener('click', (event) => {
          const location = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng()
          };
          onLocationSelect(location);
        });
      }
    }
  };

  useEffect(() => {
    if (map && issues.length > 0) {
      // Clear existing markers
      markers.forEach(marker => marker.setMap(null));

      const newMarkers = issues.map(issue => {
        const marker = new window.google.maps.Marker({
          position: { lat: issue.latitude, lng: issue.longitude },
          map: map,
          title: issue.title,
          icon: getMarkerIcon(issue.category, issue.priority)
        });

        // Add info window
        const infoWindow = new window.google.maps.InfoWindow({
          content: createInfoWindowContent(issue)
        });

        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        return marker;
      });

      setMarkers(newMarkers);
    }
  }, [map, issues]);

  const getMarkerIcon = (category, priority) => {
    const colors = {
      'electricity': '#FFD700', // Gold
      'water': '#4169E1',       // Royal Blue
      'sanitation': '#32CD32',  // Lime Green
      'roads': '#FF6347',       // Tomato
      'streetlights': '#FFA500', // Orange
      'other': '#9370DB'        // Medium Purple
    };

    const prioritySizes = {
      'low': 20,
      'medium': 25,
      'high': 30,
      'critical': 35
    };

    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      fillColor: colors[category] || colors['other'],
      fillOpacity: 0.8,
      strokeColor: '#FFFFFF',
      strokeWeight: 2,
      scale: prioritySizes[priority] || prioritySizes['medium']
    };
  };

  const createInfoWindowContent = (issue) => {
    return `
      <div style="padding: 10px; max-width: 250px;">
        <h3 style="margin: 0 0 10px 0; color: #1976d2;">${issue.title}</h3>
        <p style="margin: 5px 0; color: #666;">${issue.description}</p>
        <p style="margin: 5px 0; font-size: 12px; color: #888;">
          <strong>Category:</strong> ${issue.category}<br>
          <strong>Priority:</strong> ${issue.priority}<br>
          <strong>Status:</strong> ${issue.status}<br>
          <strong>Upvotes:</strong> ${issue.upvotes || 0}
        </p>
        <p style="margin: 5px 0; font-size: 11px; color: #999;">
          Reported: ${new Date(issue.created_at).toLocaleDateString()}
        </p>
      </div>
    `;
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          if (map) {
            map.setCenter(location);
            map.setZoom(15);
            
            if (onLocationSelect) {
              onLocationSelect(location);
            }
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('Unable to get your location. Please select manually on the map.');
        }
      );
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  };

  return (
    <Box sx={{ width: '100%', height: height, position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      
      {!isLoaded && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            zIndex: 1
          }}
        >
          <Typography>Loading map...</Typography>
        </Box>
      )}

      <Box
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 2
        }}
      >
        <Button
          variant="contained"
          startIcon={<LocationIcon />}
          onClick={getCurrentLocation}
          sx={{ mb: 1 }}
        >
          My Location
        </Button>
      </Box>

      <Card
        sx={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          zIndex: 2,
          maxWidth: 200
        }}
      >
        <CardContent sx={{ p: 1 }}>
          <Typography variant="caption" display="block">
            <strong>Legend:</strong>
          </Typography>
          <Typography variant="caption" display="block">
            🔵 Electricity
          </Typography>
          <Typography variant="caption" display="block">
            🔵 Water
          </Typography>
          <Typography variant="caption" display="block">
            🔵 Sanitation
          </Typography>
          <Typography variant="caption" display="block">
            🔵 Roads
          </Typography>
          <Typography variant="caption" display="block">
            🔵 Streetlights
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default GoogleMapComponent;

