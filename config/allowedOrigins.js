// Export an array of allowed origins for CORS.
// Supports building the list from the FRONTEND_URL env var and a comma-separated list.
const envList = process.env.ALLOWED_ORIGINS || '';
const defaults = ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:5174', 'https://1bc67aed-da07-469e-a472-a4d5f1da78d9.lovableproject.com', 'https://lovable.dev', 'https://id-preview--1bc67aed-da07-469e-a472-a4d5f1da78d9.lovable.app'];

const fromEnv = envList
	.split(',')
	.map(s => s.trim())
	.filter(Boolean);

const frontend = process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : [];

const allowedOrigins = Array.from(new Set([...frontend, ...fromEnv, ...defaults]));

module.exports = allowedOrigins;
