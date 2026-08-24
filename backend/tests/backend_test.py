"""PT-KDRT backend endpoint tests (health, office-IP whitelist, AI product scan)."""
import re

import pytest

from conftest import BASE_URL

ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}")


# ---------------------------------------------------------------- health
class TestHealth:
    def test_health_ok(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/health", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["status"] == "ok"
        assert isinstance(data["timestamp"], str)
        assert ISO_RE.match(data["timestamp"]), data["timestamp"]


# ------------------------------------------------- /api/auth/client-ip
class TestClientIp:
    def test_client_ip_contract(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/auth/client-ip", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert set(["clientIp", "isAllowed", "allowedOfficeIps"]).issubset(data.keys())
        assert isinstance(data["clientIp"], str) and data["clientIp"] != ""
        assert isinstance(data["isAllowed"], bool)
        assert isinstance(data["allowedOfficeIps"], list)
        assert "158.140.166.38" in data["allowedOfficeIps"]
        assert "158.140.166.0/24" in data["allowedOfficeIps"]

    def test_forwarded_office_ip_is_allowed(self, api_client):
        r = api_client.get(
            f"{BASE_URL}/api/auth/client-ip",
            headers={"X-Forwarded-For": "158.140.166.38"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["clientIp"] == "158.140.166.38"
        assert data["isAllowed"] is True

    def test_forwarded_foreign_ip_is_blocked(self, api_client):
        r = api_client.get(
            f"{BASE_URL}/api/auth/client-ip",
            headers={"X-Forwarded-For": "8.8.8.8"},
            timeout=30,
        )
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["clientIp"] == "8.8.8.8"
        assert data["isAllowed"] is False


# ------------------------------------------------- /api/scan-product
SCAN_KEYS = [
    "productName",
    "productPrice",
    "platform",
    "category",
    "aiRecommendation",
    "earningInfo",
    "variantOrSize",
    "notes",
    "productImageBoundingBox",
    "confidence",
]


class TestScanProduct:
    @pytest.mark.parametrize("path", ["/api/scan-product", "/api/scan-product-image"])
    def test_scan_product_success(self, api_client, product_image_b64, path):
        r = api_client.post(
            f"{BASE_URL}{path}",
            json={"imageBase64": product_image_b64, "mimeType": "image/jpeg"},
            timeout=180,
        )
        assert r.status_code == 200, f"{path} -> {r.status_code}: {r.text[:500]}"
        body = r.json()
        assert body.get("success") is True, r.text[:500]
        data = body["data"]
        for key in SCAN_KEYS:
            assert key in data, f"missing key {key} in {data}"
        assert isinstance(data["productPrice"], int)
        assert isinstance(data["productName"], str)
        assert isinstance(data["platform"], str)
        # image contains "Rp54.450" and a product title, so AI must extract something
        assert data["productName"].strip() != "", "AI returned empty productName"
        print(f"{path} extracted: {data['productName']!r} price={data['productPrice']} "
              f"platform={data['platform']} rec={data['aiRecommendation']!r} "
              f"variant={data['variantOrSize']!r} earn={data['earningInfo']!r}")

    def test_scan_product_with_data_url_prefix(self, api_client, product_image_b64):
        r = api_client.post(
            f"{BASE_URL}/api/scan-product",
            json={"imageBase64": f"data:image/jpeg;base64,{product_image_b64}"},
            timeout=180,
        )
        assert r.status_code == 200, r.text[:500]
        assert r.json().get("success") is True

    @pytest.mark.parametrize("path", ["/api/scan-product", "/api/scan-product-image"])
    def test_scan_product_missing_image_returns_400(self, api_client, path):
        r = api_client.post(f"{BASE_URL}{path}", json={}, timeout=30)
        assert r.status_code == 400, f"{path} -> {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data["success"] is False
        assert data["error"] == "Gambar screenshot (imageBase64) wajib disertakan."

    def test_scan_product_invalid_base64_is_handled(self, api_client):
        r = api_client.post(
            f"{BASE_URL}/api/scan-product",
            json={"imageBase64": "not-a-real-base64-image!!!"},
            timeout=120,
        )
        assert r.status_code in (400, 422, 500), r.status_code
        body = r.json()
        assert body.get("success") is False
        assert isinstance(body.get("error"), str) and body["error"] != ""
