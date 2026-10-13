import Kisan from '../models/Kisan.model.js';

const idOf = (value) => value?._id || value;

/**
 * Returns the Kisan account for an approved farmer registration, creating it on first use.
 * Called when admin approves a farmer, and on login for farmers approved before Kisan accounts existed.
 */
export const ensureKisanForRegistration = async (registration) => {
    const existing = await Kisan.findOne({ registration: registration._id });
    if (existing) return existing;

    try {
        return await Kisan.create({
            registration: registration._id,
            surveyor: idOf(registration.surveyor),
            sanchalak: idOf(registration.sanchalak),
            name: registration.name,
            fatherName: registration.fatherName,
            phone: registration.mobile,
            email: registration.email,
            address: {
                village: registration.village,
                panchayat: registration.panchayat,
                block: registration.block,
                district: registration.district,
            },
        });
    } catch (err) {
        // Two approvals racing for the same registration: the other one created it.
        if (err?.code === 11000) return Kisan.findOne({ registration: registration._id });
        throw err;
    }
};
