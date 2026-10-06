import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.model.js';
import GstRule from '../models/GstRule.model.js';

dotenv.config();

const migrate = async () => {
    try {
        const uri = process.env.MONGO_URI || "mongodb://localhost:27017/megamart";
        console.log("Connecting to:", uri);
        await mongoose.connect(uri);
        console.log("Connected.");

        // Find products where taxRate is not set
        const products = await Product.find({
            $or: [
                { taxRate: { $exists: false } },
                { taxRate: null }
            ]
        });

        console.log(`Found ${products.length} products to migrate.`);

        // Fetch all GST rules to resolve locally and avoid N+1 queries
        const rules = await GstRule.find({ isActive: true }).lean();
        const globalRule = rules.find((r) => r.type === 'global');

        let migratedCount = 0;
        for (const product of products) {
            let resolvedRate = 18; // Default fallback

            // 1. Resolve Category rule if product has category
            if (product.categoryId) {
                const categoryRule = rules.find(
                    (r) => r.type === 'category' && String(r.categoryId) === String(product.categoryId)
                );
                if (categoryRule) {
                    resolvedRate = categoryRule.rate;
                } else if (globalRule) {
                    resolvedRate = globalRule.rate;
                }
            } else if (globalRule) {
                resolvedRate = globalRule.rate;
            }

            product.taxRate = resolvedRate;
            await product.save();
            migratedCount++;
        }

        console.log(`Successfully migrated ${migratedCount} products.`);
        await mongoose.connection.close();
        console.log("DB Connection closed.");
    } catch (err) {
        console.error("Migration error:", err);
    }
};

migrate();
