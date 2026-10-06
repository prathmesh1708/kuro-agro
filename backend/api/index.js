// Vercel serverless entry: reuses the Express app without http.listen / Socket.IO
import app from '../src/app.js';
import connectDB from '../src/config/db.js';
import { validateEnv } from '../src/config/env.js';

let dbReady = null;

export default async function handler(req, res) {
    if (!dbReady) {
        validateEnv();
        dbReady = connectDB(1).catch((err) => {
            dbReady = null;
            throw err;
        });
    }
    await dbReady;
    return app(req, res);
}
