# Express MongoDB TypeScript Template

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

## Structure

- `src/app.ts`: Express app setup
- `src/server.ts`: bootstraps database and HTTP server
- `src/config/`: environment and database config
- `src/controllers/`: route handlers
- `src/middleware/`: error handling and 404 handling
- `src/models/`: Mongoose models
- `src/routes/`: API routes
