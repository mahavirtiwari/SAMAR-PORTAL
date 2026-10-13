import PropTypes from 'prop-types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, InteractionManager, View } from 'react-native';
import RNFS from 'react-native-fs';
import AppSettings from '../../../appsettings';
import { commonStyles } from '../../assets/theme/Styles';
import { COLORS } from '../../assets/theme/Theme';
import { refreshAccessTokenForDownload } from '../../services/api/clients/userClient';
import { resolvePhotoPath } from '../../services/offline/photoStorage';
import { getToken } from '../../services/storage/authStore';
import { Logger } from '../../utils/logger';

// Cache priorities similar to FastImage
export const Priority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high'
};

// Cache control options similar to FastImage
export const CacheControl = {
  // Use cache but load from network first
  WEB_FIRST: 'webFirst',
  // Use cache first, fallback to network
  CACHE_FIRST: 'cacheFirst',
  // Immutable content, cache only
  IMMUTABLE: 'immutable'
};

// Image resize modes
export const ResizeMode = {
  COVER: 'cover',
  CONTAIN: 'contain',
  STRETCH: 'stretch',
  CENTER: 'center'
};

const AppFastImage = ({
  uri: rawUri,
  style,
  priority = Priority.NORMAL,
  cacheControl = CacheControl.CACHE_FIRST,
  resizeMode = ResizeMode.COVER,
  placeholder,
  fallback,
  onLoadStart,
  onLoadEnd,
  onLoad,
  onError,
  cacheExpiry = 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  useImageBackground = false,
  borderRadius,
  children
}) => {
  // Local capture paths are re-anchored to the current app container — iOS
  // reinstalls change the Documents container UUID, so a stored absolute path
  // from a previous install points nowhere. Remote URLs pass through unchanged.
  const uri = resolvePhotoPath(rawUri);
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const activeFilesRef = useRef(new Set()); // Use ref instead of state for active files

  const baseURL = useMemo(() => AppSettings.BASE_URL, []);

  const getSanitizedFileName = useCallback((fullUri) => fullUri.replace(/[^a-zA-Z0-9]/g, '_'), []);

  const getCachedImagePath = useCallback(
    (fullUri) => `${RNFS.CachesDirectoryPath}/${getSanitizedFileName(fullUri)}`,
    [getSanitizedFileName]
  );

  const getCacheMetadataPath = useCallback(
    (fullUri) => `${RNFS.CachesDirectoryPath}/${getSanitizedFileName(fullUri)}_metadata.json`,
    [getSanitizedFileName]
  );

  const markFileActive = useCallback((path) => {
    activeFilesRef.current.add(path);
  }, []);

  const markFileInactive = useCallback((path) => {
    activeFilesRef.current.delete(path);
  }, []);

  const isCacheValid = useCallback(
    async (metadataPath) => {
      try {
        if (!(await RNFS.exists(metadataPath))) {
          Logger.info(`Cache metadata does not exist for ${metadataPath}`);
          return false;
        }

        const metadata = JSON.parse(await RNFS.readFile(metadataPath, 'utf8'));
        const isValid = Date.now() - metadata.timestamp < cacheExpiry;

        Logger.info(`Cache validation for ${metadataPath}: ${isValid}`);
        return isValid;
      } catch (error) {
        Logger.error('Error checking cache validity', error);
        return false;
      }
    },
    [cacheExpiry]
  );

  const handleError = useCallback(
    (error) => {
      setError(true);
      setLoading(false);
      if (onError) {
        onError(error);
      }
    },
    [onError]
  );

  const saveImageToCache = useCallback(
    async (blob, filePath, metadataPath) => {
      try {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64data = reader.result.split(',')[1];
          await RNFS.writeFile(filePath, base64data, 'base64');
          await RNFS.writeFile(
            metadataPath,
            JSON.stringify({ timestamp: Date.now(), size: blob.size }),
            'utf8'
          );
          setImageUri(`file://${filePath}`);
          setLoading(false);
        };
        reader.readAsDataURL(blob);
      } catch (error) {
        Logger.error('Error saving image to cache', error);
        handleError(error);
      }
    },
    [handleError]
  );

  const fetchImage = useCallback(
    async (fullUri, token) => {
      const fetchPriority =
        priority === Priority.LOW
          ? { Priority: 'low' }
          : priority === Priority.HIGH
            ? { Priority: 'high' }
            : {};
      return fetch(fullUri, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...fetchPriority
        }
      });
    },
    [priority]
  );

  const fetchAndCacheImage = useCallback(
    async (fullUri, token) => {
      try {
        if (onLoadStart) {
          onLoadStart();
        }

        let response = await fetchImage(fullUri, token);

        // The token attached above is read straight from storage, so this request never
        // meets the api client's interceptors and an expired token just produced a
        // broken image. Refresh once and try again, sharing the refresh already in
        // flight when several images expire together. [BUG-08859]
        if (response.status === 401) {
          Logger.info('Image refused with an expired token, refreshing once and retrying');
          const refreshedToken = await refreshAccessTokenForDownload();
          if (refreshedToken) {
            response = await fetchImage(fullUri, refreshedToken);
          }
        }

        if (!response.ok) {
          const errorDetails = `Status: ${response.status}, StatusText: ${response.statusText}`;
          Logger.error(`Failed to fetch image from ${fullUri}. ${errorDetails}`);
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        const blob = await response.blob();
        const filePath = getCachedImagePath(fullUri);
        const metadataPath = getCacheMetadataPath(fullUri);

        await saveImageToCache(blob, filePath, metadataPath);

        if (onLoadEnd) {
          onLoadEnd();
        }
      } catch (error) {
        Logger.error(`Error fetching and caching image from ${fullUri}`, error);
        handleError(error); // Ensure onError is invoked
      }
    },
    [
      fetchImage,
      getCachedImagePath,
      getCacheMetadataPath,
      saveImageToCache,
      onLoadStart,
      onLoadEnd,
      handleError // Added dependency
    ]
  );

  const loadImage = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);

      if (!uri) {
        Logger.info('No URI provided');
        setLoading(false);
        return;
      }

      // Check if URI is a local file (file://, content://, or local path)
      const isLocalFile =
        uri.startsWith('file://') ||
        uri.startsWith('content://') ||
        uri.startsWith('/data/') ||
        uri.startsWith('/storage/') ||
        uri.includes('rn_image_picker');

      if (isLocalFile) {
        setImageUri(uri);
        setLoading(false);
        if (onLoadEnd) {
          onLoadEnd();
        }
        return;
      }

      // For remote URLs, get token and cache
      const token = await getToken('accessToken');
      Logger.info('FastImage URI:', uri);

      if (!token?.token) {
        Logger.info('Token is missing for remote image');
        setLoading(false);
        return;
      }

      const fullUri = uri;
      const cachedImagePath = getCachedImagePath(fullUri);
      const metadataPath = getCacheMetadataPath(fullUri);

      markFileActive(cachedImagePath);
      markFileActive(metadataPath);

      const fileExists = await RNFS.exists(cachedImagePath);
      const cacheValid = await isCacheValid(metadataPath);

      try {
        if (cacheControl === CacheControl.CACHE_FIRST && fileExists && cacheValid) {
          setImageUri(`file://${cachedImagePath}`);
          setLoading(false);
          if (onLoadEnd) {
            onLoadEnd();
          }
        } else if (cacheControl === CacheControl.IMMUTABLE && fileExists) {
          setImageUri(`file://${cachedImagePath}`);
          setLoading(false);
          if (onLoadEnd) {
            onLoadEnd();
          }
        } else {
          await fetchAndCacheImage(fullUri, token.token);
        }
      } finally {
        markFileInactive(cachedImagePath);
        markFileInactive(metadataPath);
      }
    } catch (error) {
      Logger.error('Error loading image', error);
      handleError(error);
    }
  }, [
    uri,
    baseURL,
    getCachedImagePath,
    getCacheMetadataPath,
    cacheControl,
    isCacheValid,
    fetchAndCacheImage,
    markFileActive,
    markFileInactive,
    onLoadEnd,
    handleError
  ]);

  const cleanupCache = useCallback(() => {
    const cleanupTask = async () => {
      try {
        const files = await RNFS.readDir(RNFS.CachesDirectoryPath);
        const now = Date.now();
        let totalCleared = 0;

        for (const file of files) {
          if (file.name.endsWith('_metadata.json')) {
            const imagePath = file.path.replace('_metadata.json', '');
            if (activeFilesRef.current.has(imagePath) || activeFilesRef.current.has(file.path)) {
              continue;
            }

            const metadata = JSON.parse(await RNFS.readFile(file.path, 'utf8'));
            if (now - metadata.timestamp > cacheExpiry) {
              if (await RNFS.exists(imagePath)) {
                const stats = await RNFS.stat(imagePath);
                totalCleared += stats.size;
                await RNFS.unlink(imagePath);
              }
              await RNFS.unlink(file.path);
            }
          }
        }

        if (totalCleared > 0) {
          const freedMB = (totalCleared / (1024 * 1024)).toFixed(2);
          Logger.info(`Cache cleanup completed: ${freedMB}MB freed`);
        }
      } catch (error) {
        Logger.error('Error cleaning up cache', error);
      }
    };

    if (global.InteractionManager) {
      InteractionManager.runAfterInteractions(cleanupTask);
    } else {
      const timeoutId = setTimeout(cleanupTask, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [cacheExpiry]);

  useEffect(() => {
    loadImage();
    const cleanupInterval = setInterval(cleanupCache, 24 * 60 * 60 * 1000); // 24 hours

    return () => {
      clearInterval(cleanupInterval);
      cleanupCache();
    };
  }, [uri, cacheControl, cacheExpiry, loadImage, cleanupCache]);

  const imageResizeMode = useMemo(() => {
    // Map resizeMode to valid Image resizeMode values
    const resizeModes = {
      [ResizeMode.COVER]: 'cover',
      [ResizeMode.CONTAIN]: 'contain',
      [ResizeMode.STRETCH]: 'stretch',
      [ResizeMode.CENTER]: 'center'
    };
    return resizeModes[resizeMode] || 'cover'; // Default to 'cover' if invalid
  }, [resizeMode]);

  if (loading) {
    return (
      placeholder || (
        <View style={[style, commonStyles.center]}>
          <ActivityIndicator size="small" color={COLORS.background.cross} />
        </View>
      )
    );
  }

  if (error) {
    return fallback || null;
  }

  if (useImageBackground) {
    return (
      <ImageBackground
        borderRadius={borderRadius}
        style={style}
        source={{ uri: imageUri }}
        resizeMode={imageResizeMode}
        onLoad={onLoad}>
        {children}
      </ImageBackground>
    );
  }

  return (
    <Image style={style} source={{ uri: imageUri }} resizeMode={imageResizeMode} onLoad={onLoad} />
  );
};

// Static method for manual cache clearing - similar to FastImage.clearMemoryCache and clearDiskCache
AppFastImage.clearCache = async () => {
  try {
    const files = await RNFS.readDir(RNFS.CachesDirectoryPath);
    let count = 0;
    let totalSize = 0;

    // Process each file in the cache directory
    for (const file of files) {
      try {
        // Filter for our image cache files (either the image or its metadata)
        if (
          file.name.endsWith('_metadata.json') ||
          (await RNFS.exists(`${file.path}_metadata.json`))
        ) {
          // Get file size for logging
          const stats = await RNFS.stat(file.path);
          totalSize += stats.size;

          // Delete file
          await RNFS.unlink(file.path);
          count++;
        }
      } catch (fileError) {
        Logger.error(`Error deleting file ${file.name}`, fileError);
      }
    }

    if (count > 0) {
      const freedMB = (totalSize / (1024 * 1024)).toFixed(2);
      Logger.info(`Image cache cleared: ${count} files, ${freedMB}MB freed`);
    }
  } catch (error) {
    Logger.error('Error clearing image cache', error);
    throw error;
  }
};

// Add prop validation
AppFastImage.propTypes = {
  uri: PropTypes.string.isRequired,
  style: PropTypes.object,
  priority: PropTypes.oneOf(Object.values(Priority)),
  cacheControl: PropTypes.oneOf(Object.values(CacheControl)),
  resizeMode: PropTypes.oneOf(Object.values(ResizeMode)),
  placeholder: PropTypes.element,
  fallback: PropTypes.element,
  onLoadStart: PropTypes.func,
  onLoadEnd: PropTypes.func,
  onLoad: PropTypes.func,
  onError: PropTypes.func,
  cacheExpiry: PropTypes.number,
  useImageBackground: PropTypes.bool,
  children: PropTypes.node
};

export default AppFastImage;
