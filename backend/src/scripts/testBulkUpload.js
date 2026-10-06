import dotenv from 'dotenv';
import mongoose from 'mongoose';
import {
    generateBulkTemplate,
    parseAndValidateBulkData,
    importBulkProducts,
} from '../modules/vendor/services/bulkUpload.service.js';
import Category from '../models/Category.model.js';

dotenv.config();

const runTest = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/raathi');
        console.log('Connected.');

        // Test 1: Template Generation
        console.log('\n--- Test 1: Template Generation ---');
        const workbook = await generateBulkTemplate();
        const buffer = await workbook.xlsx.writeBuffer();
        console.log(`Generated template XLSX buffer size: ${buffer.length} bytes.`);

        // Test 2: Data Validation
        console.log('\n--- Test 2: Data Validation ---');
        const sampleCat = await Category.findOne({ isActive: true });
        const catName = sampleCat ? sampleCat.name : 'NonExistentCategory';

        const sampleGridRows = [
            {
                name: 'Test Bulk Headphones ' + Date.now(),
                categoryName: catName,
                price: 1299,
                stockQuantity: 25,
                unit: 'Piece',
                taxRate: 18,
            },
            {
                name: '', // Invalid: missing name
                categoryName: 'Invalid Category XYZ',
                price: -100, // Invalid: negative price
                stockQuantity: 'abc', // Invalid: non-numeric stock
            }
        ];

        const validation = await parseAndValidateBulkData(sampleGridRows, false);
        console.log(`Validation Results -> Total: ${validation.totalRows}, Valid: ${validation.validRowsCount}, Invalid: ${validation.invalidRowsCount}`);

        validation.items.forEach((item) => {
            console.log(`Row #${item.rowNumber} (${item.isValid ? 'VALID' : 'INVALID'}):`, item.errors);
        });

        // Test 3: Import Valid Rows
        console.log('\n--- Test 3: Import Execution ---');
        const validItems = validation.items.filter((i) => i.isValid);
        if (validItems.length > 0) {
            const mockVendorId = new mongoose.Types.ObjectId();
            const importRes = await importBulkProducts(validItems, mockVendorId);
            console.log(`Import Results -> Processed: ${importRes.totalProcessed}, Success: ${importRes.successCount}, Failed: ${importRes.failedCount}`);
            if (importRes.createdProducts.length > 0) {
                console.log('Created product ID:', importRes.createdProducts[0]._id);
                // Clean up test product
                await mongoose.model('Product').deleteOne({ _id: importRes.createdProducts[0]._id });
                console.log('Cleaned up test product.');
            }
        }

        console.log('\nAll bulk upload tests completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Test error:', err);
        process.exit(1);
    }
};

runTest();
