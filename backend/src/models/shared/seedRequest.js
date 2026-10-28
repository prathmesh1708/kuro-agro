import mongoose from 'mongoose';

export { PAYMENT_METHODS } from './tradeRequest.js';

export const SEED_ACTOR_TYPES = ['admin', 'surveyor', 'kisan'];

/**
 * Fields shared by the seed distribution requests (Admin → Surveyor, Surveyor → Kisan).
 * The item name and unit are copied in so old records stay correct if the item is renamed.
 */
export const seedRequestFields = () => ({
    seedItem: { type: mongoose.Schema.Types.ObjectId, ref: 'SeedItem', required: true, index: true },
    seedName: { type: String, required: true, trim: true },
    unit: { type: String, required: true },
    // In the item's own unit (kg, kit, plant…), as entered. Not normalised.
    quantity: { type: Number, required: true, min: 0.01 },
    pricePerUnit: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    decidedAt: { type: Date },

    // Every status or payment change, newest last.
    history: [
        {
            _id: false,
            action: { type: String, required: true },
            byType: { type: String, enum: SEED_ACTOR_TYPES, required: true },
            by: { type: mongoose.Schema.Types.ObjectId },
            note: { type: String, trim: true },
            at: { type: Date, default: Date.now },
        },
    ],
});
