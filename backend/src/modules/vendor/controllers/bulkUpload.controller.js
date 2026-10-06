import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import {
    generateBulkTemplate,
    parseAndValidateBulkData,
    importBulkProducts as importService,
    generateErrorReport,
} from '../services/bulkUpload.service.js';

/**
 * GET /api/vendor/products/bulk/template
 * Download formatted Excel product upload template
 */
export const downloadTemplate = asyncHandler(async (req, res) => {
    const workbook = await generateBulkTemplate();

    res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
        'Content-Disposition',
        'attachment; filename="Vendor_Bulk_Product_Upload_Template.xlsx"'
    );

    await workbook.xlsx.write(res);
    res.end();
});

/**
 * POST /api/vendor/products/bulk/validate
 * Validate uploaded Excel file or Manual Grid products JSON
 */
export const validateBulkProducts = asyncHandler(async (req, res) => {
    let result;

    if (req.file) {
        // File Upload (Excel / CSV)
        if (!req.file.buffer || !req.file.buffer.length) {
            throw new ApiError(400, 'Uploaded file is empty.');
        }
        result = await parseAndValidateBulkData(req.file.buffer, true);
    } else if (req.body.products) {
        // Manual Grid Upload
        let products = req.body.products;
        if (typeof products === 'string') {
            try {
                products = JSON.parse(products);
            } catch (_) {
                throw new ApiError(400, 'Invalid JSON payload for products.');
            }
        }
        if (!Array.isArray(products) || !products.length) {
            throw new ApiError(400, 'At least one product row is required for validation.');
        }
        result = await parseAndValidateBulkData(products, false);
    } else {
        throw new ApiError(400, 'Please select an Excel file or provide grid products.');
    }

    res.status(200).json(
        new ApiResponse(200, result, 'Bulk products validation completed.')
    );
});

/**
 * POST /api/vendor/products/bulk/import
 * Import validated products into database
 */
export const importBulkProducts = asyncHandler(async (req, res) => {
    let { products } = req.body;
    if (typeof products === 'string') {
        try {
            products = JSON.parse(products);
        } catch (_) {}
    }

    if (!Array.isArray(products) || !products.length) {
        throw new ApiError(400, 'No valid products provided for import.');
    }

    const result = await importService(products, req.user.id);

    res.status(201).json(
        new ApiResponse(201, result, 'Bulk product import completed.')
    );
});

/**
 * POST /api/vendor/products/bulk/error-report
 * Download Excel Error Report for failed rows
 */
export const downloadErrorReport = asyncHandler(async (req, res) => {
    let { failedItems } = req.body;
    if (typeof failedItems === 'string') {
        try {
            failedItems = JSON.parse(failedItems);
        } catch (_) {}
    }

    if (!Array.isArray(failedItems) || !failedItems.length) {
        throw new ApiError(400, 'No failed items provided for error report.');
    }

    const workbook = await generateErrorReport(failedItems);

    res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
        'Content-Disposition',
        'attachment; filename="Bulk_Upload_Error_Report.xlsx"'
    );

    await workbook.xlsx.write(res);
    res.end();
});
