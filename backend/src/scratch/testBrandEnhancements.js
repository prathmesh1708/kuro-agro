import "dotenv/config";
import connectDB from "../config/db.js";
import mongoose from "mongoose";
import Brand from "../models/Brand.model.js";
import Product from "../models/Product.model.js";

const run = async () => {
    await connectDB();
    console.log("Connected to DB successfully.");

    const testName1 = "TestApple";
    const testName2 = " testapple ";
    const testName3 = "TESTAPPLE";

    // Clean up any test brands first
    await Brand.deleteMany({ name: { $regex: /testapple/i } });

    console.log("Creating test brand: TestApple");
    const b1 = await Brand.create({
        name: testName1,
        slug: "testapple",
        status: "Approved"
    });

    const checkDuplicate = async (name) => {
        const trimmedName = name.replace(/\s+/g, ' ').trim();
        const cleanRegexName = trimmedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const existingBrand = await Brand.findOne({
            name: { $regex: new RegExp(`^\\s*${cleanRegexName}\\s*$`, 'i') }
        });
        return !!existingBrand;
    };

    const isDup2 = await checkDuplicate(testName2);
    const isDup3 = await checkDuplicate(testName3);
    console.log(`Checking duplicate for ' testapple ': ${isDup2} (Expected: true)`);
    console.log(`Checking duplicate for 'TESTAPPLE': ${isDup3} (Expected: true)`);

    if (isDup2 && isDup3) {
        console.log("✅ Case-insensitive duplicate checking logic passed.");
    } else {
        console.log("❌ Case-insensitive duplicate checking logic failed.");
    }

    // Clean up
    await Brand.deleteOne({ _id: b1._id });
    console.log("Cleanup done. Disconnecting...");
    await mongoose.disconnect();
};

run().catch(console.error);
