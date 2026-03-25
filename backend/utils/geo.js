const geolib = require('geolib');

// Calculate distance between two points in kilometers
const calculateDistance = (point1, point2) => {
  const distanceInMeters = geolib.getDistance(
    { latitude: point1.latitude, longitude: point1.longitude },
    { latitude: point2.latitude, longitude: point2.longitude }
  );
  return distanceInMeters / 1000; // Convert to km
};

// Find points within radius (calculate distance once per point)
const findWithinRadius = (centerPoint, points, radiusKm) => {
  return points
    .map(point => ({
      ...point,
      distance: calculateDistance(centerPoint, point),
    }))
    .filter(point => point.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
};

// Calculate ETA based on distance and average speed
const calculateETA = (distanceKm, averageSpeedKmh = 40) => {
  const timeInHours = distanceKm / averageSpeedKmh;
  const timeInMinutes = Math.ceil(timeInHours * 60);

  if (timeInMinutes < 60) {
    return `${timeInMinutes} min`;
  } else {
    const hours = Math.floor(timeInMinutes / 60);
    const mins = timeInMinutes % 60;
    return `${hours}h ${mins}m`;
  }
};

// Format distance for display
const formatDistance = (distanceKm) => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
};

// Get bounding box for a center point and radius
const getBoundingBox = (centerPoint, radiusKm) => {
  const bounds = geolib.getBoundsOfDistance(
    { latitude: centerPoint.latitude, longitude: centerPoint.longitude },
    radiusKm * 1000
  );
  return {
    minLat: bounds[0].latitude,
    minLng: bounds[0].longitude,
    maxLat: bounds[1].latitude,
    maxLng: bounds[1].longitude,
  };
};

// Check if point is within bounds
const isWithinBounds = (point, bounds) => {
  return (
    point.latitude >= bounds.minLat &&
    point.latitude <= bounds.maxLat &&
    point.longitude >= bounds.minLng &&
    point.longitude <= bounds.maxLng
  );
};

// Get center point of multiple locations
const getCenterPoint = (points) => {
  if (!points || points.length === 0) return null;

  const center = geolib.getCenter(
    points.map(p => ({ latitude: p.latitude, longitude: p.longitude }))
  );

  return center;
};

// Sort locations by distance from a point
const sortByDistance = (centerPoint, locations) => {
  return locations
    .map(location => ({
      ...location,
      distance: calculateDistance(centerPoint, {
        latitude: location.latitude,
        longitude: location.longitude,
      }),
    }))
    .sort((a, b) => a.distance - b.distance);
};

module.exports = {
  calculateDistance,
  findWithinRadius,
  calculateETA,
  formatDistance,
  getBoundingBox,
  isWithinBounds,
  getCenterPoint,
  sortByDistance,
};
