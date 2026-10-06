import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import VendorGstSetting from '../../../models/VendorGstSetting.model.js';
import Category from '../../../models/Category.model.js';

// GET /api/vendor/gst-settings
export const getGstSettings = asyncHandler(async (req, res) => {
    const settings = await VendorGstSetting.find({ vendorId: req.user.id })
        .populate('categoryId', 'name')
        .sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, settings, 'GST settings fetched.'));
});

// POST /api/vendor/gst-settings
export const updateGstSettings = asyncHandler(async (req, res) => {
    const { settings } = req.body; // Expects an array: [{ categoryId, rate }] or a single object: { categoryId, rate }
    
    if (Array.isArray(settings)) {
        const ops = [];
        for (const item of settings) {
            const { categoryId, rate } = item;
            if (!categoryId || typeof rate !== 'number' || rate < 0 || rate > 100) {
                throw new ApiError(400, 'Invalid categoryId or rate value in settings.');
            }
            ops.push({
                updateOne: {
                    filter: { vendorId: req.user.id, categoryId },
                    update: { rate },
                    upsert: true
                }
            });
        }
        if (ops.length > 0) {
            await VendorGstSetting.bulkWrite(ops);
        }
    } else {
        const { categoryId, rate } = req.body;
        if (!categoryId || typeof rate !== 'number' || rate < 0 || rate > 100) {
            throw new ApiError(400, 'Invalid categoryId or rate.');
        }
        await VendorGstSetting.findOneAndUpdate(
            { vendorId: req.user.id, categoryId },
            { rate },
            { upsert: true, new: true }
        );
    }

    const updated = await VendorGstSetting.find({ vendorId: req.user.id }).populate('categoryId', 'name');
    res.status(200).json(new ApiResponse(200, updated, 'GST settings updated.'));
});

// GET /api/vendor/gst-settings/category/:categoryId
export const getCategoryDefaultGst = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const setting = await VendorGstSetting.findOne({
        vendorId: req.user.id,
        categoryId
    });
    
    // Return the rate if configured, otherwise return null or fallback
    res.status(200).json(
        new ApiResponse(
            200,
            { rate: setting ? setting.rate : null },
            'Category default GST fetched.'
        )
    );
});
