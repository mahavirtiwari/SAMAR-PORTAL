import { useCallback, useState } from 'react';
import { Logger } from '../utils/logger';

const DEFAULT_OPTIONS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

/**
 * Best-effort browser geolocation. `getPosition` always resolves — it returns
 * `{ latitude, longitude }` on success or `null` on denial/unavailability, so it
 * never blocks a flow. The server accepts null coordinates for punch/meetings.
 */
const useGeolocation = () => {
  const [position, setPosition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getPosition = useCallback(
    (options = DEFAULT_OPTIONS) =>
      new Promise(resolve => {
        if (!('geolocation' in navigator)) {
          setError('Geolocation is not supported by this browser.');
          resolve(null);
          return;
        }
        setLoading(true);
        setError(null);
        navigator.geolocation.getCurrentPosition(
          pos => {
            const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            setPosition(coords);
            setLoading(false);
            resolve(coords);
          },
          err => {
            Logger.error('useGeolocation error:', err?.message);
            setError(err?.message || 'Unable to retrieve location.');
            setLoading(false);
            resolve(null);
          },
          options,
        );
      }),
    [],
  );

  return { position, loading, error, getPosition };
};

export default useGeolocation;
