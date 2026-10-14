import { OPENED_BLOB_URL_TTL_MS, URL_REVOKE_DELAY_MS } from '../constants/appConstants';
import { getToken } from '../services/storage/authStore';
import { Logger } from './logger';

/**
 * Download a file from the application.
 * Supports direct URLs (from API), File objects (during form editing), and
 * backend objects with URL properties (downloadUrl, download_url, etc.).
 *
 * @param {File|string|object} fileValue - The file value (File object, download URL from API, or object with URL property)
 * @param {string} suggestedName - Suggested filename for download
 */
export const downloadFile = async (fileValue, suggestedName = 'file', openInNewTab = true) => {
  try {
    // For File objects (during form editing), create a blob URL
    if (typeof File !== 'undefined' && fileValue instanceof File) {
      const blobUrl = URL.createObjectURL(fileValue);
      if (openInNewTab && typeof window !== 'undefined') {
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(blobUrl), OPENED_BLOB_URL_TTL_MS);
      } else {
        triggerDownload(blobUrl, suggestedName);
        setTimeout(() => URL.revokeObjectURL(blobUrl), URL_REVOKE_DELAY_MS);
      }
      return;
    }

    // Resolve the URL from various input types (string, object with URL properties)
    const resolvedUrl = resolveFileUrl(fileValue);

    // For URL strings from API, download via fetch with auth or open in new tab
    if (resolvedUrl && resolvedUrl.startsWith('http')) {
      if (openInNewTab && typeof window !== 'undefined') {
        try {
          const token = await getToken('accessToken');
          let response;
          if (token?.token) {
            response = await fetch(resolvedUrl, {
              method: 'GET',
              headers: { Authorization: `Bearer ${token.token}` },
            });
            if (response.status === 401) {
              response = await fetch(resolvedUrl, { method: 'GET', credentials: 'include' });
            }
          } else {
            response = await fetch(resolvedUrl, { method: 'GET', credentials: 'include' });
          }

          if (!response.ok) {
            const errorText = await response.text();
            Logger.error('Failed to open file in new tab:', response.status, errorText);
            // Fallback to download path
            await downloadFromUrl(resolvedUrl, suggestedName);
            return;
          }

          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, '_blank', 'noopener,noreferrer');
          setTimeout(() => URL.revokeObjectURL(blobUrl), OPENED_BLOB_URL_TTL_MS);
        } catch (err) {
          Logger.error('Error opening remote file in new tab:', err);
          await downloadFromUrl(resolvedUrl, suggestedName);
        }
      } else {
        await downloadFromUrl(resolvedUrl, suggestedName);
      }
      return;
    }

    // For blob: or data: URLs, either open in new tab or trigger download
    if (resolvedUrl && (resolvedUrl.startsWith('blob:') || resolvedUrl.startsWith('data:'))) {
      if (openInNewTab && typeof window !== 'undefined') {
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
      } else {
        triggerDownload(resolvedUrl, suggestedName);
      }
      return;
    }

    // If we reach here with an invalid value, log an error
    Logger.error('Cannot download file: invalid file value provided', fileValue);
  } catch (err) {
    Logger.error('Error downloading file:', err);
  }
};

/**
 * Download a file from a URL with authentication.
 *
 * @param {string} url - The download URL
 * @param {string} suggestedName - Suggested filename for download
 */
const downloadFromUrl = async (url, suggestedName) => {
  try {
    const token = await getToken('accessToken');
    // First try with bearer token if available
    let response;
    if (token?.token) {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token.token}`,
        },
      });

      // If token was rejected (401), attempt cookie-based request as a fallback
      if (response.status === 401) {
        Logger.info('Bearer token unauthorized for download; retrying with credentials');
        response = await fetch(url, {
          method: 'GET',
          credentials: 'include',
        });
      }
    } else {
      // No token: try cookie/session-based request
      Logger.info('No bearer token available for download; attempting credentials-based fetch');
      response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      Logger.error('File download failed:', response.status, errorText);
      return;
    }

    // Get the blob from the response
    const blob = await response.blob();

    // Try to get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = suggestedName;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    // Create a blob URL and trigger download
    const blobUrl = URL.createObjectURL(blob);
    triggerDownload(blobUrl, filename);

    // Clean up the blob URL after a short delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), URL_REVOKE_DELAY_MS);

    Logger.info('Download triggered:', url);
  } catch (err) {
    Logger.error('Error downloading file from URL:', err);
  }
};

/**
 * Trigger a file download using an anchor element.
 *
 * @param {string} url - The URL to download
 * @param {string} filename - The suggested filename
 */
const triggerDownload = (url, filename) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
};

/**
 * Resolve a file value to a URL.
 * Used for displaying files (not downloading from private storage).
 *
 * @param {File|string|object} value - The file value
 * @returns {string|null} The resolved URL or null
 */
export const resolveFileUrl = value => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    // Direct URL
    if (value.startsWith('http') || value.startsWith('data:') || value.startsWith('blob:')) {
      return value;
    }
    // For relative paths, we can't resolve them directly for private storage
    return null;
  }

  // File object
  if (typeof File !== 'undefined' && value instanceof File) {
    return URL.createObjectURL(value);
  }

  // Backend-like object with URL property
  if (typeof value === 'object') {
    const keys = ['download_url', 'downloadUrl', 'url', 'fileUrl', 'file_url'];
    for (let key of keys) {
      if (value[key]) {
        return resolveFileUrl(value[key]);
      }
    }
  }

  return null;
};

/**
 * Convert various payload shapes (Blob, ArrayBuffer, base64, data URL, plain string)
 * into a PDF Blob and trigger download.
 *
 * @param {Blob|ArrayBuffer|string|object} payload - The payload to convert/download
 * @param {string} suggestedName - Filename to save as
 */
export const downloadPayloadAsPdf = (payload, suggestedName = 'file.pdf') => {
  try {
    // If payload is an object with url property, prefer that URL
    const possibleUrl = (typeof payload === 'string' && (payload.startsWith('http') || payload.startsWith('/')) && payload) || (payload && (payload.url || payload.downloadUrl || payload.fileUrl));

    if (possibleUrl) {
      // Delegate to downloadFile which handles auth and content-disposition
      downloadFile(possibleUrl, suggestedName);
      return;
    }

    const data = payload?.data ?? payload?.file ?? payload?.base64 ?? payload;

    const toPdfBlob = dataToConvert => {
      if (dataToConvert instanceof Blob) {
        return dataToConvert.type === 'application/pdf' ? dataToConvert : new Blob([dataToConvert], { type: 'application/pdf' });
      }
      if (dataToConvert instanceof ArrayBuffer) {
        return new Blob([dataToConvert], { type: 'application/pdf' });
      }
      if (typeof dataToConvert === 'string' && dataToConvert.startsWith('data:')) {
        const parts = dataToConvert.split(',');
        const meta = parts[0] || '';
        const base64 = parts[1] || '';
        const byteChars = atob(base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        return new Blob([new Uint8Array(byteNumbers)], { type: meta.split(':')[1].split(';')[0] || 'application/pdf' });
      }
      if (typeof dataToConvert === 'string') {
        try {
          const base64 = dataToConvert.replace(/^\s+|\s+$/g, '');
          const byteChars = atob(base64);
          const byteNumbers = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
          }
          return new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
        } catch {
          return new Blob([dataToConvert], { type: 'application/pdf' });
        }
      }
      return new Blob([dataToConvert], { type: 'application/pdf' });
    };

    const blob = toPdfBlob(data);
    const blobUrl = URL.createObjectURL(blob);
    triggerDownload(blobUrl, suggestedName);
    setTimeout(() => URL.revokeObjectURL(blobUrl), URL_REVOKE_DELAY_MS);
  } catch (err) {
    Logger.error('Error downloading payload as PDF:', err);
  }
};

/**
 * Open a file in a new tab.
 * For private storage files, this won't work - use downloadFile instead.
 *
 * @param {File|string|object} fileValue - The file value
 */
export const openFileInNewTab = fileValue => {
  const resolved = resolveFileUrl(fileValue);
  if (resolved && typeof window !== 'undefined') {
    window.open(resolved, '_blank', 'noopener,noreferrer');
  }
};

/**
 * Fetch an authenticated image and return a blob URL for display.
 * Use this for images stored in private storage that require authentication.
 *
 * @param {File|string|object} fileValue - The file value (File object or URL from API)
 * @returns {Promise<string|null>} A blob URL that can be used in <img> tags, or null if failed
 */
// Canonical extension the backend accepts for each browser-detected image MIME type. Uploading a
// file whose extension doesn't match its detected content type (e.g. a `.jfif`, which is really
// image/jpeg) is rejected with a 422 "extension does not match detected type".
const IMAGE_MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

// JPEG-family extensions the backend rejects even though the bytes are image/jpeg — normalised to
// `.jpg` even when the browser reports no MIME type for the file.
const JPEG_ALIAS_EXTENSIONS = new Set(['jfif', 'jpe', 'jif', 'jfi']);

/**
 * Return a File whose extension matches its actual image type, so uploads aren't rejected by the
 * backend's extension-vs-detected-type check (e.g. `.jfif` → `.jpg`). Non-image files and files
 * whose extension is already consistent are returned unchanged.
 *
 * @param {File} file
 * @returns {File}
 */
export const normalizeUploadFileName = file => {
  if (!file || !file.name) {
    return file;
  }
  const dotIndex = file.name.lastIndexOf('.');
  const currentExt = dotIndex > 0 ? file.name.slice(dotIndex + 1).toLowerCase() : '';
  const base = dotIndex > 0 ? file.name.slice(0, dotIndex) : file.name;

  let desiredExt = IMAGE_MIME_EXTENSIONS[file.type] || null;
  let desiredType = file.type;
  // Catch JPEG aliases by extension too, in case the browser reported no MIME type.
  if (JPEG_ALIAS_EXTENSIONS.has(currentExt)) {
    desiredExt = 'jpg';
    desiredType = 'image/jpeg';
  }
  if (!desiredExt) {
    return file;
  }
  // `.jpg` and `.jpeg` are both valid for image/jpeg — only rewrite a genuine mismatch.
  if (currentExt === desiredExt || (desiredExt === 'jpg' && currentExt === 'jpeg')) {
    return file;
  }
  try {
    return new File([file], `${base}.${desiredExt}`, { type: desiredType || file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
};

export const fetchAuthenticatedImageBlob = async fileValue => {
  try {
    // File objects are already the bytes we want.
    if (typeof File !== 'undefined' && fileValue instanceof File) {
      return fileValue;
    }

    // Determine the URL to fetch
    let urlToFetch = resolveFileUrl(fileValue);

    // If resolveFileUrl returned null but we have a string, try using it directly
    if (!urlToFetch && typeof fileValue === 'string' && fileValue) {
      urlToFetch = fileValue;
    }

    // If still no URL, check for object with URL property
    if (!urlToFetch && typeof fileValue === 'object' && fileValue) {
      const keys = ['download_url', 'downloadUrl', 'url', 'fileUrl', 'file_url'];
      for (let key of keys) {
        if (fileValue[key]) {
          urlToFetch = fileValue[key];
          break;
        }
      }
    }

    if (!urlToFetch) {
      Logger.error('Cannot fetch image: no valid URL provided', fileValue);
      return null;
    }

    // Queued so a grid of thumbnails cannot open dozens of downloads at once.
    return await withImageFetchSlot(async () => {
      const response = await fetchImageResponse(urlToFetch);
      if (!response.ok) {
        const errorText = await response.text();
        Logger.error('Authenticated image fetch failed:', response.status, errorText);
        return null;
      }
      Logger.info('Authenticated image fetched successfully:', urlToFetch);
      return await response.blob();
    });
  } catch (err) {
    Logger.error('Error fetching authenticated image:', err);
    return null;
  }
};

export const fetchAuthenticatedImageFile = async (fileValue, preferredName, fallbackBaseName = 'image') => {
  const blob = await fetchAuthenticatedImageBlob(fileValue);
  if (!blob) {
    return null;
  }
  const ext = (blob.type && blob.type.split('/')[1]) || 'jpg';
  return new File([blob], preferredName || `${fallbackBaseName}.${ext}`, { type: blob.type || 'image/jpeg' });
};

export const fetchAuthenticatedImageUrl = async fileValue => {
  // For File objects, create a blob URL directly
  if (typeof File !== 'undefined' && fileValue instanceof File) {
    return URL.createObjectURL(fileValue);
  }

  // Already an object URL / data URL — hand it straight back for <img> use
  const resolvedUrl = resolveFileUrl(fileValue);
  if (resolvedUrl && (resolvedUrl.startsWith('blob:') || resolvedUrl.startsWith('data:'))) {
    return resolvedUrl;
  }

  const blob = await fetchAuthenticatedImageBlob(fileValue);
  if (!blob) {
    return null;
  }
  return URL.createObjectURL(blob);
};

// ---------------------------------------------------------------------------
// Authenticated image fetching: concurrency limit, thumbnails and a blob cache
// ---------------------------------------------------------------------------

// Browsers allow ~6 connections per host; more in flight only queues behind API calls.
const MAX_CONCURRENT_IMAGE_FETCHES = 6;
let activeImageFetches = 0;
const imageFetchQueue = [];

const withImageFetchSlot = task =>
  new Promise((resolve, reject) => {
    const start = () => {
      activeImageFetches += 1;
      Promise.resolve()
        .then(task)
        .then(resolve, reject)
        .finally(() => {
          activeImageFetches -= 1;
          imageFetchQueue.shift()?.();
        });
    };
    if (activeImageFetches < MAX_CONCURRENT_IMAGE_FETCHES) {
      start();
    } else {
      imageFetchQueue.push(start);
    }
  });

// Bearer token first; only a rejected token (401) falls back to cookie credentials, so a
// successful response is never fetched twice.
const fetchImageResponse = async url => {
  const token = await getToken('accessToken');
  if (token?.token) {
    const response = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token.token}` } });
    if (response.status !== 401) {
      return response;
    }
    Logger.info('Bearer token unauthorized for image; retrying with credentials');
  } else {
    Logger.info('No bearer token for image fetch; attempting credentials-based fetch');
  }
  return fetch(url, { method: 'GET', credentials: 'include' });
};

/**
 * Ask the backend for the thumbnail rendition of an image download URL: a JPEG at most
 * 480px on its longest side (the original when no thumbnail can be made). Use it for
 * grid/card previews and keep the plain URL for the full-size modal view.
 *
 * @param {string} url - Image download URL from the API
 * @returns {string} The URL with `size=thumb`, or the input unchanged when not an http URL
 */
export const withThumbSize = url => {
  if (typeof url !== 'string' || !url.startsWith('http') || /[?&]size=/.test(url)) {
    return url;
  }
  const hashIndex = url.indexOf('#');
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  let separator = '&';
  if (!base.includes('?')) {
    separator = '?';
  } else if (base.endsWith('?') || base.endsWith('&')) {
    separator = '';
  }
  return `${base}${separator}size=thumb${hash}`;
};

// URL -> { promise, blobUrl }. Map iteration order is insertion order, and a hit is
// re-inserted, so the first key is always the least recently used.
const IMAGE_CACHE_LIMIT = 300;
const imageCache = new Map();

// Downloads still in flight are skipped: their callers are about to receive the URL.
const evictImageCache = () => {
  for (const [url, entry] of imageCache) {
    if (imageCache.size <= IMAGE_CACHE_LIMIT) {
      break;
    }
    if (entry.blobUrl) {
      imageCache.delete(url);
      URL.revokeObjectURL(entry.blobUrl);
    }
  }
};

/**
 * Like fetchAuthenticatedImageUrl, but the blob URL is shared and owned by a module-level
 * cache: re-renders and the live-refresh polling of the assessment steps reuse an image
 * that is already loaded instead of downloading it again. Callers must NOT revoke the
 * returned URL; the cache revokes it when the entry is evicted.
 *
 * @param {string|object} fileValue - Download URL (or object carrying one)
 * @param {{ thumb?: boolean }} [options] - `thumb` fetches the small rendition
 * @returns {Promise<string|null>}
 */
export const getCachedImageUrl = async (fileValue, { thumb = false } = {}) => {
  const resolved = resolveFileUrl(fileValue);
  if (!resolved || !resolved.startsWith('http')) {
    // File objects, blob: and data: URLs are already local; nothing to download or cache.
    return fetchAuthenticatedImageUrl(fileValue);
  }
  const url = thumb ? withThumbSize(resolved) : resolved;

  const cached = imageCache.get(url);
  if (cached) {
    imageCache.delete(url);
    imageCache.set(url, cached);
    return cached.promise;
  }

  const entry = { blobUrl: null, promise: null };
  entry.promise = fetchAuthenticatedImageBlob(url).then(blob => {
    if (!blob) {
      // Do not cache failures; the next render or refresh tries again.
      if (imageCache.get(url) === entry) {
        imageCache.delete(url);
      }
      return null;
    }
    entry.blobUrl = URL.createObjectURL(blob);
    evictImageCache();
    return entry.blobUrl;
  });
  imageCache.set(url, entry);
  evictImageCache();
  return entry.promise;
};

/** Drop every cached image (on logout, so the next user cannot see the previous user's). */
export const clearAuthenticatedImageCache = () => {
  for (const entry of imageCache.values()) {
    if (entry.blobUrl) {
      URL.revokeObjectURL(entry.blobUrl);
    }
  }
  imageCache.clear();
};

/**
 * View a document by either downloading it via an action or opening its download URL.
 *
 * @param {object} doc - The document object to view
 * @param {Function} dispatch - Redux dispatch function
 * @param {Function} downloadAction - Redux action creator for downloading the document
 * @param {Function} setLoadingState - State setter for loading indicator
 * @param {Function} onError - Error handler callback
 * @param {string} successActionType - Success action type string to check against
 */
export const viewDocument = async (doc, dispatch, downloadAction, setLoadingState, onError, successActionType = 'documents/download/fulfilled') => {
  try {
    if (doc.id) {
      if (setLoadingState) {
        setLoadingState(doc.id);
      }
      // Use download API to get document blob
      const result = await dispatch(downloadAction(doc.id));

      if (result.type === successActionType) {
        // Check if the payload is a Blob containing JSON/XML error message
        if (result.payload instanceof Blob && (result.payload.type === 'application/json' || result.payload.type.includes('xml'))) {
          try {
            const text = await result.payload.text();
            const error = JSON.parse(text);
            if (onError) {
              onError(error.message || 'Failed to download document');
            }
            return;
          } catch {
            // Ignore if parsing fails, treat as file content
          }
        }

        // Determine file type based on document name or type
        const fileName = doc.name || doc.fileName || '';
        const fileExtension = fileName.toLowerCase().split('.').pop();

        let mimeType = 'application/pdf'; // Default to PDF
        if (fileExtension === 'docx') {
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (fileExtension === 'doc') {
          mimeType = 'application/msword';
        }

        // Create blob URL and handle different file types
        const blob = new Blob([result.payload], { type: mimeType });
        const url = window.URL.createObjectURL(blob);

        // Open all file types directly using blob URL
        window.open(url, '_blank');

        // Keep the blob URL alive so the new tab's viewer can still save the file
        setTimeout(() => {
          window.URL.revokeObjectURL(url);
        }, OPENED_BLOB_URL_TTL_MS);
      } else {
        if (onError) {
          onError('Failed to load document.');
        }
      }
    } else if (doc.downloadUrl && doc.downloadUrl !== '#') {
      // Fallback to direct URL if no ID available
      window.open(doc.downloadUrl, '_blank');
    } else {
      if (onError) {
        onError('No document available to view.');
      }
    }
  } catch (error) {
    Logger.error('View document failed:', error);
    if (onError) {
      onError('Failed to view document. Please try again.');
    }
  } finally {
    if (setLoadingState) {
      setLoadingState(null);
    }
  }
};
