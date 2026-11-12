import mongoose from 'mongoose';

// Collections whose email/phone indexes must be partial so accounts may omit an email.
const PHONE_AUTH_COLLECTIONS = ['users', 'surveyors', 'sanchalaks'];

/**
 * Warns when an old non-partial unique email/phone index is still in the database: it rejects
 * every second account without an email ("email already exists"). Only reports, never changes indexes.
 */
const warnOnLegacyIndexes = async (db) => {
  for (const name of PHONE_AUTH_COLLECTIONS) {
    const indexes = await db.collection(name).indexes().catch(() => []);
    const legacy = indexes.filter(
      (index) => ['email_1', 'phone_1'].includes(index.name) && index.unique && !index.partialFilterExpression
    );
    if (legacy.length) {
      console.warn(
        `⚠️  ${name}: legacy unique index ${legacy.map((i) => i.name).join(', ')} blocks phone-only sign-up. ` +
        'Run: node src/scripts/migratePhoneAuth.js --apply'
      );
    }
  }
};

const connectDB = async (retries = 5, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI);
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      await warnOnLegacyIndexes(conn.connection.db).catch(() => {});
      return;
    } catch (error) {
      console.error(`MongoDB connection attempt ${i + 1} failed: ${error.message}`);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error('All database connection attempts failed.');
        process.exit(1);
      }
    }
  }
};

export default connectDB;
