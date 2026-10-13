import crypto from 'crypto';

/**
 * Fills `codeField` with a unique random code such as SAN-482913 before validation.
 */
export const applyUniqueCode = (schema, { codeField, codePrefix }) => {
    schema.pre('validate', async function (next) {
        if (this[codeField]) return next();
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const candidate = `${codePrefix}-${crypto.randomInt(100000, 1000000)}`;
            // eslint-disable-next-line no-await-in-loop
            const taken = await this.constructor.exists({ [codeField]: candidate });
            if (!taken) {
                this[codeField] = candidate;
                return next();
            }
        }
        return next(new Error(`Could not generate a unique ${codeField}.`));
    });
};
