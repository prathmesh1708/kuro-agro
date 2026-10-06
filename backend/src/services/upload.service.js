import cloudinary, { ensureCloudinaryConfig } from '../config/cloudinary.js';
import fs from 'fs/promises';

/**
 * Upload a local image file to Cloudinary
 * @param {string} localFilePath - Temporary local file path from multer disk storage
 * @param {string} folder - Cloudinary folder (e.g. 'products', 'vendors/logos')
 * @param {string} [publicId] - Optional custom public ID
 * @returns {Promise<{url: string, publicId: string}>}
 */
export const uploadToCloudinary = async (localFilePath, folder, publicId) => {
    ensureCloudinaryConfig();
    const uploadOptions = { folder, resource_type: 'image' };
    if (publicId) uploadOptions.public_id = publicId;

    const result = await cloudinary.uploader.upload(localFilePath, uploadOptions);
    return { url: result.secure_url, publicId: result.public_id };
};

/**
 * Upload a local file to Cloudinary with configurable resource type.
 * Useful for non-image assets like PDFs.
 * @param {string} localFilePath
 * @param {string} folder
 * @param {'image'|'raw'|'auto'} [resourceType='auto']
 * @param {string} [publicId]
 */
export const uploadFileToCloudinary = async (
    localFilePath,
    folder,
    resourceType = 'auto',
    publicId
) => {
    ensureCloudinaryConfig();
    const uploadOptions = { folder, resource_type: resourceType };
    if (publicId) uploadOptions.public_id = publicId;
    const result = await cloudinary.uploader.upload(localFilePath, uploadOptions);
    return { url: result.secure_url, publicId: result.public_id };
};

/**
 * Upload local file to Cloudinary and remove the local temp file.
 * Local file deletion happens only after successful Cloudinary upload.
 */
export const uploadLocalFileToCloudinaryAndCleanup = async (localFilePath, folder, publicId) => {
    const uploaded = await uploadToCloudinary(localFilePath, folder, publicId);
    try {
        await fs.unlink(localFilePath);
    } catch {
        // Non-fatal: do not fail the request if temp cleanup fails.
    }
    return uploaded;
};

/**
 * Upload local file to Cloudinary with configurable resource type and cleanup temp file.
 */
export const uploadLocalFileToCloudinaryAndCleanupWithType = async (
    localFilePath,
    folder,
    resourceType = 'auto',
    publicId
) => {
    const uploaded = await uploadFileToCloudinary(
        localFilePath,
        folder,
        resourceType,
        publicId
    );
    try {
        await fs.unlink(localFilePath);
    } catch {
        // Non-fatal: do not fail the request if temp cleanup fails.
    }
    return uploaded;
};

const PRIVATE_DOC_PREFIX = 'cloudinary-private:';

/**
 * Upload a sensitive document (ID proofs) as a private Cloudinary asset and remove the temp file.
 * Returns a reference string to store in the database; it is not a public URL.
 * Use getPrivateDocumentUrl() to create a short-lived download link.
 */
export const uploadPrivateDocumentAndCleanup = async (localFilePath, folder) => {
    ensureCloudinaryConfig();
    try {
        const result = await cloudinary.uploader.upload(localFilePath, {
            folder,
            resource_type: 'image', // images and PDFs are both handled as image resources
            type: 'private',
        });
        return `${PRIVATE_DOC_PREFIX}${result.format}:${result.public_id}`;
    } finally {
        await fs.unlink(localFilePath).catch(() => {});
    }
};

export const isPrivateDocumentRef = (value) => String(value || '').startsWith(PRIVATE_DOC_PREFIX);

/**
 * Signed, expiring download URL for a reference created by uploadPrivateDocumentAndCleanup().
 */
export const getPrivateDocumentUrl = (ref, ttlSeconds = 600) => {
    ensureCloudinaryConfig();
    const [format, ...idParts] = String(ref).slice(PRIVATE_DOC_PREFIX.length).split(':');
    return cloudinary.utils.private_download_url(idParts.join(':'), format, {
        resource_type: 'image',
        type: 'private',
        expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
    });
};

/**
 * Delete a file from Cloudinary by public ID
 */
export const deleteFromCloudinary = async (publicId) => {
    return cloudinary.uploader.destroy(publicId);
};

/**
 * Best-effort local file cleanup helper.
 */
export const cleanupLocalFile = async (localFilePath) => {
    if (!localFilePath) return false;
    try {
        await fs.unlink(localFilePath);
        return true;
    } catch {
        return false;
    }
};

/**
 * Best-effort cleanup for multiple local files.
 */
export const cleanupLocalFiles = async (paths = []) => {
    const uniquePaths = [...new Set((paths || []).filter(Boolean))];
    await Promise.allSettled(uniquePaths.map((filePath) => cleanupLocalFile(filePath)));
};
