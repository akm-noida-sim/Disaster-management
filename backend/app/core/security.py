"""Small signed-session primitive for the API's first deployable authentication layer."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass

from fastapi import Header, HTTPException, status

from .config import settings

_TOKEN_TTL_SECONDS = 60 * 60 * 8


@dataclass(frozen=True)
class AuthenticatedUser:
    student_id: int
    role: str


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def create_access_token(student_id: int, role: str) -> str:
    """Create a short-lived, HMAC-signed bearer token without external state."""
    payload = {"sub": student_id, "role": role, "exp": int(time.time()) + _TOKEN_TTL_SECONDS}
    encoded_payload = _encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(
        settings.auth_secret.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256
    ).digest()
    return f"{encoded_payload}.{_encode(signature)}"


def read_access_token(token: str) -> AuthenticatedUser:
    """Validate signature and expiry, raising an API-safe response on failure."""
    try:
        encoded_payload, encoded_signature = token.split(".", 1)
        expected = hmac.new(
            settings.auth_secret.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256
        ).digest()
        if not hmac.compare_digest(_decode(encoded_signature), expected):
            raise ValueError("Signature mismatch")
        payload = json.loads(_decode(encoded_payload))
        if int(payload["exp"]) <= time.time():
            raise ValueError("Expired token")
        return AuthenticatedUser(student_id=int(payload["sub"]), role=str(payload["role"]))
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token.")


def require_admin(authorization: str | None = Header(default=None)) -> AuthenticatedUser:
    """Protect mutations in production, while allowing the documented local MVP mode."""
    if not settings.require_auth:
        return AuthenticatedUser(student_id=0, role="admin")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer authentication is required.")
    user = read_access_token(authorization.removeprefix("Bearer ").strip())
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access is required.")
    return user
