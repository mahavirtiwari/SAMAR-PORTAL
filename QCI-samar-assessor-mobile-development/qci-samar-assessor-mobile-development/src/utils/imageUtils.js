/**
 * Image picker options shared by every capture flow. Resizing here is the
 * first pass; final compression (adaptive quality, 1500px, EXIF strip)
 * happens in services/offline/photoStorage.persistPhoto before upload.
 */
export const getImagePickerOptions = (customOptions = {}) => {
  return {
    mediaType: 'photo',
    includeBase64: false,
    maxWidth: customOptions.maxWidth || 1920,
    maxHeight: customOptions.maxHeight || 1920,
    quality: customOptions.quality || 0.8,
    saveToPhotos: false,
    ...customOptions
  };
};
