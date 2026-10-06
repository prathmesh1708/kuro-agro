import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
    {
        title: String,
        subtitle: String,
        description: String,
        image: { type: String, required: true },
        link: String,
        type: {
            type: String,
            enum: ['home_slider', 'festival_offer', 'banner', 'hero', 'promotional', 'side_banner'],
            default: 'banner',
        },
        order: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
        startDate: Date,
        endDate: Date,
    },
    { timestamps: true }
);

const Banner = mongoose.model('Banner', bannerSchema);
export { Banner };
export default Banner;
