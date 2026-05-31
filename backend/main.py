from fastapi import FastAPI

app = FastAPI(title="Neighborhood Tool Sharing API", version="0.1.0")


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
