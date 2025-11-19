from fastapi import FastAPI
import structlog

app = FastAPI(title="Baseline Bot Platform API", version="1.0.0")
logger = structlog.get_logger()

@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok", "service": "backend"}
