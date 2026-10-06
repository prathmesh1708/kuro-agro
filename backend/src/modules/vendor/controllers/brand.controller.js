import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Brand from '../../../models/Brand.model.js';
import { slugify } from '../../../utils/slugify.js';

// POST /api/vendor/brands
export const createVendorBrand = asyncHandler(async (req, res) => {
    const { name, logo, description, website, country, manufacturer } = req.body;

    if (!name || !name.trim()) {
        throw new ApiError(400, 'Brand name is required.');
    }

    const trimmedName = name.replace(/\s+/g, ' ').trim();

    // Case-insensitive duplicates check
    const cleanRegexName = trimmedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const existingBrand = await Brand.findOne({
        name: { $regex: new RegExp(`^\\s*${cleanRegexName}\\s*$`, 'i') }
    });

    if (existingBrand) {
        throw new ApiError(400, 'This Brand already exists.');
    }

    let slug = slugify(trimmedName);
    const existingSlug = await Brand.findOne({ slug });
    if (existingSlug) {
        slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const brand = await Brand.create({
        name: trimmedName,
        slug,
        logo: logo || '',
        description: description || '',
        website: website || '',
        country: country || '',
        manufacturer: manufacturer || '',
        isActive: true,
        status: 'Pending',
        createdByVendor: req.user.id
    });

    res.status(201).json(new ApiResponse(201, brand, 'Brand created successfully and is pending approval.'));
});
