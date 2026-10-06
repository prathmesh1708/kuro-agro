import ExcelJS from 'exceljs';
import Product from '../../../models/Product.model.js';
import Category from '../../../models/Category.model.js';
import Brand from '../../../models/Brand.model.js';
import { slugify } from '../../../utils/slugify.js';

const deriveStockStatus = (stockQuantity = 0, lowStockThreshold = 10) => {
    if (stockQuantity <= 0) return 'out_of_stock';
    if (stockQuantity <= lowStockThreshold) return 'low_stock';
    return 'in_stock';
};

const parseBoolean = (val, defaultValue = true) => {
    if (val === undefined || val === null || val === '') return defaultValue;
    if (typeof val === 'boolean') return val;
    const str = String(val).trim().toLowerCase();
    if (['yes', 'true', '1', 'y'].includes(str)) return true;
    if (['no', 'false', '0', 'n'].includes(str)) return false;
    return defaultValue;
};

/**
 * Generate formatted downloadable Excel template with Products & Instructions sheets
 */
export const generateBulkTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Appzeto E-Commerce';
    workbook.lastModifiedBy = 'Appzeto Vendor Portal';
    workbook.created = new Date();

    const categories = await Category.find({ isActive: true }).select('name parentId').lean();
    const parentCats = categories.filter((c) => !c.parentId);
    const brands = await Brand.find({ isActive: true }).select('name').lean();

    // ── SHEET 1: PRODUCTS ──
    const productSheet = workbook.addWorksheet('Products', {
        views: [{ state: 'frozen', ySplit: 1 }]
    });

    const columns = [
        { header: 'Product Name*', key: 'name', width: 25 },
        { header: 'Category*', key: 'categoryName', width: 20 },
        { header: 'Subcategory', key: 'subcategoryName', width: 20 },
        { header: 'Brand', key: 'brandName', width: 20 },
        { header: 'Price (₹)*', key: 'price', width: 15 },
        { header: 'Original Price (MRP)', key: 'originalPrice', width: 20 },
        { header: 'Unit', key: 'unit', width: 12 },
        { header: 'Stock Quantity*', key: 'stockQuantity', width: 16 },
        { header: 'Low Stock Threshold', key: 'lowStockThreshold', width: 20 },
        { header: 'Minimum Order Quantity', key: 'minimumOrderQuantity', width: 22 },
        { header: 'Total Allowed Quantity', key: 'totalAllowedQuantity', width: 22 },
        { header: 'Tax Rate (%)', key: 'taxRate', width: 14 },
        { header: 'Tax Included (Yes/No)', key: 'taxIncluded', width: 20 },
        { header: 'HSN Code', key: 'hsnCode', width: 14 },
        { header: 'Warranty Period', key: 'warrantyPeriod', width: 18 },
        { header: 'Guarantee Period', key: 'guaranteePeriod', width: 18 },
        { header: 'Weight (kg)', key: 'weight', width: 14 },
        { header: 'Length (cm)', key: 'length', width: 14 },
        { header: 'Breadth (cm)', key: 'breadth', width: 14 },
        { header: 'Height (cm)', key: 'height', width: 14 },
        { header: 'COD Allowed (Yes/No)', key: 'codAllowed', width: 20 },
        { header: 'Returnable (Yes/No)', key: 'returnable', width: 18 },
        { header: 'Cancelable (Yes/No)', key: 'cancelable', width: 18 },
        { header: 'Flash Sale (Yes/No)', key: 'flashSale', width: 18 },
        { header: 'New Arrival (Yes/No)', key: 'isNewArrival', width: 20 },
        { header: 'Featured (Yes/No)', key: 'isFeatured', width: 18 },
        { header: 'Visible (Yes/No)', key: 'isVisible', width: 18 },
        { header: 'Main Image URL', key: 'image', width: 30 },
        { header: 'Extra Images (comma separated)', key: 'images', width: 35 },
        { header: 'Description', key: 'description', width: 35 },
        { header: 'Tags (comma separated)', key: 'tags', width: 25 },
        { header: 'SEO Title', key: 'seoTitle', width: 25 },
        { header: 'SEO Description', key: 'seoDescription', width: 35 },
        { header: 'Sizes (comma separated)', key: 'sizes', width: 25 },
        { header: 'Colors (comma separated)', key: 'colors', width: 25 },
    ];

    productSheet.columns = columns;

    // Header styling
    const headerRow = productSheet.getRow(1);
    headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '1E293B' } // Slate 800
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    // Add Sample Rows
    const sampleCategory = parentCats[0]?.name || 'Electronics';
    const sampleSubcategory = categories.find((c) => c.parentId)?.name || '';
    const sampleBrand = brands[0]?.name || 'Generic';

    productSheet.addRow({
        name: 'Wireless Noise Cancelling Headphones',
        categoryName: sampleCategory,
        subcategoryName: sampleSubcategory,
        brandName: sampleBrand,
        price: 2499,
        originalPrice: 4999,
        unit: 'Piece',
        stockQuantity: 50,
        lowStockThreshold: 10,
        minimumOrderQuantity: 1,
        totalAllowedQuantity: 5,
        taxRate: 18,
        taxIncluded: 'No',
        hsnCode: '85183000',
        warrantyPeriod: '1 Year',
        guaranteePeriod: '6 Months',
        weight: 0.35,
        length: 15,
        breadth: 12,
        height: 8,
        codAllowed: 'Yes',
        returnable: 'Yes',
        cancelable: 'Yes',
        flashSale: 'No',
        isNewArrival: 'Yes',
        isFeatured: 'Yes',
        isVisible: 'Yes',
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e',
        images: 'https://images.unsplash.com/photo-1583394838336-acd977736f90',
        description: 'Premium wireless bluetooth headphones with active noise cancellation.',
        tags: 'headphones, bluetooth, audio, wireless',
        seoTitle: 'Buy Premium Wireless Headphones Online',
        seoDescription: 'High quality wireless noise cancelling bluetooth headphones at best price.',
        sizes: 'Standard',
        colors: 'Black, Silver',
    });

    [2].forEach((rIdx) => {
        const row = productSheet.getRow(rIdx);
        row.font = { name: 'Segoe UI', size: 10 };
        row.alignment = { vertical: 'middle' };
    });

    // ── SHEET 2: INSTRUCTIONS ──
    const instructionSheet = workbook.addWorksheet('Instructions');
    instructionSheet.columns = [
        { header: 'Column Name', key: 'col', width: 25 },
        { header: 'Required?', key: 'req', width: 15 },
        { header: 'Allowed Format / Values', key: 'fmt', width: 45 },
        { header: 'Description / Rules', key: 'desc', width: 50 },
    ];

    const instHeader = instructionSheet.getRow(1);
    instHeader.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    instHeader.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '0F766E' }
    };
    instHeader.height = 26;

    const instructionsData = [
        { col: 'Product Name', req: 'REQUIRED', fmt: 'Text (2-200 characters)', desc: 'The public title of your product.' },
        { col: 'Category', req: 'REQUIRED', fmt: 'Text (Existing Category Name)', desc: 'Must match an existing category name.' },
        { col: 'Subcategory', req: 'OPTIONAL', fmt: 'Text (Existing Subcategory Name)', desc: 'Must belong under the chosen Category.' },
        { col: 'Brand', req: 'OPTIONAL', fmt: 'Text (Existing Brand Name)', desc: 'Brand name of the product.' },
        { col: 'Price (₹)', req: 'REQUIRED', fmt: 'Number (>= 0)', desc: 'Final selling price after discounts.' },
        { col: 'Original Price (MRP)', req: 'OPTIONAL', fmt: 'Number (>= Price)', desc: 'Original MRP before discount.' },
        { col: 'Stock Quantity', req: 'REQUIRED', fmt: 'Non-negative Integer', desc: 'Available stock units (e.g. 50).' },
        { col: 'Unit', req: 'OPTIONAL', fmt: 'Text (default: Piece)', desc: 'Unit (Piece, Kg, Box, Pack, Set, Litre, etc.).' },
        { col: 'Tax Rate (%)', req: 'OPTIONAL', fmt: 'Number (0 to 100)', desc: 'GST percentage (default: 18).' },
        { col: 'Tax Included', req: 'OPTIONAL', fmt: 'Yes / No', desc: 'Is tax included in price? (default: No).' },
        { col: 'Weight / Dimensions', req: 'OPTIONAL', fmt: 'Numeric', desc: 'Weight (kg), Length (cm), Breadth (cm), Height (cm).' },
        { col: 'Warranties', req: 'OPTIONAL', fmt: 'Text', desc: 'Warranty Period / Guarantee Period.' },
        { col: 'Main Image URL', req: 'OPTIONAL', fmt: 'Valid Image HTTP/HTTPS URL', desc: 'Primary product image link.' },
        { col: 'Extra Images', req: 'OPTIONAL', fmt: 'Comma-separated Image URLs', desc: 'Additional image links separated by commas.' },
        { col: 'Flags (COD, Return, etc.)', req: 'OPTIONAL', fmt: 'Yes / No', desc: 'COD Allowed, Returnable, Cancelable, Flash Sale, New Arrival, Featured, Visible.' },
        { col: 'SEO Title & Description', req: 'OPTIONAL', fmt: 'Text', desc: 'Search engine optimization title & meta description.' },
        { col: 'Sizes / Colors', req: 'OPTIONAL', fmt: 'Comma-separated values', desc: 'E.g. S, M, L or Red, Blue for variants.' },
    ];

    instructionsData.forEach((item) => {
        const row = instructionSheet.addRow(item);
        if (item.req === 'REQUIRED') {
            row.getCell('req').font = { bold: true, color: { argb: 'DC2626' } };
        } else {
            row.getCell('req').font = { color: { argb: '475569' } };
        }
    });

    // ── SHEET 3: REFERENCE ──
    const refSheet = workbook.addWorksheet('Reference Categories & Brands');
    refSheet.columns = [
        { header: 'Available Category', key: 'cat', width: 30 },
        { header: 'Subcategories Under Category', key: 'subcat', width: 35 },
        { header: 'Available Brand', key: 'brand', width: 30 },
    ];

    const refHeader = refSheet.getRow(1);
    refHeader.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    refHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '475569' } };

    const maxLen = Math.max(parentCats.length, brands.length, 1);
    for (let i = 0; i < maxLen; i++) {
        const pCat = parentCats[i];
        const subNames = pCat
            ? categories.filter((c) => String(c.parentId) === String(pCat._id)).map((c) => c.name).join(', ')
            : '';
        refSheet.addRow({
            cat: pCat ? pCat.name : '',
            subcat: subNames,
            brand: brands[i] ? brands[i].name : '',
        });
    }

    return workbook;
};

/**
 * Parse Excel Buffer or JSON rows and validate against business rules
 */
export const parseAndValidateBulkData = async (inputData, isBuffer = false) => {
    let rawRows = [];

    if (isBuffer) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(inputData);

        const sheet = workbook.getWorksheet('Products') || workbook.worksheets[0];
        if (!sheet) {
            throw new Error('No product worksheet found in the uploaded file.');
        }

        const headers = [];
        sheet.getRow(1).eachCell((cell, colNumber) => {
            let headerText = String(cell.value || '').trim();
            headerText = headerText.replace(/\*/g, '').replace(/\(.*\)/g, '').trim();
            headers[colNumber] = headerText;
        });

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const rowData = {};
            let hasValue = false;
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const header = headers[colNumber];
                if (!header) return;
                let val = cell.value;
                if (val && typeof val === 'object') {
                    if (val.text) val = val.text;
                    else if (val.result !== undefined) val = val.result;
                    else if (val.hyperlink) val = val.hyperlink;
                }
                if (val !== null && val !== undefined && String(val).trim() !== '') {
                    hasValue = true;
                }
                rowData[header] = val;
            });

            if (hasValue) {
                rawRows.push({ rowNumber, data: rowData });
            }
        });
    } else if (Array.isArray(inputData)) {
        rawRows = inputData.map((item, idx) => ({
            rowNumber: item.rowNumber || idx + 1,
            data: item
        }));
    }

    if (!rawRows.length) {
        return {
            totalRows: 0,
            validRowsCount: 0,
            invalidRowsCount: 0,
            items: []
        };
    }

    const categories = await Category.find({ isActive: true }).select('name slug parentId').lean();
    const brands = await Brand.find({ isActive: true }).select('name slug').lean();

    const categoryMap = new Map();
    categories.forEach((cat) => {
        categoryMap.set(cat.name.trim().toLowerCase(), cat);
    });

    const brandMap = new Map();
    brands.forEach((b) => {
        brandMap.set(b.name.trim().toLowerCase(), b);
    });

    const processedItems = [];
    const seenNames = new Set();

    for (const { rowNumber, data } of rawRows) {
        const errors = [];
        const normalized = {};

        // 1. Name
        const rawName = String(
            data['Product Name'] || data.name || ''
        ).trim();

        if (!rawName) {
            errors.push({ field: 'name', message: 'Product Name is required.' });
        } else if (rawName.length < 2) {
            errors.push({ field: 'name', message: 'Product Name must be at least 2 characters.' });
        } else {
            const nameLower = rawName.toLowerCase();
            if (seenNames.has(nameLower)) {
                errors.push({ field: 'name', message: `Duplicate Product Name "${rawName}" in upload batch.` });
            } else {
                seenNames.add(nameLower);
            }
            normalized.name = rawName;
        }

        // 2. Category
        const rawCatName = String(
            data['Category'] || data.categoryName || data.category || ''
        ).trim();

        if (!rawCatName) {
            errors.push({ field: 'categoryName', message: 'Category Name is required.' });
        } else {
            const matchedCat = categoryMap.get(rawCatName.toLowerCase());
            if (!matchedCat) {
                errors.push({ field: 'categoryName', message: `Category "${rawCatName}" not found.` });
            } else {
                normalized.categoryId = matchedCat._id;
                normalized.categoryName = matchedCat.name;
            }
        }

        // 3. Subcategory
        const rawSubCatName = String(
            data['Subcategory'] || data.subcategoryName || data.subcategory || ''
        ).trim();

        if (rawSubCatName && normalized.categoryId) {
            const matchedSubCat = categoryMap.get(rawSubCatName.toLowerCase());
            if (!matchedSubCat) {
                errors.push({ field: 'subcategoryName', message: `Subcategory "${rawSubCatName}" not found.` });
            } else if (String(matchedSubCat.parentId || '') !== String(normalized.categoryId)) {
                errors.push({
                    field: 'subcategoryName',
                    message: `Subcategory "${rawSubCatName}" does not belong to category "${normalized.categoryName}".`
                });
            } else {
                normalized.subcategoryId = matchedSubCat._id;
                normalized.subcategoryName = matchedSubCat.name;
            }
        }

        // 4. Brand (Auto-creates brand if it does not exist yet)
        const rawBrandName = String(
            data['Brand'] || data.brandName || data.brand || ''
        ).trim();

        if (rawBrandName) {
            let matchedBrand = brandMap.get(rawBrandName.toLowerCase());
            if (!matchedBrand) {
                try {
                    matchedBrand = await Brand.create({
                        name: rawBrandName,
                        slug: slugify(rawBrandName) + '-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                        status: 'Approved',
                        isActive: true,
                    });
                    brandMap.set(rawBrandName.toLowerCase(), matchedBrand);
                } catch (bErr) {
                    console.error('Error auto-creating brand on bulk upload:', bErr);
                }
            }

            if (matchedBrand) {
                normalized.brandId = matchedBrand._id;
                normalized.brandName = matchedBrand.name;
            } else {
                errors.push({ field: 'brandName', message: `Brand "${rawBrandName}" not found.` });
            }
        }

        // 5. Price
        const rawPrice = data['Price'] !== undefined ? data['Price'] : (data['Price (₹)'] !== undefined ? data['Price (₹)'] : data.price);
        const parsedPrice = Number(rawPrice);
        if (rawPrice === undefined || rawPrice === null || String(rawPrice).trim() === '') {
            errors.push({ field: 'price', message: 'Price is required.' });
        } else if (isNaN(parsedPrice) || parsedPrice < 0) {
            errors.push({ field: 'price', message: 'Price must be a valid non-negative number.' });
        } else {
            normalized.price = parsedPrice;
        }

        // 6. Original Price
        const rawOrigPrice = data['Original Price'] !== undefined ? data['Original Price'] : (data['Original Price (MRP)'] !== undefined ? data['Original Price (MRP)'] : data.originalPrice);
        if (rawOrigPrice !== undefined && rawOrigPrice !== null && String(rawOrigPrice).trim() !== '') {
            const parsedOrig = Number(rawOrigPrice);
            if (isNaN(parsedOrig) || parsedOrig < 0) {
                errors.push({ field: 'originalPrice', message: 'Original Price must be a valid number.' });
            } else {
                normalized.originalPrice = parsedOrig;
            }
        }

        // 7. Stock Quantity
        const rawStock = data['Stock Quantity'] !== undefined ? data['Stock Quantity'] : (data['Stock'] !== undefined ? data['Stock'] : data.stockQuantity);
        const parsedStock = Number(rawStock);
        if (rawStock === undefined || rawStock === null || String(rawStock).trim() === '') {
            errors.push({ field: 'stockQuantity', message: 'Stock Quantity is required.' });
        } else if (isNaN(parsedStock) || parsedStock < 0 || !Number.isInteger(parsedStock)) {
            errors.push({ field: 'stockQuantity', message: 'Stock Quantity must be a non-negative integer.' });
        } else {
            normalized.stockQuantity = parsedStock;
        }

        // 8. Quantities & Thresholds
        normalized.unit = String(data['Unit'] || data.unit || 'Piece').trim();
        normalized.lowStockThreshold = Number(data['Low Stock Threshold'] || data.lowStockThreshold || 10) || 10;
        normalized.minimumOrderQuantity = Number(data['Minimum Order Quantity'] || data['Min Order Qty'] || data.minimumOrderQuantity || 1) || 1;
        if (data['Total Allowed Quantity'] || data['Max Order Qty'] || data.totalAllowedQuantity) {
            normalized.totalAllowedQuantity = Number(data['Total Allowed Quantity'] || data['Max Order Qty'] || data.totalAllowedQuantity) || undefined;
        }

        // 9. Taxes & HSN
        const rawTax = data['Tax Rate'] !== undefined ? data['Tax Rate'] : (data['Tax Rate (%)'] !== undefined ? data['Tax Rate (%)'] : data.taxRate);
        if (rawTax !== undefined && rawTax !== null && String(rawTax).trim() !== '') {
            const parsedTax = Number(rawTax);
            if (isNaN(parsedTax) || parsedTax < 0 || parsedTax > 100) {
                errors.push({ field: 'taxRate', message: 'Tax Rate must be between 0 and 100.' });
            } else {
                normalized.taxRate = parsedTax;
            }
        } else {
            normalized.taxRate = 18;
        }

        normalized.taxIncluded = parseBoolean(data['Tax Included'] || data['Tax Included (Yes/No)'] || data.taxIncluded, false);
        normalized.hsnCode = String(data['HSN Code'] || data.hsnCode || '').trim();

        // 10. Dimensions & Specs
        normalized.weight = Number(data['Weight'] || data['Weight (kg)'] || data.weight || 0.5) || 0.5;
        normalized.length = Number(data['Length'] || data['Length (cm)'] || data.length || 10) || 10;
        normalized.breadth = Number(data['Breadth'] || data['Breadth (cm)'] || data.breadth || 10) || 10;
        normalized.height = Number(data['Height'] || data['Height (cm)'] || data.height || 5) || 5;

        normalized.warrantyPeriod = String(data['Warranty Period'] || data.warrantyPeriod || '').trim();
        normalized.guaranteePeriod = String(data['Guarantee Period'] || data.guaranteePeriod || '').trim();

        // 11. Flags
        normalized.codAllowed = parseBoolean(data['COD Allowed'] || data['COD Allowed (Yes/No)'] || data.codAllowed, true);
        normalized.returnable = parseBoolean(data['Returnable'] || data['Returnable (Yes/No)'] || data.returnable, true);
        normalized.cancelable = parseBoolean(data['Cancelable'] || data['Cancelable (Yes/No)'] || data.cancelable, true);
        normalized.flashSale = parseBoolean(data['Flash Sale'] || data['Flash Sale (Yes/No)'] || data.flashSale, false);
        normalized.isNewArrival = parseBoolean(data['New Arrival'] || data['New Arrival (Yes/No)'] || data.isNewArrival, false);
        normalized.isFeatured = parseBoolean(data['Featured'] || data['Featured (Yes/No)'] || data.isFeatured, false);
        normalized.isVisible = parseBoolean(data['Visible'] || data['Visible (Yes/No)'] || data.isVisible, true);

        // 12. Media & Text
        const mainImage = String(data['Main Image URL'] || data.image || '').trim();
        normalized.image = mainImage;

        const extraImagesRaw = String(data['Extra Images'] || data['Extra Images (comma separated)'] || data.images || '').trim();
        if (extraImagesRaw) {
            normalized.images = extraImagesRaw.split(',').map((img) => img.trim()).filter(Boolean);
        } else {
            normalized.images = mainImage ? [mainImage] : [];
        }

        normalized.description = String(data['Description'] || data.description || '').trim();

        const tagsRaw = String(data['Tags'] || data['Tags (comma separated)'] || data.tags || '').trim();
        normalized.tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : [];

        normalized.seoTitle = String(data['SEO Title'] || data.seoTitle || '').trim();
        normalized.seoDescription = String(data['SEO Description'] || data.seoDescription || '').trim();

        // 13. Variants
        const sizesRaw = String(data['Sizes'] || data['Sizes (comma separated)'] || data.sizes || '').trim();
        const colorsRaw = String(data['Colors'] || data['Colors (comma separated)'] || data.colors || '').trim();
        const sizes = sizesRaw ? sizesRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
        const colors = colorsRaw ? colorsRaw.split(',').map((c) => c.trim()).filter(Boolean) : [];

        if (sizes.length || colors.length) {
            normalized.variants = {
                sizes,
                colors,
                attributes: [],
                prices: {},
                stockMap: {},
                imageMap: {},
                defaultVariant: { size: sizes[0] || '', color: colors[0] || '' },
            };
        }

        const isValid = errors.length === 0;

        processedItems.push({
            rowNumber,
            rawData: data,
            resolvedData: normalized,
            isValid,
            errors,
        });
    }

    const validRowsCount = processedItems.filter((i) => i.isValid).length;
    const invalidRowsCount = processedItems.length - validRowsCount;

    return {
        totalRows: processedItems.length,
        validRowsCount,
        invalidRowsCount,
        items: processedItems,
    };
};

/**
 * Execute actual bulk product creation for valid products
 */
export const importBulkProducts = async (validItems, vendorId) => {
    if (!validItems || !validItems.length) {
        return {
            totalProcessed: 0,
            successCount: 0,
            failedCount: 0,
            createdProducts: [],
            failedItems: [],
        };
    }

    const createdProducts = [];
    const failedItems = [];

    for (let index = 0; index < validItems.length; index++) {
        const item = validItems[index];
        const data = item.resolvedData || item;
        const rowNumber = item.rowNumber || index + 1;

        try {
            const name = String(data.name || '').trim();
            if (!name) throw new Error('Product name missing');

            const timestamp = Date.now();
            const randomSuffix = Math.random().toString(36).substring(2, 6);
            const slug = `${slugify(name)}-${timestamp}-${index}-${randomSuffix}`;

            const stockQuantity = Number(data.stockQuantity ?? 0);
            const lowStockThreshold = Number(data.lowStockThreshold ?? 10);
            const stock = deriveStockStatus(stockQuantity, lowStockThreshold);

            const productPayload = {
                name,
                slug,
                vendorId,
                categoryId: data.categoryId,
                subcategoryId: data.subcategoryId || null,
                brandId: data.brandId || null,
                price: Number(data.price),
                originalPrice: data.originalPrice ? Number(data.originalPrice) : undefined,
                unit: data.unit || 'Piece',
                stockQuantity,
                lowStockThreshold,
                minimumOrderQuantity: data.minimumOrderQuantity || 1,
                totalAllowedQuantity: data.totalAllowedQuantity || undefined,
                stock,
                description: data.description || '',
                image: data.image || (data.images && data.images[0]) || '',
                images: data.images || [],
                taxRate: data.taxRate !== undefined ? Number(data.taxRate) : 18,
                taxIncluded: Boolean(data.taxIncluded),
                hsnCode: data.hsnCode || '',
                warrantyPeriod: data.warrantyPeriod || '',
                guaranteePeriod: data.guaranteePeriod || '',
                weight: data.weight || 0.5,
                length: data.length || 10,
                breadth: data.breadth || 10,
                height: data.height || 5,
                codAllowed: data.codAllowed !== false,
                returnable: data.returnable !== false,
                cancelable: data.cancelable !== false,
                flashSale: Boolean(data.flashSale),
                isNewArrival: Boolean(data.isNewArrival),
                isFeatured: Boolean(data.isFeatured),
                isVisible: data.isVisible !== false,
                tags: data.tags || [],
                seoTitle: data.seoTitle || '',
                seoDescription: data.seoDescription || '',
                variants: data.variants || undefined,
                isActive: true,
            };

            const created = await Product.create(productPayload);
            createdProducts.push(created);
        } catch (err) {
            failedItems.push({
                rowNumber,
                rawData: item.rawData || data,
                resolvedData: data,
                errors: [{ field: 'system', message: err.message || 'Failed to create product in database.' }]
            });
        }
    }

    return {
        totalProcessed: validItems.length,
        successCount: createdProducts.length,
        failedCount: failedItems.length,
        createdProducts,
        failedItems,
    };
};

/**
 * Export Excel error report containing only invalid rows with Error Reason column
 */
export const generateErrorReport = async (failedItems) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Failed Products');

    const columns = [
        { header: 'Row #', key: 'rowNumber', width: 10 },
        { header: 'Error Reasons', key: 'errorReasons', width: 45 },
        { header: 'Product Name', key: 'name', width: 25 },
        { header: 'Category', key: 'categoryName', width: 20 },
        { header: 'Subcategory', key: 'subcategoryName', width: 20 },
        { header: 'Brand', key: 'brandName', width: 20 },
        { header: 'Price (₹)', key: 'price', width: 15 },
        { header: 'Stock Quantity', key: 'stockQuantity', width: 16 },
        { header: 'Description', key: 'description', width: 30 },
    ];

    sheet.columns = columns;

    const headerRow = sheet.getRow(1);
    headerRow.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '991B1B' } };
    headerRow.height = 28;

    failedItems.forEach((item) => {
        const raw = item.rawData || {};
        const errorText = (item.errors || [])
            .map((e) => `${e.field ? `[${e.field}] ` : ''}${e.message}`)
            .join(' | ');

        const row = sheet.addRow({
            rowNumber: item.rowNumber,
            errorReasons: errorText,
            name: raw['Product Name'] || raw.name || '',
            categoryName: raw['Category'] || raw.categoryName || '',
            subcategoryName: raw['Subcategory'] || raw.subcategoryName || '',
            brandName: raw['Brand'] || raw.brandName || '',
            price: raw['Price'] || raw.price || '',
            stockQuantity: raw['Stock Quantity'] || raw.stockQuantity || '',
            description: raw['Description'] || raw.description || '',
        });

        const errCell = row.getCell('errorReasons');
        errCell.font = { bold: true, color: { argb: '991B1B' } };
        errCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
    });

    return workbook;
};
