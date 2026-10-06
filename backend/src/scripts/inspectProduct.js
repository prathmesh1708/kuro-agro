import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getEffectiveGstRate, calculateGst } from '../services/gst.service.js';

dotenv.config();

const inspect = async () => {
    try {
        const uri = process.env.MONGO_URI || "mongodb://localhost:27017/megamart";
        console.log("Connecting to:", uri);
        await mongoose.connect(uri);
        console.log("Connected.");

        const productId = "6a6848868c857498b1daa597";
        const categoryId = "6a4e130d5327100bd73d9436";
        const price = 450;
        const taxIncluded = false;

        console.log("Resolving GST rate...");
        const effective = await getEffectiveGstRate(productId, categoryId);
        console.log("EFFECTIVE RATE RESULT:", effective);

        console.log("Calculating GST components...");
        const calculations = calculateGst(price, effective.rate, taxIncluded);
        console.log("CALCULATIONS RESULT:", calculations);

        await mongoose.connection.close();
        console.log("DB Connection closed.");
    } catch (err) {
        console.error("Error:", err);
    }
};

inspect();
