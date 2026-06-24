const axios = require('axios');

class GeolocationService {
  constructor() {
    this.openStreetMapUrl = process.env.OPENSTREETMAP_API_URL || 'https://nominatim.openstreetmap.org';
    this.maxDistanceKm = parseFloat(process.env.MAX_DISTANCE_KM) || 2;
    this.upvoteRadiusKm = parseFloat(process.env.UPVOTE_RADIUS_KM) || 5;
  }

  // Validate geolocation coordinates
  validateCoordinates(latitude, longitude) {
    if (!latitude || !longitude) {
      return { valid: false, error: 'Latitude and longitude are required' };
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      return { valid: false, error: 'Invalid coordinate format' };
    }

    if (lat < -90 || lat > 90) {
      return { valid: false, error: 'Latitude must be between -90 and 90' };
    }

    if (lng < -180 || lng > 180) {
      return { valid: false, error: 'Longitude must be between -180 and 180' };
    }

    // Check if coordinates are within Jharkhand state bounds (approximate)
    if (lat < 21.0 || lat > 25.5 || lng < 83.0 || lng > 87.5) {
      return { valid: false, error: 'Location must be within Jharkhand state' };
    }

    return { valid: true, latitude: lat, longitude: lng };
  }

  // Calculate distance between two points using Haversine formula
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Validate distance between user location and issue location
  validateUserIssueDistance(userLat, userLon, issueLat, issueLon) {
    const distance = this.calculateDistance(userLat, userLon, issueLat, issueLon);
    
    return {
      valid: distance <= this.maxDistanceKm,
      distance: distance,
      maxAllowed: this.maxDistanceKm,
      message: distance <= this.maxDistanceKm 
        ? 'Location validation passed' 
        : `Issue location is ${distance.toFixed(2)}km away from your location. Maximum allowed distance is ${this.maxDistanceKm}km.`
    };
  }

  // Check if user is within upvote radius
  isWithinUpvoteRadius(userLat, userLon, issueLat, issueLon) {
    const distance = this.calculateDistance(userLat, userLon, issueLat, issueLon);
    return distance <= this.upvoteRadiusKm;
  }

  // Reverse geocoding - get address from coordinates
  async getAddressFromCoordinates(latitude, longitude) {
    try {
      const response = await axios.get(`${this.openStreetMapUrl}/reverse`, {
        params: {
          lat: latitude,
          lon: longitude,
          format: 'json',
          addressdetails: 1,
          zoom: 18
        },
        timeout: 10000
      });

      if (response.data && response.data.display_name) {
        const address = response.data;
        return {
          success: true,
          address: {
            displayName: address.display_name,
            houseNumber: address.address?.house_number || '',
            road: address.address?.road || '',
            suburb: address.address?.suburb || '',
            city: address.address?.city || address.address?.town || '',
            state: address.address?.state || 'Jharkhand',
            pincode: address.address?.postcode || '',
            country: address.address?.country || 'India'
          }
        };
      }

      return {
        success: false,
        error: 'Unable to get address information'
      };
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return {
        success: false,
        error: 'Geocoding service unavailable'
      };
    }
  }

  // Forward geocoding - get coordinates from address
  async getCoordinatesFromAddress(address) {
    try {
      const response = await axios.get(`${this.openStreetMapUrl}/search`, {
        params: {
          q: address,
          format: 'json',
          addressdetails: 1,
          limit: 1,
          countrycodes: 'in',
          state: 'Jharkhand'
        },
        timeout: 10000
      });

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        return {
          success: true,
          coordinates: {
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon)
          },
          address: {
            displayName: result.display_name,
            houseNumber: result.address?.house_number || '',
            road: result.address?.road || '',
            suburb: result.address?.suburb || '',
            city: result.address?.city || result.address?.town || '',
            state: result.address?.state || 'Jharkhand',
            pincode: result.address?.postcode || '',
            country: result.address?.country || 'India'
          }
        };
      }

      return {
        success: false,
        error: 'Address not found'
      };
    } catch (error) {
      console.error('Forward geocoding error:', error);
      return {
        success: false,
        error: 'Geocoding service unavailable'
      };
    }
  }

  // Get nearby issues for a given location
  async getNearbyIssues(latitude, longitude, radiusKm = 5, limit = 50) {
    try {
      const { query } = require('../config/database');
      
      const result = await query(`
        SELECT 
          i.*,
          u.first_name || ' ' || u.last_name as reporter_name,
          ST_Distance(
            ST_GeogFromText('POINT(' || $2 || ' ' || $1 || ')'),
            i.location::geography
          ) / 1000 as distance_km
        FROM issues i
        JOIN users u ON i.reporter_id = u.id
        WHERE ST_DWithin(
          i.location::geography,
          ST_GeogFromText('POINT(' || $2 || ' ' || $1 || ')'),
          $3 * 1000
        )
        AND i.status NOT IN ('resolved', 'rejected')
        ORDER BY distance_km ASC
        LIMIT $4
      `, [latitude, longitude, radiusKm, limit]);

      return {
        success: true,
        issues: result.rows,
        count: result.rows.length
      };
    } catch (error) {
      console.error('Nearby issues query error:', error);
      return {
        success: false,
        error: 'Failed to fetch nearby issues'
      };
    }
  }

  // Get user's current location from database
  async getUserCurrentLocation(userId) {
    try {
      const { query } = require('../config/database');
      
      const result = await query(`
        SELECT 
          ST_X(location) as longitude,
          ST_Y(location) as latitude,
          address,
          city,
          state,
          pincode,
          accuracy,
          created_at
        FROM user_locations 
        WHERE user_id = $1 AND is_current = true
        ORDER BY created_at DESC
        LIMIT 1
      `, [userId]);

      if (result.rows.length > 0) {
        return {
          success: true,
          location: result.rows[0]
        };
      }

      return {
        success: false,
        error: 'User location not found'
      };
    } catch (error) {
      console.error('Get user location error:', error);
      return {
        success: false,
        error: 'Failed to get user location'
      };
    }
  }

  // Update user's current location
  async updateUserLocation(userId, latitude, longitude, accuracy = null, address = null) {
    try {
      const { query } = require('../config/database');
      
      // Mark all previous locations as not current
      await query(
        'UPDATE user_locations SET is_current = false WHERE user_id = $1',
        [userId]
      );

      // Insert new location
      const result = await query(`
        INSERT INTO user_locations (user_id, location, address, accuracy, is_current)
        VALUES ($1, ST_GeogFromText('POINT(' || $3 || ' ' || $2 || ')'), $4, $5, true)
        RETURNING id, created_at
      `, [userId, latitude, longitude, address, accuracy]);

      return {
        success: true,
        locationId: result.rows[0].id,
        createdAt: result.rows[0].created_at
      };
    } catch (error) {
      console.error('Update user location error:', error);
      return {
        success: false,
        error: 'Failed to update user location'
      };
    }
  }

  // Validate and process location data for issue submission
  async validateIssueLocation(userId, issueLat, issueLon, userLat = null, userLon = null) {
    try {
      // Validate coordinates
      const coordValidation = this.validateCoordinates(issueLat, issueLon);
      if (!coordValidation.valid) {
        return {
          success: false,
          error: coordValidation.error
        };
      }

      // Get user's current location if not provided
      if (!userLat || !userLon) {
        const userLocation = await this.getUserCurrentLocation(userId);
        if (userLocation.success) {
          userLat = userLocation.location.latitude;
          userLon = userLocation.location.longitude;
        } else {
          return {
            success: false,
            error: 'User location not available. Please enable location services.'
          };
        }
      }

      // Validate distance
      const distanceValidation = this.validateUserIssueDistance(
        userLat, userLon, coordValidation.latitude, coordValidation.longitude
      );

      // Get address information
      const addressInfo = await this.getAddressFromCoordinates(
        coordValidation.latitude, coordValidation.longitude
      );

      return {
        success: distanceValidation.valid,
        coordinates: {
          latitude: coordValidation.latitude,
          longitude: coordValidation.longitude
        },
        distance: distanceValidation.distance,
        address: addressInfo.success ? addressInfo.address : null,
        validation: distanceValidation,
        message: distanceValidation.message
      };
    } catch (error) {
      console.error('Location validation error:', error);
      return {
        success: false,
        error: 'Location validation failed'
      };
    }
  }
}

module.exports = new GeolocationService();
