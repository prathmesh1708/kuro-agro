import mongoose from 'mongoose';
import { fieldAccountFields, applyFieldAccountBehaviour } from './shared/fieldAccount.js';

// Kisan Vyapar Kendra operator (Manager / Sanchalak)
const sanchalakSchema = new mongoose.Schema(
    {
        ...fieldAccountFields(),
        phone: { type: String, required: false, unique: true, sparse: true, trim: true, default: undefined },
        isPhoneVerified: { type: Boolean, default: true },
        sanchalakCode: { type: String, unique: true, uppercase: true, trim: true },
        kendraName: { type: String, required: true, trim: true },
    },
    { timestamps: true }
);

applyFieldAccountBehaviour(sanchalakSchema, { codeField: 'sanchalakCode', codePrefix: 'SAN' });

const Sanchalak = mongoose.model('Sanchalak', sanchalakSchema);
export { Sanchalak };
export default Sanchalak;
