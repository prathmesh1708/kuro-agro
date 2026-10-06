import 'dotenv/config';
import mongoose from 'mongoose';
import Admin from '../models/Admin.model.js';

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌ MONGO_URI not set in .env');
    process.exit(1);
}

const seedAdmin = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const existing = await Admin.findOne({ email: 'admin@gmail.com' });

        if (existing) {
            // Update password in case it changed
            existing.password = '123456';
            existing.name = 'Super Admin';
            existing.role = 'superadmin';
            existing.isActive = true;
            await existing.save();
            console.log('✅ Admin credentials updated: admin@gmail.com / 123456');
        } else {
            await Admin.create({
                name: 'Super Admin',
                email: 'admin@gmail.com',
                password: '123456',
                role: 'superadmin',
                isActive: true,
            });
            console.log('✅ Admin created: admin@gmail.com / 123456');
        }
    } catch (err) {
        console.error('❌ Seed failed:', err.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
};

seedAdmin();
