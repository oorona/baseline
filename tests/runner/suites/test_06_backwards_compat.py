"""
Suite 06 — Backwards Compatibility
Verifies the API contract: response shapes, status codes, and field names
that downstream bots depend on. Any change that breaks these tests means
a backwards-incompatible change has been made to the framework.

These tests define the contract that all forks of this framework must maintain.
Add new tests here when you add new public API endpoints.
"""
import time
import httpx
import pytest
import os

GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://gateway")
TEST_API_TOKEN = os.environ.get("TEST_API_TOKEN", "")
SUITE = "06 Backwards Compatibility"


def _get(path: str, headers: dict = None):
    start = time.monotonic()
    r = httpx.get(
        f"{GATEWAY_URL}{path}",
        timeout=10,
        follow_redirects=False,
        headers=headers or {},
    )
    return r, (time.monotonic() - start) * 1000


def _post(path: str, headers: dict = None, json: dict = None):
    start = time.monotonic()
    r = httpx.post(
        f"{GATEWAY_URL}{path}",
        timeout=10,
        follow_redirects=False,
        headers=headers or {},
        json=json,
    )
    return r, (time.monotonic() - start) * 1000


class TestHealthContractV1:
    """GET /api/v1/health — L0 Public"""

    def test_returns_200(self):
        r, _ = _get("/api/v1/health")
        assert r.status_code == 200

    def test_response_is_json(self):
        r, _ = _get("/api/v1/health")
        assert r.headers.get("content-type", "").startswith("application/json"), (
            f"Health should return JSON, got: {r.headers.get('content-type')}"
        )

    def test_has_status_field(self):
        r, _ = _get("/api/v1/health")
        assert "status" in r.json()

    def test_response_time_under_1s(self):
        _, ms = _get("/api/v1/health")
        assert ms < 1000, f"Health endpoint exceeded 1s: {ms:.0f}ms"


class TestDiscordConfigContractV1:
    """GET /api/v1/auth/discord-config — L0 Public"""

    def test_returns_200(self):
        r, _ = _get("/api/v1/auth/discord-config")
        assert r.status_code == 200

    def test_has_client_id(self):
        r, _ = _get("/api/v1/auth/discord-config")
        data = r.json()
        assert "client_id" in data, f"Missing client_id: {data}"

    def test_has_redirect_uri(self):
        r, _ = _get("/api/v1/auth/discord-config")
        data = r.json()
        assert "redirect_uri" in data, f"Missing redirect_uri: {data}"

    def test_no_secret_fields(self):
        r, _ = _get("/api/v1/auth/discord-config")
        data = r.json()
        forbidden_keys = {"client_secret", "secret", "token", "password"}
        leaked = forbidden_keys & set(data.keys())
        assert not leaked, f"Sensitive fields in discord-config response: {leaked}"


class TestUnauthorized401ContractV1:
    """Protected endpoints must return 401 with a detail message."""

    PROTECTED_PATHS = [
        "/api/v1/auth/me",
        "/api/v1/guilds/",
        "/api/v1/shards/",
        "/api/v1/platform/settings",
    ]

    @pytest.mark.parametrize("path", PROTECTED_PATHS)
    def test_protected_path_returns_401(self, path):
        r, _ = _get(path)
        assert r.status_code == 401, (
            f"{path} should return 401 without auth, got {r.status_code}"
        )

    @pytest.mark.parametrize("path", PROTECTED_PATHS)
    def test_protected_path_401_has_detail(self, path):
        r, _ = _get(path)
        if r.status_code == 401:
            data = r.json()
            assert "detail" in data, (
                f"{path} 401 response missing 'detail' field: {data}"
            )


@pytest.mark.skipif(not TEST_API_TOKEN, reason="TEST_API_TOKEN not set")
class TestAuthMeContractV1:
    """GET /api/v1/auth/me — L2 Authenticated"""

    REQUIRED_FIELDS = ["user_id", "username"]

    def test_returns_200_with_valid_token(self):
        r, _ = _get("/api/v1/auth/me",
                    headers={"Authorization": f"Bearer {TEST_API_TOKEN}"})
        assert r.status_code == 200, f"/auth/me failed: {r.status_code} {r.text}"

    @pytest.mark.parametrize("field", REQUIRED_FIELDS)
    def test_has_required_field(self, field):
        r, _ = _get("/api/v1/auth/me",
                    headers={"Authorization": f"Bearer {TEST_API_TOKEN}"})
        data = r.json()
        assert field in data, f"Missing required field '{field}' in /auth/me: {data}"

    def test_response_time_under_2s(self):
        _, ms = _get("/api/v1/auth/me",
                     headers={"Authorization": f"Bearer {TEST_API_TOKEN}"})
        assert ms < 2000, f"/auth/me took {ms:.0f}ms (limit: 2000ms)"


@pytest.mark.skipif(not TEST_API_TOKEN, reason="TEST_API_TOKEN not set")
class TestGuildsContractV1:
    """GET /api/v1/guilds/ — L2 Authenticated"""

    def test_returns_200_or_empty_list(self):
        r, _ = _get("/api/v1/guilds/",
                    headers={"Authorization": f"Bearer {TEST_API_TOKEN}"})
        assert r.status_code == 200, f"GET /guilds/ failed: {r.status_code}"

    def test_returns_list(self):
        r, _ = _get("/api/v1/guilds/",
                    headers={"Authorization": f"Bearer {TEST_API_TOKEN}"})
        data = r.json()
        assert isinstance(data, list), f"Expected list from /guilds/, got {type(data)}"

    def test_response_time_under_3s(self):
        _, ms = _get("/api/v1/guilds/",
                     headers={"Authorization": f"Bearer {TEST_API_TOKEN}"})
        assert ms < 3000, f"GET /guilds/ took {ms:.0f}ms (limit: 3000ms)"
