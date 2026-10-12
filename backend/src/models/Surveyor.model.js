import mongoose from 'mongoose';
import { fieldAccountFields, applyFieldAccountBehaviour } from './shared/fieldAccount.js';

// Every surveyor belongs to one Sanchalak, linked at registration via the Sanchalak code.
const surveyorSchema = new mongoose.Schema(
    {
        ...fieldAccountFields(),
        sanchalak: { type: mongoose.Schema.Types.ObjectId, ref: 'Sanchalak', required: true, index: true },
        surveyorCode: { type: String, unique: true, uppercase: true, trim: true },
    },
    { timestamps: true }
);

surveyorSchema.index({ sanchalak: 1, status: 1 });

applyFieldAccountBehaviour(surveyorSchema, { codeField: 'surveyorCode', codePrefix: 'SUR' });

const Surveyor = mongoose.model('Surveyor', surveyorSchema);
export { Surveyor };
export default Surveyor;
