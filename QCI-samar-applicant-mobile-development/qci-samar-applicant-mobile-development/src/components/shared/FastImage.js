import PropTypes from 'prop-types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, StyleSheet, View } from 'react-native';
import { COLORS } from '../../assets/theme/Theme';
import { getToken } from '../../services/storage/authStore';

// Image resize modes
export const ResizeMode = {
  COVER: 'cover',
  CONTAIN: 'contain',
  STRETCH: 'stretch',
  CENTER: 'center',
};

/**
 * AppFastImage — renders local capture URIs (file://, content://, picker temp)
 * directly, and protected remote URIs natively with the auth token attached to
 * the image request. React Native's image loader handles the fetch, decode, and
 * its own disk cache; there is no manual fetch/FileReader/base64 pipeline.
 *
 * Remote photos come from a protected `downloadUrl`, so the bearer token is
 * looked up here and merged into `source.headers` — callers don't pass auth.
 */
const AppFastImage = ({
  uri,
  headers,
  style,
  resizeMode = ResizeMode.COVER,
  placeholder,
  fallback,
  onLoad,
  onLoadEnd,
  onError,
  useImageBackground = false,
  borderRadius,
  children,
}) => {
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // A just-captured local file can fail its very first decode before the OS has
  // flushed it to disk, which otherwise renders as a black tile. Remount the
  // underlying image once (keyed on this) to retry before giving up.
  const [attempt, setAttempt] = useState(0);

  const handleError = useCallback(
    e => {
      if (attempt < 1) {
        setAttempt(a => a + 1);
        return;
      }
      setError(true);
      setLoading(false);
      onError?.(e);
    },
    [attempt, onError],
  );

  const handleLoad = useCallback(
    e => {
      onLoad?.(e);
    },
    [onLoad],
  );

  const handleLoadEnd = useCallback(() => {
    setLoading(false);
    onLoadEnd?.();
  }, [onLoadEnd]);

  const resolveSource = useCallback(async () => {
    setError(false);
    setLoading(true);
    setAttempt(0);

    if (!uri) {
      setSource(null);
      setLoading(false);
      return;
    }

    // Local capture URIs render directly — no auth, no network.
    const isLocalFile =
      uri.startsWith('file://') ||
      uri.startsWith('content://') ||
      uri.startsWith('/data/') ||
      uri.startsWith('/storage/') ||
      uri.includes('rn_image_picker');

    if (isLocalFile) {
      setSource({ uri });
      return;
    }

    // Protected remote URL: attach the bearer token so RN's native loader
    // authenticates the request. Caller-supplied headers win; otherwise look up
    // the token here. Without either it would 401 and render nothing, so fall
    // back to the blank state instead of a failed request.
    if (headers) {
      setSource({ uri, headers });
      return;
    }
    const token = await getToken('accessToken');
    if (!token?.token) {
      setSource(null);
      setLoading(false);
      return;
    }
    setSource({ uri, headers: { Authorization: `Bearer ${token.token}` } });
  }, [uri, headers]);

  useEffect(() => {
    resolveSource();
  }, [resolveSource]);

  const imageResizeMode = useMemo(() => {
    const modes = ['cover', 'contain', 'stretch', 'center'];
    return modes.includes(resizeMode) ? resizeMode : 'cover';
  }, [resizeMode]);

  if (error) {
    return fallback || null;
  }

  // Spinner overlaid while the (remote) load is in flight so a photo that takes
  // a moment to arrive doesn't show an empty box. Kept as an absolutely-
  // positioned overlay rather than an early return so the image and any children
  // (e.g. delete button) still mount underneath.
  const loadingOverlay = loading
    ? placeholder || (
        <View style={styles.loaderOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color={COLORS.primary.main} />
        </View>
      )
    : null;

  if (useImageBackground) {
    return (
      <ImageBackground
        key={attempt}
        borderRadius={borderRadius}
        style={style}
        source={source}
        resizeMode={imageResizeMode}
        onLoad={handleLoad}
        onLoadEnd={handleLoadEnd}
        onError={handleError}>
        {loadingOverlay}
        {children}
      </ImageBackground>
    );
  }

  return (
    <View style={style}>
      <Image
        key={attempt}
        style={StyleSheet.absoluteFill}
        source={source}
        resizeMode={imageResizeMode}
        onLoad={handleLoad}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
      />
      {loadingOverlay}
    </View>
  );
};

const styles = StyleSheet.create({
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

AppFastImage.propTypes = {
  uri: PropTypes.string,
  headers: PropTypes.object,
  style: PropTypes.any,
  resizeMode: PropTypes.string,
  placeholder: PropTypes.element,
  fallback: PropTypes.element,
  onLoad: PropTypes.func,
  onLoadEnd: PropTypes.func,
  onError: PropTypes.func,
  useImageBackground: PropTypes.bool,
  borderRadius: PropTypes.number,
  children: PropTypes.node,
};

export default AppFastImage;
