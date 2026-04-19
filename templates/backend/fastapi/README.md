# FastAPI Production Template

## Run

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
.venv/bin/python -m uvicorn app.main:app --reload
```

## Structure

- `app/main.py`: application factory, middleware, and root health endpoint
- `app/api/router.py`: API router composition
- `app/api/routes/health.py`: versioned health endpoint
- `app/core/config.py`: typed environment settings
- `app/core/logging.py`: logging configuration
- `app/schemas/health.py`: API response models
- `Dockerfile`: container build for deployment
