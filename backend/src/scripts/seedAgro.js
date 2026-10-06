// Seeds the KuroAgro agriculture catalog: categories, brands, vendors, products and banners.
// Source images live in backend/seed-assets/agro. Each run uploads them to Cloudinary
// (kuroagro/seed/...) with fixed public IDs, so re-running replaces images instead of duplicating them.
// If Cloudinary is not configured yet, images are copied to frontend/public/images/agro as a temporary
// fallback; re-run after adding the Cloudinary keys to move everything to Cloudinary.
//
//   node src/scripts/seedAgro.js           upsert the catalog (safe to re-run)
//   node src/scripts/seedAgro.js --reset   first delete ALL categories, brands, products, banners and campaigns
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import cloudinary, { ensureCloudinaryConfig } from '../config/cloudinary.js';
import Category from '../models/Category.model.js';
import Brand from '../models/Brand.model.js';
import Vendor from '../models/Vendor.model.js';
import Product from '../models/Product.model.js';
import Banner from '../models/Banner.model.js';
import Campaign from '../models/Campaign.model.js';
import Coupon from '../models/Coupon.model.js';

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error('❌ MONGO_URI not set in .env');
    process.exit(1);
}

const RESET = process.argv.includes('--reset');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, '../../seed-assets/agro');
const LOGO_FILE = path.resolve(__dirname, '../../../frontend/src/assets/kuro-agro-logo.png');
const LOCAL_FALLBACK_DIR = path.resolve(__dirname, '../../../frontend/public/images/agro');
const LOCAL_FALLBACK_URL = '/images/agro';

// Seed data refers to images by asset path (e.g. "products/urea.jpg"); uploadAssets() maps them to Cloudinary URLs.
const IMG = 'asset:';
const productImg = (key) => `${IMG}products/${key}.jpg`;
const assetUrls = {};
const url = (ref) => {
    if (!String(ref).startsWith(IMG)) return ref;
    const resolved = assetUrls[ref.slice(IMG.length)];
    if (!resolved) throw new Error(`No uploaded image for ${ref}`);
    return resolved;
};

const listAssetFiles = () => {
    const files = [['brand/logo.png', LOGO_FILE]];
    for (const dir of ['products', 'categories', 'banners', 'brands']) {
        for (const name of fs.readdirSync(path.join(ASSETS_DIR, dir))) {
            files.push([`${dir}/${name}`, path.join(ASSETS_DIR, dir, name)]);
        }
    }
    return files;
};

const cloudinaryReady = async () => {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET || CLOUDINARY_CLOUD_NAME === 'your_cloud_name') {
        return false;
    }
    ensureCloudinaryConfig();
    try {
        await cloudinary.api.ping();
        return true;
    } catch (err) {
        console.warn(`⚠️  Cloudinary rejected the credentials: ${err.error?.message || err.message}`);
        return false;
    }
};

const uploadAssets = async () => {
    const files = listAssetFiles();

    if (await cloudinaryReady()) {
        for (const [ref, file] of files) {
            const parsed = path.parse(ref);
            const result = await cloudinary.uploader.upload(file, {
                folder: `kuroagro/seed/${parsed.dir}`,
                public_id: parsed.name,
                overwrite: true,
                invalidate: true,
                resource_type: 'image',
            });
            assetUrls[ref] = result.secure_url;
        }
        fs.rmSync(LOCAL_FALLBACK_DIR, { recursive: true, force: true });
        console.log(`☁️  Uploaded ${files.length} images to Cloudinary (kuroagro/seed)`);
        return;
    }

    for (const [ref, file] of files) {
        const target = path.join(LOCAL_FALLBACK_DIR, ref);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(file, target);
        assetUrls[ref] = `${LOCAL_FALLBACK_URL}/${ref}`;
    }
    console.warn(`⚠️  Cloudinary is not configured: copied ${files.length} images to frontend/public/images/agro instead.`);
    console.warn('   Add CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET to backend/.env and re-run to move them to Cloudinary.');
};

const categories = [
    { slug: 'seeds', name: 'Seeds', description: 'Certified vegetable, cereal and field crop seeds (beej).', image: `${IMG}categories/seeds.jpg` },
    { slug: 'fertilizers', name: 'Fertilizers (Khad)', description: 'Urea, DAP, NPK, potash and other chemical fertilizers.', image: `${IMG}categories/fertilizers.jpg` },
    { slug: 'organic-manure', name: 'Organic Manure', description: 'Vermicompost, cow dung manure, neem cake and compost.', image: `${IMG}categories/organic-manure.jpg` },
    { slug: 'crop-protection', name: 'Crop Protection', description: 'Bio-pesticides, fungicides and pest traps.', image: `${IMG}categories/crop-protection.jpg` },
    { slug: 'plant-nutrition', name: 'Plant Nutrition', description: 'Micronutrients, growth promoters and soil conditioners.', image: `${IMG}categories/plant-nutrition.jpg` },
    { slug: 'irrigation', name: 'Irrigation', description: 'Drip kits, sprinklers, laterals and hose pipes.', image: `${IMG}categories/irrigation.jpg` },
    { slug: 'farm-tools', name: 'Farm Tools', description: 'Hand tools for weeding, digging and harvesting.', image: `${IMG}categories/farm-tools.jpg` },
    { slug: 'sprayers', name: 'Sprayers', description: 'Battery and manual knapsack sprayers, nozzles and spray bottles.', image: `${IMG}categories/sprayers.jpg` },
];

const brands = [
    { slug: 'kuroagro-organics', name: 'KuroAgro Organics', description: 'KuroAgro house brand for organic inputs.' },
    { slug: 'kisan-gold', name: 'Kisan Gold', description: 'Fertilizers for field crops.' },
    { slug: 'harit-shakti', name: 'Harit Shakti', description: 'Crop protection and plant nutrition.' },
    { slug: 'beejsampada', name: 'BeejSampada', description: 'High-germination seeds.' },
    { slug: 'jaldhara', name: 'JalDhara', description: 'Water-saving irrigation products.' },
    { slug: 'krishiveer', name: 'KrishiVeer', description: 'Durable farm tools and sprayers.' },
].map((b) => ({ ...b, logo: `${IMG}brands/${b.slug}.jpg`, country: 'India', status: 'Approved', isActive: true }));

const address = (city, state, zipCode) => ({ street: 'Main Market Road', city, state, zipCode, country: 'India' });

const vendors = [
    {
        key: 'official', email: 'kuroagro.store@example.com', phone: '9000000001',
        name: 'KuroAgro Official', storeName: 'KuroAgro Official Store', storeLogo: `${IMG}brand/logo.png`,
        storeDescription: 'Seeds, fertilizers and organic manure sourced directly by KuroAgro.',
        address: address('Nagpur', 'Maharashtra', '440001'),
    },
    {
        key: 'greenvalley', email: 'greenvalley@example.com', phone: '9000000002',
        name: 'Green Valley Agri', storeName: 'Green Valley Agri Centre', storeLogo: `${IMG}brands/green-valley.jpg`,
        storeDescription: 'Crop protection and plant nutrition experts.',
        address: address('Nashik', 'Maharashtra', '422001'),
    },
    {
        key: 'kisantools', email: 'kisantools@example.com', phone: '9000000003',
        name: 'Kisan Tools', storeName: 'Kisan Tools & Irrigation', storeLogo: `${IMG}brands/kisan-tools.jpg`,
        storeDescription: 'Irrigation systems, sprayers and hand tools for every farm.',
        address: address('Indore', 'Madhya Pradesh', '452001'),
    },
];
const VENDOR_PASSWORD = 'vendor123';

// [category, brand, vendor, image, name, unit, price, originalPrice, stockQty, weightKg, hsn, gst%, flags, description, tags]
const products = [
    ['seeds', 'beejsampada', 'official', 'tomato-seeds', 'Hybrid Tomato Seeds (10 g)', 'Packet', 185, 240, 400, 0.05, '1209', 0, 'new',
        'High-yielding hybrid tomato seeds with strong disease tolerance. Suitable for kharif and rabi seasons; about 2,500 seeds per packet.', ['tomato', 'vegetable seeds', 'beej']],
    ['seeds', 'beejsampada', 'official', 'wheat-seeds', 'Wheat Seeds HD-2967 (40 kg)', 'Bag', 1850, 2150, 120, 40, '1001', 0, 'featured',
        'Certified HD-2967 wheat seed, a popular high-yield rabi variety for irrigated conditions in North and Central India.', ['wheat', 'gehu', 'rabi', 'beej']],
    ['seeds', 'beejsampada', 'official', 'paddy-seeds', 'Basmati Paddy Seeds 1121 (10 kg)', 'Bag', 960, 1150, 150, 10, '1006', 0, 'flash',
        'Pusa Basmati 1121 paddy seed known for extra-long, aromatic grains. Treated and tested for germination.', ['paddy', 'dhan', 'basmati', 'kharif']],
    ['seeds', 'beejsampada', 'official', 'okra-seeds', 'Okra (Bhindi) Hybrid Seeds (250 g)', 'Packet', 420, 520, 250, 0.25, '1209', 0, '',
        'Hybrid bhindi seeds giving dark green, tender pods with good resistance to yellow vein mosaic virus.', ['okra', 'bhindi', 'vegetable seeds']],

    ['fertilizers', 'kisan-gold', 'official', 'urea', 'Urea 46% Nitrogen (45 kg)', 'Bag', 266.5, undefined, 500, 45, '3102', 5, 'featured',
        'Neem-coated urea with 46% nitrogen for vigorous vegetative growth. Sold at government-notified MRP.', ['urea', 'khad', 'nitrogen']],
    ['fertilizers', 'kisan-gold', 'official', 'dap', 'DAP 18:46:0 (50 kg)', 'Bag', 1350, undefined, 300, 50, '3105', 5, '',
        'Di-ammonium phosphate with 18% nitrogen and 46% phosphorus. Ideal basal dose for strong root development.', ['dap', 'khad', 'phosphorus']],
    ['fertilizers', 'kisan-gold', 'official', 'npk', 'NPK 19:19:19 Water Soluble (1 kg)', 'Kg', 165, 199, 600, 1, '3105', 5, 'flash',
        '100% water-soluble balanced NPK for foliar spray and drip fertigation during all growth stages.', ['npk', 'khad', 'water soluble']],
    ['fertilizers', 'kisan-gold', 'official', 'potash', 'Muriate of Potash 60% K (50 kg)', 'Bag', 1700, 1800, 200, 50, '3104', 5, '',
        'MOP with 60% potassium to improve grain filling, fruit quality and drought tolerance.', ['potash', 'mop', 'khad']],

    ['organic-manure', 'kuroagro-organics', 'official', 'vermicompost', 'Premium Vermicompost (25 kg)', 'Bag', 449, 599, 350, 25, '3101', 0, 'featured,new',
        'Sieved, earthworm-processed vermicompost rich in humus and beneficial microbes. Improves soil structure and water holding.', ['vermicompost', 'organic khad', 'jaivik']],
    ['organic-manure', 'kuroagro-organics', 'official', 'neem-cake', 'Neem Cake Powder (5 kg)', 'Bag', 340, 420, 300, 5, '2306', 0, '',
        'Cold-pressed neem cake that nourishes soil and helps control nematodes and soil-borne pests naturally.', ['neem khali', 'organic', 'jaivik']],
    ['organic-manure', 'kuroagro-organics', 'official', 'cow-manure', 'Well-Rotted Cow Dung Manure (20 kg)', 'Bag', 299, 380, 400, 20, '3101', 0, '',
        'Fully decomposed gobar khad, weed-seed free. Suitable for kitchen gardens, nurseries and field crops.', ['gobar khad', 'cow dung', 'organic']],
    ['organic-manure', 'kuroagro-organics', 'official', 'compost', 'Organic Compost (10 kg)', 'Bag', 249, 320, 450, 10, '3101', 0, '',
        'Balanced plant-based compost for potting mixes and top dressing.', ['compost', 'organic khad']],

    ['crop-protection', 'harit-shakti', 'greenvalley', 'neem-oil', 'Cold-Pressed Neem Oil 10000 PPM (1 L)', 'Litre', 549, 699, 300, 1, '3808', 18, 'flash',
        'Azadirachtin-rich neem oil, a broad-spectrum botanical pesticide against aphids, whiteflies and mites.', ['neem oil', 'bio pesticide', 'organic']],
    ['crop-protection', 'harit-shakti', 'greenvalley', 'trichoderma', 'Trichoderma Viride Bio-Fungicide (1 kg)', 'Kg', 279, 350, 250, 1, '3808', 18, 'new',
        'Beneficial fungus for seed and soil treatment that protects against root rot, wilt and damping-off.', ['trichoderma', 'bio fungicide']],
    ['crop-protection', 'harit-shakti', 'greenvalley', 'pheromone-trap', 'Fruit Fly Pheromone Trap with Lure (Pack of 5)', 'Pack', 399, 499, 200, 0.5, '3808', 18, '',
        'Reusable pheromone traps for monitoring and mass-trapping fruit flies in orchards and vegetables.', ['pheromone trap', 'pest control']],
    ['crop-protection', 'harit-shakti', 'greenvalley', 'bordeaux', 'Copper Sulphate (Neela Thotha) 98% (1 kg)', 'Kg', 320, 380, 220, 1, '2833', 18, '',
        'High-purity copper sulphate for preparing Bordeaux mixture against fungal diseases.', ['copper sulphate', 'neela thotha', 'fungicide']],

    ['plant-nutrition', 'harit-shakti', 'greenvalley', 'humic-acid', 'Humic Acid 98% Flakes (1 kg)', 'Kg', 420, 520, 260, 1, '3824', 18, 'featured',
        'Soluble humic acid flakes that boost root growth, nutrient uptake and soil health.', ['humic acid', 'soil conditioner']],
    ['plant-nutrition', 'harit-shakti', 'greenvalley', 'seaweed', 'Seaweed Extract Liquid (500 ml)', 'Bottle', 379, 450, 240, 0.6, '3101', 5, 'new',
        'Natural seaweed bio-stimulant for better flowering, fruit set and stress tolerance.', ['seaweed', 'bio stimulant']],
    ['plant-nutrition', 'harit-shakti', 'greenvalley', 'micronutrient', 'Zinc Sulphate 33% (5 kg)', 'Bag', 450, 540, 220, 5, '2833', 5, '',
        'Corrects zinc deficiency (khaira disease) in paddy, wheat and maize.', ['zinc', 'micronutrient']],
    ['plant-nutrition', 'kisan-gold', 'greenvalley', 'calcium-nitrate', 'Calcium Ammonium Nitrate (25 kg)', 'Bag', 780, 860, 180, 25, '3102', 5, '',
        'CAN fertilizer supplying nitrogen and calcium for strong cell walls and better fruit quality.', ['can', 'calcium', 'khad']],

    ['irrigation', 'jaldhara', 'kisantools', 'drip-kit', 'Drip Irrigation Kit (100 Plants)', 'Kit', 2499, 3199, 80, 6, '8424', 12, 'featured,flash',
        'Complete drip kit with mainline, laterals, drippers and filter. Saves up to 60% water.', ['drip', 'irrigation', 'water saving']],
    ['irrigation', 'jaldhara', 'kisantools', 'hose', 'Garden Hose Pipe with Spray Nozzle (30 m)', 'Piece', 899, 1199, 150, 4, '3917', 18, '',
        'Kink-resistant braided hose with a multi-pattern spray nozzle.', ['hose pipe', 'garden']],
    ['irrigation', 'jaldhara', 'kisantools', 'sprinkler', 'Impact Sprinkler Head (Brass)', 'Piece', 649, 799, 160, 0.6, '8424', 12, 'new,flash',
        'Full-circle and part-circle brass impact sprinkler for uniform field coverage.', ['sprinkler', 'irrigation']],
    ['irrigation', 'jaldhara', 'kisantools', 'drip-lateral', 'Drip Lateral Pipe 16 mm (100 m)', 'Roll', 1150, 1400, 120, 8, '3917', 18, '',
        'UV-stabilised LLDPE lateral pipe for drip systems.', ['drip pipe', 'lateral', 'irrigation']],

    ['farm-tools', 'krishiveer', 'kisantools', 'khurpi', 'Khurpi Hand Weeder', 'Piece', 149, 199, 500, 0.3, '8201', 0, '',
        'Forged steel khurpi with a comfortable wooden handle for weeding and loosening soil.', ['khurpi', 'weeder', 'hand tool']],
    ['farm-tools', 'krishiveer', 'kisantools', 'hoe', 'Phawda Hoe with Wooden Handle', 'Piece', 549, 650, 200, 2.5, '8201', 0, '',
        'Heavy-duty phawda for digging, earthing up and making ridges and channels.', ['phawda', 'hoe', 'kudal']],
    ['farm-tools', 'krishiveer', 'kisantools', 'spade', 'Garden Digging Fork', 'Piece', 499, 620, 180, 1.8, '8201', 0, 'new',
        'Four-tine steel digging fork for turning soil, compost and manure.', ['digging fork', 'garden tool']],
    ['farm-tools', 'krishiveer', 'kisantools', 'sickle', 'Darati Sickle (Hasiya)', 'Piece', 189, 240, 400, 0.4, '8201', 0, '',
        'Serrated, hardened-steel sickle for harvesting wheat, paddy and fodder.', ['sickle', 'hasiya', 'darati']],

    ['sprayers', 'krishiveer', 'kisantools', 'battery-sprayer', 'Battery Knapsack Sprayer (16 L)', 'Piece', 2799, 3499, 90, 6, '8424', 12, 'featured,flash',
        '12V rechargeable battery sprayer with adjustable pressure and multiple nozzles. Sprays up to 2 acres per charge.', ['battery sprayer', 'pump', 'spray machine']],
    ['sprayers', 'krishiveer', 'kisantools', 'manual-sprayer', 'Manual Knapsack Sprayer (16 L)', 'Piece', 1299, 1599, 120, 4.5, '8424', 12, '',
        'Lever-operated knapsack sprayer with brass lance for pesticides and foliar nutrients.', ['manual sprayer', 'knapsack']],
    ['sprayers', 'jaldhara', 'kisantools', 'hand-sprayer', 'Hand Pressure Spray Bottle (1 L)', 'Piece', 149, 199, 600, 0.2, '8424', 12, '',
        'Trigger spray bottle for nurseries, kitchen gardens and indoor plants.', ['spray bottle', 'garden']],
    ['sprayers', 'krishiveer', 'kisantools', 'spray-nozzle', 'Brass Spray Nozzle Set (5 pcs)', 'Set', 249, 320, 300, 0.3, '8424', 12, '',
        'Hollow-cone, flat-fan and adjustable nozzles that fit most knapsack sprayers.', ['nozzle', 'sprayer parts']],
];

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const upsert = (Model, filter, doc) =>
    Model.findOneAndUpdate(filter, { $set: doc }, { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true });

const run = async () => {
    await uploadAssets();
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    if (RESET) {
        const [c, b, p, bn, cp] = await Promise.all([
            Category.deleteMany({}), Brand.deleteMany({}), Product.deleteMany({}), Banner.deleteMany({}), Campaign.deleteMany({}),
        ]);
        console.log(`🧹 Reset: removed ${c.deletedCount} categories, ${b.deletedCount} brands, ${p.deletedCount} products, ${bn.deletedCount} banners, ${cp.deletedCount} campaigns`);
    }

    const catIds = {};
    for (const [order, cat] of categories.entries()) {
        const doc = await upsert(Category, { slug: cat.slug }, { ...cat, image: url(cat.image), order: order + 1, isActive: true, parentId: null });
        catIds[cat.slug] = doc._id;
    }
    console.log(`🌾 Categories: ${categories.length}`);

    const brandIds = {};
    for (const brand of brands) {
        const doc = await upsert(Brand, { slug: brand.slug }, { ...brand, logo: url(brand.logo) });
        brandIds[brand.slug] = doc._id;
    }
    console.log(`🏷️  Brands: ${brands.length}`);

    // Vendors go through save() so the password pre-save hook hashes it.
    const vendorIds = {};
    for (const { key, ...data } of vendors) {
        let vendor = await Vendor.findOne({ email: data.email }).select('+password');
        if (!vendor) vendor = new Vendor({ email: data.email });
        Object.assign(vendor, data, {
            storeLogo: url(data.storeLogo),
            password: VENDOR_PASSWORD,
            status: 'approved',
            isVerified: true,
            commissionRate: 10,
            businessAddress: data.address,
        });
        await vendor.save();
        vendorIds[key] = vendor._id;
    }
    console.log(`🏪 Vendors: ${vendors.length} (password: ${VENDOR_PASSWORD})`);

    for (const [category, brand, vendor, img, name, unit, price, originalPrice, stockQuantity, weight, hsnCode, taxRate, flags, description, tags] of products) {
        const flagSet = new Set(flags.split(',').filter(Boolean));
        const slug = slugify(name);
        await upsert(Product, { slug }, {
            name,
            slug,
            description,
            price,
            ...(originalPrice ? { originalPrice } : {}),
            unit,
            image: url(productImg(img)),
            images: [url(productImg(img))],
            categoryId: catIds[category],
            brandId: brandIds[brand],
            vendorId: vendorIds[vendor],
            stock: 'in_stock',
            stockQuantity,
            lowStockThreshold: 10,
            minimumOrderQuantity: 1,
            weight,
            hsnCode,
            taxRate,
            taxIncluded: true,
            tags,
            flashSale: flagSet.has('flash'),
            isNewArrival: flagSet.has('new'),
            isFeatured: flagSet.has('featured'),
            isActive: true,
            isVisible: true,
            codAllowed: true,
            returnable: !['seeds', 'fertilizers', 'crop-protection'].includes(category),
        });
    }
    console.log(`📦 Products: ${products.length}`);

    // Campaigns power the Daily Deals, Flash Sale, Offers and /sale/:slug pages.
    // discountValue is only a label, so it is set to the smallest real discount among the campaign products.
    const seeded = await Product.find({ slug: { $in: products.map((p) => slugify(p[4])) } }).lean();
    const pct = (p) => (p.originalPrice > p.price ? Math.floor(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0);
    const inCategories = (slugs) => (p) => slugs.some((slug) => String(p.categoryId) === String(catIds[slug]));
    const discounted = seeded.filter((p) => pct(p) > 0);
    const campaigns = [
        {
            slug: 'kharif-flash-sale', name: 'Kharif Flash Sale', type: 'flash_sale',
            description: 'Limited-time prices on seeds, sprayers and irrigation for the kharif season.',
            items: discounted.filter((p) => p.flashSale),
            banner: ['Kharif Flash Sale', 'Limited-time prices for the sowing season', 'banners/hero-paddy.jpg'],
        },
        {
            slug: 'daily-krishi-deals', name: 'Daily Krishi Deals', type: 'daily_deal',
            description: 'The biggest discounts across the store, refreshed by our team.',
            items: discounted.filter((p) => !p.flashSale).sort((a, b) => pct(b) - pct(a)).slice(0, 8),
            banner: ['Daily Krishi Deals', 'Top discounts on farm essentials', 'banners/hero-farmer.jpg'],
        },
        {
            slug: 'go-organic-offer', name: 'Go Organic Offer', type: 'special_offer',
            description: 'Organic manure and plant nutrition for healthier soil.',
            items: discounted.filter(inCategories(['organic-manure', 'plant-nutrition'])),
            banner: ['Go Organic', 'Vermicompost, neem cake and bio-stimulants', 'banners/side-organic.jpg'],
        },
        {
            slug: 'sowing-season-festival', name: 'Sowing Season Festival', type: 'festival',
            description: 'Everything you need to sow: seeds, sprayers and irrigation.',
            items: discounted.filter(inCategories(['seeds', 'sprayers', 'irrigation'])),
            banner: ['Sowing Season Festival', 'Seeds, sprayers and irrigation', 'banners/hero-wheat.jpg'],
        },
    ];
    for (const { slug, items, banner, ...data } of campaigns) {
        await upsert(Campaign, { slug }, {
            ...data,
            slug,
            route: `/sale/${slug}`,
            status: 'active',
            isActive: true,
            discountType: 'percentage',
            discountValue: Math.min(...items.map(pct)),
            productIds: items.map((p) => String(p._id)),
            autoCreateBanner: false,
            bannerConfig: { title: banner[0], subtitle: banner[1], image: url(`${IMG}${banner[2]}`), customImage: true },
        });
    }
    console.log(`🎯 Campaigns: ${campaigns.length} (${campaigns.map((c) => `${c.slug}: ${c.items.length}`).join(', ')})`);

    const coupons = [
        { code: 'KISAN10', name: '10% off on orders above ₹999', type: 'percentage', value: 10, minOrderValue: 999, maxDiscount: 300 },
        { code: 'KHAD100', name: '₹100 off on orders above ₹1,500', type: 'fixed', value: 100, minOrderValue: 1500 },
        { code: 'FREESHIP', name: 'Free shipping on orders above ₹499', type: 'freeship', value: 0, minOrderValue: 499 },
    ];
    for (const coupon of coupons) {
        await upsert(Coupon, { code: coupon.code }, { ...coupon, isActive: true });
    }
    console.log(`🎟️  Coupons: ${coupons.map((c) => c.code).join(', ')}`);

    const banners = [
        { type: 'home_slider', order: 1, image: `${IMG}banners/hero-wheat.jpg`, title: 'Quality Seeds for Every Season', subtitle: 'Certified, high-germination seeds for rabi and kharif', link: `/category/${catIds.seeds}` },
        { type: 'home_slider', order: 2, image: `${IMG}banners/hero-paddy.jpg`, title: 'Khad at the Right Price', subtitle: 'Urea, DAP, NPK and potash delivered to your village', link: `/category/${catIds.fertilizers}` },
        { type: 'home_slider', order: 3, image: `${IMG}banners/hero-farmer.jpg`, title: 'Tools Built for Indian Farms', subtitle: 'Sprayers, irrigation and hand tools', link: `/category/${catIds['farm-tools']}` },
        { type: 'side_banner', order: 1, image: `${IMG}banners/side-organic.jpg`, title: '100% ORGANIC', subtitle: 'Vermicompost, neem cake and more', link: `/category/${catIds['organic-manure']}` },
        { type: 'promotional', order: 1, image: productImg('battery-sprayer'), title: 'Sowing Season Sale', subtitle: 'Seeds, sprayers and more', description: 'Up to 25% OFF', link: '/offers' },
        { type: 'promotional', order: 2, image: productImg('drip-kit'), title: 'Save Water with Drip', subtitle: 'Irrigation kits and sprinklers', description: 'Save 20%', link: `/category/${catIds.irrigation}` },
        { type: 'promotional', order: 3, image: productImg('vermicompost'), title: 'Go Organic', subtitle: 'Vermicompost, neem cake and gobar khad', description: 'From ₹249', link: `/category/${catIds['organic-manure']}` },
    ];
    for (const banner of banners) {
        await upsert(Banner, { type: banner.type, title: banner.title }, { ...banner, image: url(banner.image), isActive: true });
    }
    console.log(`🖼️  Banners: ${banners.length}`);
};

run()
    .then(() => console.log('✅ KuroAgro catalog seeded'))
    .catch((err) => {
        console.error('❌ Seed failed:', err.message);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
