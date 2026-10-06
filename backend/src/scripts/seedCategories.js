import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Category from '../models/Category.model.js';

const categoriesToSeed = [
    {
        name: 'Clothing',
        slug: 'clothing',
        description: 'All apparel items (Tops, Bottoms, Dresses, Outerwear)',
        order: 1,
        isActive: true
    },
    {
        name: 'Footwear',
        slug: 'footwear',
        description: 'All shoes and boots',
        order: 2,
        isActive: true
    },
    {
        name: 'Bags',
        slug: 'bags',
        description: 'Handbags and crossbody bags',
        order: 3,
        isActive: true
    },
    {
        name: 'Jewelry',
        slug: 'jewelry',
        description: 'Necklaces and watches',
        order: 4,
        isActive: true
    },
    {
        name: 'Accessories',
        slug: 'accessories',
        description: 'Sunglasses, belts, scarves',
        order: 5,
        isActive: true
    },
    {
        name: 'Athletic',
        slug: 'athletic',
        description: 'Sport-specific clothing and shoes',
        order: 6,
        isActive: true
    }
];

const seed = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected. Clearing old categories...');
        await Category.deleteMany({});
        console.log('Inserting new categories...');
        await Category.insertMany(categoriesToSeed);
        console.log('Categories seeded successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error seeding categories:', err);
        process.exit(1);
    }
};

seed();
