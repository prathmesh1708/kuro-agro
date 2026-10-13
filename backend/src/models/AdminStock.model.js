import mongoose from 'mongoose';

// Central (admin) stock of one produce, received from Sanchalaks.
// Admin moves it into a store Product's stock when it is packed for sale.
const adminStockSchema = new mongoose.Schema(
    {
        produce: { type: mongoose.Schema.Types.ObjectId, ref: 'Produce', required: true, unique: true },
        produceName: { type: String, required: true, trim: true },
        unit: { type: String, required: true },
        quantityKg: { type: Number, default: 0, min: 0 },
        receivedKg: { type: Number, default: 0, min: 0 },
        receivedValue: { type: Number, default: 0, min: 0 },
        movedToProductsKg: { type: Number, default: 0, min: 0 },
        lastReceivedAt: { type: Date },
    },
    { timestamps: true }
);

const AdminStock = mongoose.model('AdminStock', adminStockSchema);
export { AdminStock };
export default AdminStock;
