import base64
import os
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    # This is a Vite app: frontend/.env has no REACT_APP_BACKEND_URL and the app calls
    # relative /api/* paths. Allow the preview host to be injected via PREVIEW_URL.
    base_url = os.environ.get("PREVIEW_URL")
if not base_url:
    base_url = "https://6a1b502f-c49a-4674-97fc-953de013e09b.preview.emergentagent.com"
BASE_URL = base_url.rstrip("/")


@pytest.fixture(scope="session")
def api_base():
    return BASE_URL


@pytest.fixture(scope="class")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def product_image_b64():
    from make_test_image import build

    path = Path(build())
    assert path.stat().st_size > 2000, "generated test image is suspiciously small"
    return base64.b64encode(path.read_bytes()).decode()
