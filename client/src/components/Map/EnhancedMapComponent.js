import React, { useState, useEffect, useRef } from 'react';
import { Box, Paper, Typography, Button, TextField, Autocomplete, Chip } from '@mui/material';
import { LocationOn, MyLocation, Search } from '@mui/icons-material';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';

const libraries = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '8px'
};

const defaultCenter = {
  lat: 23.6102, // Ranchi, Jharkhand
  lng: 85.2799
};

// Lazily create marker icons only after Google Maps script has loaded to avoid
// accessing window.google before it's available in the browser.
const getCategoryIcon = (category) => {
  if (!window.google || !window.google.maps) {
    return undefined; // fallback to default marker until API is ready
  }

  const scaledSize = new window.google.maps.Size(32, 32);

  const svgs = {
    electricity: `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#FFD700" stroke="#FFA500" stroke-width="2"/>
        <path d="M12 8l8 8h-6v8l-8-8h6v-8z" fill="#FF4500"/>
      </svg>
    `,
    water: `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#87CEEB" stroke="#4682B4" stroke-width="2"/>
        <path d="M16 6c-3 0-6 3-6 6 0 4 6 10 6 10s6-6 6-10c0-3-3-6-6-6z" fill="#1E90FF"/>
      </svg>
    `,
    sanitation: `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#90EE90" stroke="#32CD32" stroke-width="2"/>
        <rect x="8" y="12" width="16" height="8" rx="2" fill="#228B22"/>
        <rect x="10" y="14" width="2" height="4" fill="#006400"/>
        <rect x="20" y="14" width="2" height="4" fill="#006400"/>
      </svg>
    `,
    roads: `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#D2B48C" stroke="#8B4513" stroke-width="2"/>
        <rect x="6" y="14" width="20" height="4" fill="#654321"/>
        <rect x="8" y="16" width="16" height="2" fill="#8B4513"/>
      </svg>
    `,
    streetlights: `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#FFE4B5" stroke="#DAA520" stroke-width="2"/>
        <rect x="15" y="8" width="2" height="12" fill="#8B4513"/>
        <circle cx="16" cy="8" r="3" fill="#FFD700"/>
      </svg>
    `,
    other: `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="14" fill="#DDA0DD" stroke="#9370DB" stroke-width="2"/>
        <path d="M16 8l4 8h-8l4-8z" fill="#8A2BE2"/>
        <rect x="14" y="16" width="4" height="8" fill="#8A2BE2"/>
      </svg>
    `
  };

  const svg = svgs[category] || svgs.other;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize
  };
};

const EnhancedMapComponent = ({ 
  onLocationSelect, 
  selectedLocation, 
  category = 'other',
  issues = [],
  readOnly = false 
}) => {
  const { t } = useTranslation();
  const [map, setMap] = useState(null);
  const [center, setCenter] = useState(defaultCenter);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [autocompleteService, setAutocompleteService] = useState(null);
  const [placesService, setPlacesService] = useState(null);
  const searchInputRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries
  });

  useEffect(() => {
    if (isLoaded && map) {
      setAutocompleteService(new window.google.maps.places.AutocompleteService());
      setPlacesService(new window.google.maps.places.PlacesService(map));
    }
  }, [isLoaded, map]);

  useEffect(() => {
    if (selectedLocation) {
      setCenter(selectedLocation);
    }
  }, [selectedLocation]);

  const handleMapClick = (event) => {
    if (readOnly) return;
    
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const newLocation = { lat, lng };
    
    setCenter(newLocation);
    onLocationSelect(newLocation);
    
    // Reverse geocoding to get address
    if (placesService) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: newLocation }, (results, status) => {
        if (status === 'OK' && results[0]) {
          onLocationSelect({
            ...newLocation,
            address: results[0].formatted_address
          });
        }
      });
    }
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCenter(newLocation);
          onLocationSelect(newLocation);
        },
        (error) => {
          console.error('Error getting current location:', error);
        }
      );
    }
  };

  const handleSearch = (value) => {
    setSearchValue(value);
    if (autocompleteService && value.length > 2) {
      autocompleteService.getPlacePredictions(
        {
          input: value,
          componentRestrictions: { country: 'in' }, // Restrict to India
          types: ['establishment', 'geocode']
        },
        (predictions, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            setSearchResults(predictions || []);
          }
        }
      );
    } else {
      setSearchResults([]);
    }
  };

  const handlePlaceSelect = (place) => {
    if (placesService) {
      placesService.getDetails(
        { placeId: place.place_id },
        (placeDetails, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            const location = {
              lat: placeDetails.geometry.location.lat(),
              lng: placeDetails.geometry.location.lng(),
              address: placeDetails.formatted_address
            };
            setCenter(location);
            onLocationSelect(location);
            setSearchValue(placeDetails.formatted_address);
            setSearchResults([]);
          }
        }
      );
    }
  };

  const onLoad = (mapInstance) => {
    setMap(mapInstance);
  };

  if (!isLoaded) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <Typography>{t('map.loading')}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Search Bar */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={1} alignItems="center">
          <Search color="action" />
          <Autocomplete
            freeSolo
            options={searchResults}
            getOptionLabel={(option) => 
              typeof option === 'string' ? option : option.description
            }
            value={searchValue}
            onChange={(event, newValue) => {
              if (newValue && typeof newValue === 'object') {
                handlePlaceSelect(newValue);
              }
            }}
            onInputChange={(event, newInputValue) => {
              handleSearch(newInputValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                placeholder={t('map.searchPlaceholder')}
                variant="outlined"
                size="small"
              />
            )}
            renderOption={(props, option) => (
              <li {...props}>
                <LocationOn sx={{ mr: 1, color: 'text.secondary' }} />
                {option.description}
              </li>
            )}
          />
          <Button
            variant="outlined"
            startIcon={<MyLocation />}
            onClick={handleCurrentLocation}
            size="small"
          >
            {t('map.currentLocation')}
          </Button>
        </Box>
      </Paper>

      {/* Map */}
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={15}
        onLoad={onLoad}
        onClick={handleMapClick}
        options={{
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true,
          zoomControl: true,
          clickableIcons: true
        }}
      >
        {/* Selected Location Marker */}
        {selectedLocation && (
          <Marker
            position={selectedLocation}
            icon={getCategoryIcon(category)}
            onClick={() => setSelectedMarker(selectedLocation)}
          />
        )}

        {/* Existing Issues Markers */}
        {issues.map((issue) => (
          <Marker
            key={issue.id}
            position={{ lat: issue.latitude, lng: issue.longitude }}
            icon={getCategoryIcon(issue.category)}
            onClick={() => setSelectedMarker(issue)}
          />
        ))}

        {/* Info Window */}
        {selectedMarker && (
          <InfoWindow
            position={
              selectedMarker.lat ? 
                { lat: selectedMarker.lat, lng: selectedMarker.lng } :
                { lat: selectedMarker.latitude, lng: selectedMarker.longitude }
            }
            onCloseClick={() => setSelectedMarker(null)}
          >
            <Box>
              {selectedMarker.title ? (
                // Issue marker
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {selectedMarker.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedMarker.description}
                  </Typography>
                  <Box mt={1}>
                    <Chip 
                      label={t(`categories.${selectedMarker.category}`)} 
                      size="small" 
                      color="primary"
                    />
                  </Box>
                </Box>
              ) : (
                // Location marker
                <Box>
                  <Typography variant="h6" gutterBottom>
                    {t('map.selectedLocation')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedMarker.address || `${selectedMarker.lat?.toFixed(6)}, ${selectedMarker.lng?.toFixed(6)}`}
                  </Typography>
                </Box>
              )}
            </Box>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Location Info */}
      {selectedLocation && (
        <Paper elevation={1} sx={{ p: 2, mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            {t('map.selectedLocation')}:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedLocation.address || `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`}
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default EnhancedMapComponent;


