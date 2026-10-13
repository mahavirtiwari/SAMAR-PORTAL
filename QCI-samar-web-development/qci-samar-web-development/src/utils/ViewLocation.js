import { Logger } from './logger';

const ViewLocation = (a, b) => {
  // Support three call styles:
  // ViewLocation(addressString)
  // ViewLocation(lat, lng)
  // ViewLocation({ lat, lng })
  try {
    if (a == null && b == null) {
      return;
    }

    let query = '';

    // If first arg is an object with lat/lng
    if (a && typeof a === 'object' && ('lat' in a || 'latitude' in a)) {
      const lat = a.lat ?? a.latitude;
      const lng = a.lng ?? a.long ?? a.longitude ?? a.lon;
      if (lat == null || lng == null) {
        return;
      }
      query = `${lat},${lng}`;
    } else if (typeof a === 'number' || (typeof a === 'string' && !isNaN(Number(a))) || typeof b === 'number' || (typeof b === 'string' && !isNaN(Number(b)))) {
      // Called as ViewLocation(lat, lng)
      const lat = a;
      const lng = b;
      if (lat == null || lng == null) {
        return;
      }
      query = `${lat},${lng}`;
    } else if (typeof a === 'string') {
      // Treat as address string
      query = encodeURIComponent(a);
    } else {
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    window.open(url, '_blank');
  } catch (err) {
    Logger.error('ViewLocation error:', err);
  }
};

export default ViewLocation;
