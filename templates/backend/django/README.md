# Django Production Template

## Run

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver
```

## Structure

- `config/settings.py`: environment-aware Django settings
- `config/urls.py`: root URL router
- `core/urls.py`: application routes
- `core/views.py`: API and health endpoints
- `Dockerfile`: container image for deployment
