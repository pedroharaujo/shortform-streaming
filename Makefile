.PHONY: help start-sql stop-sql start-backend start-avd emulate start-emulator android reset-progress

# Local foreground loops. `start-backend` and `emulate` stay in the terminal.
# Copy `.env.example` to `.env` when you need non-default values (Bunny, a
# non-5432 Postgres port). Compose and `uv --env-file` both read `.env`.
# Optional: ANDROID_AVD=<name> to pick a non-default AVD for start-avd.
ifneq ($(wildcard .env),)
UV_ENV := --env-file .env
endif

.DEFAULT_GOAL := help

help:
	@echo "start-sql          Start local PostgreSQL (Docker Compose, wait until healthy)"
	@echo "stop-sql           Stop Compose services (keeps the named data volume)"
	@echo "start-backend      Migrate and run Django on 127.0.0.1:8000"
	@echo "start-avd          Boot the Android emulator without Android Studio and wait for adb"
	@echo "emulate            Start the AVD if needed, then install the Android development client"
	@echo "start-emulator     Same as emulate"
	@echo "reset-progress     Delete local WatchProgress so player observation starts at 0"

start-sql:
	docker compose up -d --wait postgres

stop-sql:
	docker compose down

start-backend:
	uv run $(UV_ENV) python backend/manage.py migrate
	uv run $(UV_ENV) python backend/manage.py runserver 127.0.0.1:8000

reset-progress:
	uv run $(UV_ENV) python backend/manage.py reset_local_progress

start-avd:
	uv run python scripts/start_android_avd.py

emulate start-emulator android: start-avd
	uv run python scripts/run_mobile_android.py
