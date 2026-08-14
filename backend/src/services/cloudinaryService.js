import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

const isCloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('[Cloudinary] Configured successfully.');
} else {
  console.log('[Cloudinary] Environment variables missing. Storing attachments in SQL database.');
}

/**
 * Uploads a file buffer to Cloudinary.
 * @param {Buffer} fileBuffer
 * @param {string} fileName
 * @returns {Promise<object>}
 */
export async function uploadToCloudinary(fileBuffer, fileName) {
  if (!isCloudinaryConfigured) {
    throw new Error('Cloudinary is not configured.');
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        public_id: fileName.split('.').slice(0, -1).join('.') + '_' + Date.now(),
        use_filename: true,
        unique_filename: true
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
}

export { isCloudinaryConfigured };
