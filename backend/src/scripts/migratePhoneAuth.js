import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.model.js';
import Surveyor from '../models/Surveyor.model.js';
import Sanchalak from '../models/Sanchalak.model.js';

dotenv.config();

/**
 * One-off migration for phone-based registration (Customer, Surveyor, Sanchalak).
 *
 *  - Removes the placeholder `<phone>@raathi.com` emails that phone-OTP login used to create.
 *  - Clears empty-string emails/phones so the partial unique indexes ignore them.
 *  - Marks existing Surveyor/Sanchalak accounts as phone-verified (they registered when
 *    verification was switched off), so nobody is locked out.
 *  - Reports duplicate phone numbers, which block the unique phone index, and stops if any exist.
 *  - Replaces the old email/phone indexes with the partial unique ones from the models.
 *
 * Run it before deploying the new models: with the old non-partial email index in place,
 * a second account without an email cannot be created.
 *
 * Usage: node src/scripts/migratePhoneAuth.js            (dry run, changes nothing)
 *        node src/scripts/migratePhoneAuth.js --apply
 */
const APPLY = process.argv.includes('--apply');

const findDuplicatePhones = (Model) =>
    Model.aggregate([
        { $match: { phone: { $type: 'string', $ne: '' } } },
        { $group: { _id: '$phone', count: { $sum: 1 }, ids: { $push: '$_id' } } },
        { $match: { count: { $gt: 1 } } },
    ]);

const dropIndexIfPresent = async (Model, name) => {
    const indexes = await Model.collection.indexes();
    if (!indexes.some((index) => index.name === name)) return;
    console.log(`  ${APPLY ? 'Dropping' : 'Would drop'} index ${Model.modelName}.${name}`);
    if (APPLY) await Model.collection.dropIndex(name);
};

const migrateModel = async (Model, { markPhoneVerified }) => {
    console.log(`\n${Model.modelName}`);

    const duplicates = await findDuplicatePhones(Model);
    if (duplicates.length) {
        console.log(`  DUPLICATE PHONES (${duplicates.length}) - resolve these before applying:`);
        duplicates.forEach((dup) => console.log(`    ${dup._id}: ${dup.ids.join(', ')}`));
        return false;
    }

    // Drop the old indexes first: the non-partial email_1 rejects a second missing email.
    await dropIndexIfPresent(Model, 'email_1');
    await dropIndexIfPresent(Model, 'phone_1');

    const placeholder = { email: /@raathi\.com$/i };
    const blankEmail = { email: { $in: ['', null] } };
    const blankPhone = { phone: { $in: ['', null] } };
    console.log(`  placeholder emails: ${await Model.countDocuments(placeholder)}`);
    console.log(`  blank emails: ${await Model.countDocuments(blankEmail)}, blank phones: ${await Model.countDocuments(blankPhone)}`);
    if (APPLY) {
        await Model.updateMany(placeholder, { $unset: { email: '' } });
        await Model.updateMany(blankEmail, { $unset: { email: '' } });
        await Model.updateMany(blankPhone, { $unset: { phone: '' } });
    }

    if (markPhoneVerified) {
        const unverified = { isPhoneVerified: { $ne: true } };
        console.log(`  accounts to mark phone-verified: ${await Model.countDocuments(unverified)}`);
        if (APPLY) await Model.updateMany(unverified, { $set: { isPhoneVerified: true } });
    }

    if (APPLY) {
        // createIndexes (not syncIndexes) so unrelated indexes are left alone.
        await Model.createIndexes();
        console.log('  indexes created');
    }
    return true;
};

const migrate = async () => {
    try {
        // autoIndex off: the old indexes must be dropped before the new ones are built.
        await mongoose.connect(process.env.MONGO_URI, { autoIndex: false });
        console.log(APPLY ? 'Applying migration.' : 'Dry run (pass --apply to write changes).');

        // Existing customers keep their isVerified value; Surveyor/Sanchalak were all auto-verified.
        const results = [
            await migrateModel(User, { markPhoneVerified: false }),
            await migrateModel(Surveyor, { markPhoneVerified: true }),
            await migrateModel(Sanchalak, { markPhoneVerified: true }),
        ];

        if (results.includes(false)) {
            console.log('\nStopped: fix the duplicate phone numbers above, then run again.');
            process.exitCode = 1;
        } else {
            console.log('\nDone.');
        }
    } catch (err) {
        console.error('Migration failed:', err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
};

migrate();
