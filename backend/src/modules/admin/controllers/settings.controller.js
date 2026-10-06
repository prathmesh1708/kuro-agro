import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Settings from '../../../models/Settings.model.js';

// Admin-configurable store settings, one Settings document per section (key: "site.<section>").
export const SETTINGS_SECTIONS = [
    'general', 'payment', 'shipping', 'orders', 'customers', 'products', 'tax',
    'content', 'features', 'homepage', 'reviews', 'email', 'notifications', 'seo', 'theme',
];

// Sections without secrets (payment keys, SMTP passwords) that the storefront may read.
export const PUBLIC_SETTINGS_SECTIONS = [
    'general', 'shipping', 'products', 'tax', 'content', 'features', 'homepage', 'reviews', 'seo', 'theme',
];

const keyFor = (section) => `site.${section}`;

export const loadSettings = async (sections) => {
    const docs = await Settings.find({ key: { $in: sections.map(keyFor) } }).lean();
    return docs.reduce((acc, doc) => {
        acc[doc.key.slice('site.'.length)] = doc.value;
        return acc;
    }, {});
};

/**
 * @desc    Get all store settings
 * @route   GET /api/admin/settings
 * @access  Private (Admin)
 */
export const getSettings = asyncHandler(async (req, res) => {
    const settings = await loadSettings(SETTINGS_SECTIONS);
    res.status(200).json(new ApiResponse(200, settings, 'Settings fetched.'));
});

/**
 * @desc    Update one or more settings sections, e.g. { general: { storeName: "KuroAgro" } }
 *          Fields are merged into the stored section.
 * @route   PUT /api/admin/settings
 * @access  Private (Admin)
 */
export const updateSettings = asyncHandler(async (req, res) => {
    const body = req.body || {};
    const sections = Object.keys(body);
    if (sections.length === 0) throw new ApiError(400, 'No settings provided.');

    const unknown = sections.filter((s) => !SETTINGS_SECTIONS.includes(s));
    if (unknown.length) throw new ApiError(400, `Unknown settings section(s): ${unknown.join(', ')}`);

    for (const section of sections) {
        const value = body[section];
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            throw new ApiError(400, `Settings section "${section}" must be an object.`);
        }
        const existing = await Settings.findOne({ key: keyFor(section) }).lean();
        await Settings.findOneAndUpdate(
            { key: keyFor(section) },
            { $set: { value: { ...(existing?.value || {}), ...value } } },
            { upsert: true }
        );
    }

    const settings = await loadSettings(SETTINGS_SECTIONS);
    res.status(200).json(new ApiResponse(200, settings, 'Settings updated.'));
});
