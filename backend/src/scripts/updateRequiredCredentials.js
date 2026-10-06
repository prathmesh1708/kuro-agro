import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.model.js';
import Admin from '../models/Admin.model.js';
import Vendor from '../models/Vendor.model.js';
import DeliveryBoy from '../models/DeliveryBoy.model.js';

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('MONGO_URI not set in .env');
    process.exit(1);
}

const updateCredentials = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // 1. Admin Credentials (password: admin@123)
        const adminEmail = 'admin@admin.com';
        const adminPassword = 'admin@123';
        const existingAdmin = await Admin.findOne({ email: adminEmail });
        if (existingAdmin) {
            existingAdmin.password = adminPassword;
            existingAdmin.isActive = true;
            await existingAdmin.save();
            console.log(`✅ Admin updated: ${adminEmail} / ${adminPassword}`);
        } else {
            await Admin.create({
                name: 'Super Admin',
                email: adminEmail,
                password: adminPassword,
                role: 'superadmin',
                isActive: true
            });
            console.log(`✅ Admin created: ${adminEmail} / ${adminPassword}`);
        }

        // 2. User Credentials (password: 123456)
        const userEmail = 'palakpatel0342@gmail.com';
        const userPassword = '123456';
        const existingUser = await User.findOne({ email: userEmail });
        if (existingUser) {
            existingUser.password = userPassword;
            existingUser.isActive = true;
            existingUser.isVerified = true;
            await existingUser.save();
            console.log(`✅ User updated: ${userEmail} / ${userPassword}`);
        } else {
            await User.create({
                name: 'Palak Patel',
                email: userEmail,
                password: userPassword,
                role: 'customer',
                isActive: true,
                isVerified: true
            });
            console.log(`✅ User created: ${userEmail} / ${userPassword}`);
        }

        // 3. Vendor Credentials (password: 123456)
        const vendorEmail = 'palakpatel0342@gmail.com';
        const vendorPassword = '123456';
        const existingVendor = await Vendor.findOne({ email: vendorEmail });
        if (existingVendor) {
            existingVendor.password = vendorPassword;
            existingVendor.status = 'approved';
            existingVendor.isVerified = true;
            await existingVendor.save();
            console.log(`✅ Vendor updated: ${vendorEmail} / ${vendorPassword}`);
        } else {
            await Vendor.create({
                name: 'Palak Store Owner',
                email: vendorEmail,
                password: vendorPassword,
                phone: '+919999999999',
                storeName: 'Palak Shop',
                status: 'approved',
                isVerified: true,
                commissionRate: 10
            });
            console.log(`✅ Vendor created: ${vendorEmail} / ${vendorPassword}`);
        }

        // 4. Delivery Credentials (password: 123456)
        const deliveryEmail = 'palakpatel0342@gmail.com';
        const deliveryPassword = '123456';
        const existingDelivery = await DeliveryBoy.findOne({ email: deliveryEmail });
        if (existingDelivery) {
            existingDelivery.password = deliveryPassword;
            existingDelivery.isActive = true;
            existingDelivery.isAvailable = true;
            existingDelivery.status = 'available';
            existingDelivery.applicationStatus = 'approved';
            await existingDelivery.save();
            console.log(`✅ Delivery updated: ${deliveryEmail} / ${deliveryPassword}`);
        } else {
            await DeliveryBoy.create({
                name: 'Palak Delivery Agent',
                email: deliveryEmail,
                password: deliveryPassword,
                phone: '+918888888888',
                isActive: true,
                isAvailable: true,
                status: 'available',
                applicationStatus: 'approved',
                vehicleType: 'Bike',
                vehicleNumber: 'DL-01-AB-9999'
            });
            console.log(`✅ Delivery created: ${deliveryEmail} / ${deliveryPassword}`);
        }

    } catch (err) {
        console.error('Update failed:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
        process.exit(0);
    }
};

updateCredentials();
