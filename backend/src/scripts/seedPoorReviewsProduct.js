import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.model.js';
import Review from '../models/Review.model.js';
import User from '../models/User.model.js';
import Vendor from '../models/Vendor.model.js';

dotenv.config();

const runTest = async () => {
    try {
        console.log("Connecting to database:", process.env.MONGO_URI || "mongodb://localhost:27017/megamart");
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/megamart");
        console.log("Database connected successfully.");

        // 1. Create a dummy vendor
        let vendor = await Vendor.findOne({ email: 'test_poor_reviews_vendor@yopmail.com' });
        if (!vendor) {
            vendor = await Vendor.create({
                name: 'Poor Review Shop Owner',
                email: 'test_poor_reviews_vendor@yopmail.com',
                password: 'password123',
                storeName: 'Unsatisfactory Store',
                status: 'approved',
                isVerified: true
            });
            console.log("Created test vendor.");
        }

        // 2. Create a dummy product
        let product = await Product.create({
            name: 'Highly Unsatisfactory Product ' + Date.now(),
            slug: 'highly-unsatisfactory-product-' + Date.now(),
            price: 99.99,
            categoryId: new mongoose.Types.ObjectId(), // Dummy ObjectId
            vendorId: vendor._id,
            stockQuantity: 100,
            stock: 'in_stock',
            isActive: true
        });
        console.log("Created test product:", product._id);

        // 3. Create a user
        let user = await User.findOne({ email: 'review_user@yopmail.com' });
        if (!user) {
            user = await User.create({
                name: 'Critic User',
                email: 'review_user@yopmail.com',
                password: 'password123',
                role: 'customer',
                isVerified: true
            });
            console.log("Created critic user.");
        }

        // 4. Create 15 low reviews
        const reviewsToCreate = [];
        for (let i = 0; i < 15; i++) {
            // Note: mongoose schema has { productId, userId } unique index constraint, so we must make dummy userId or bypass
            reviewsToCreate.push({
                productId: product._id,
                userId: new mongoose.Types.ObjectId(),
                rating: i % 2 === 0 ? 1 : 2, // consistently negative (1 or 2 stars)
                comment: 'Consistently terrible quality product! Do not buy! #' + i,
                isApproved: true
            });
        }
        await Review.insertMany(reviewsToCreate);
        console.log("Inserted 15 negative customer reviews.");

        // Clean up and notify
        console.log("\n--- TEST DATA SETUP COMPLETED ---");
        console.log("Product ID:", product._id);
        console.log("Run the server, login as Admin, open this product, and check if Poor Customer Reviews Warning Banner and Remove Product trigger are present.");
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error("Test setup error:", err);
        process.exit(1);
    }
};

runTest();
