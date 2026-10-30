# HealForge backend — production image.
#
# The NVIDIA API key is NEVER baked into this image: it is injected at runtime
# via the environment (docker compose `environment:` / secret manager).
# Untrusted uploaded source is analyzed statically only — nothing is ever
# executed in this container (see app/services/verification.py).

FROM python:3.12-slim AS base

# Security: no bytecode cache files in layers, deterministic pip, no .pyc writes.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install dependencies first so this layer caches independently of app code.
# requirements.txt is the single pinned source of truth (including psycopg).
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code (see .dockerignore for exclusions).
COPY alembic.ini ./
COPY alembic/ ./alembic/
COPY app/ ./app/

# Non-root runtime user with no home write access.
RUN useradd --system --no-create-home --uid 10001 healforge \
    && mkdir -p /app/data \
    && chown -R healforge:healforge /app
USER healforge

EXPOSE 8000

# Migrations run on start; the API follows on the same container.
# (For zero-downtime deployments run `alembic upgrade head` as a separate
#  one-off job instead — see README "Migrations".)
COPY --chown=healforge:healforge docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
