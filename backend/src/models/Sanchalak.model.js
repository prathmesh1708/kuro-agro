import mongoose from 'mongoose';
import { fieldAccountFields, applyFieldAccountBehaviour } from './shared/fieldAccount.js';

// Kisan Vyapar Kendra operator (Manager / Sanchalak)
const sanchalakSchema = new mongoose.Schema(
    {
        ...fieldAccountFields(),
        sanchalakCode: { type: String, unique: true, uppercase: true, trim: true },
        kendraName: { type: String, required: true, trim: true },
    },
    { timestamps: true }
);

applyFieldAccountBehaviour(sanchalakSchema, { codeField: 'sanchalakCode', codePrefix: 'SAN' });

const Sanchalak = mongoose.model('Sanchalak', sanchalakSchema);
export { Sanchalak };
export default Sanchalak;
