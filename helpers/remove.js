function getCloudinaryPublicId(url) {
  if (!url || !url.includes('cloudinary.com')) return null;

  // Remove version + extension
  const parts = url.split('/');
  const uploadIndex = parts.indexOf('upload');

  if (uploadIndex === -1) return null;

  const publicPath = parts
    .slice(uploadIndex + 1)
    .join('/')
    .replace(/^v\d+\//, '')
    .replace(/\.[^/.]+$/, '');

  return publicPath;
}
