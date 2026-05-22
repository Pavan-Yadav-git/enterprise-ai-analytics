import os
from celery import Celery
from celery.schedules import crontab

# Configure Celery
celery_app = Celery(
    "tasks",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0")
)

# Optional configuration updates
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    imports=["app.worker.tasks"] # Eager load task modules
)

# Periodic task configurations (Celery Beat)
celery_app.conf.beat_schedule = {
    "evaluate-alerts-every-minute": {
        "task": "tasks.evaluate_alerts",
        "schedule": 60.0, # Every 60 seconds
    }
}
