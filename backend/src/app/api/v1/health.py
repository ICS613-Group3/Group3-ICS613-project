"""Health check endpoint.

Liveness probe for infrastructure (Docker HEALTHCHECK, load balancers,
Kubernetes readiness probes, uptime monitors). Always returns HTTP 200
without requiring authentication so monitoring tools can verify the
application process is running and accepting requests.

Does **not** verify database connectivity or other service health —
that is intentionally out of scope to keep the probe fast and reliable
regardless of transient downstream issues.
"""

from fastapi import APIRouter, status

router = APIRouter()


@router.get("", status_code=status.HTTP_200_OK)
async def health_check() -> dict[str, str]:
    """Confirm the application is alive and accepting requests."""
    return {"status": "ok"}
