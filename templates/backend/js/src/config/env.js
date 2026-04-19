import dotenv from 'dotenv';

dotenv.config();

function getEnv(name, fallback) {
  return process.env[name] || fallback;
}

export const env = {
  nodeEnv: getEnv('NODE_ENV', 'development'),
  port: Number(getEnv('PORT', '4000')),
  mongoUri: getEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017/appdb'),
  dbName: getEnv('DB_NAME', 'appdb'),
  corsOrigin: getEnv('CORS_ORIGIN', 'http://localhost:3000'),
  logLevel: getEnv('LOG_LEVEL', 'dev')
};
