import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_api_key_generation_and_ingestion(client: AsyncClient):
    # Setup: Register owner user and get organization
    signup = await client.post("/api/v1/auth/signup", json={
        "email": "keyowner@corp.com",
        "password": "ownerpassword123",
        "org_name": "KeyCorp Inc"
    })
    token = signup.json()["id"] # we will fetch token via login
    
    login = await client.post("/api/v1/auth/login", json={
        "email": "keyowner@corp.com",
        "password": "ownerpassword123"
    })
    token = login.json()["access_token"]

    orgs_res = await client.get(
        "/api/v1/auth/organizations",
        headers={"Authorization": f"Bearer {token}"}
    )
    org_id = orgs_res.json()[0]["id"]

    # 1. Try to ingest event WITHOUT any token (should fail)
    fail_ingest = await client.post(
        "/api/v1/events",
        json={"event_name": "page_view", "payload": {"foo": "bar"}}
    )
    assert fail_ingest.status_code == 401 # Unauthorized

    # 2. Owner generates an active API Key
    key_res = await client.post(
        "/api/v1/keys",
        json={"name": "Analytics Server Core", "expires_in_days": 10},
        headers={"Authorization": f"Bearer {token}", "X-Org-ID": org_id}
    )
    assert key_res.status_code == 201
    key_data = key_res.json()
    assert "raw_key" in key_data
    raw_api_key = key_data["raw_key"]

    # 3. Ingest single telemetry event using the raw API key (should succeed)
    success_ingest = await client.post(
        "/api/v1/events",
        json={
            "event_name": "checkout_success",
            "payload": {"amount": 120.50, "items_count": 3}
        },
        headers={"Authorization": f"Bearer {raw_api_key}"}
    )
    assert success_ingest.status_code == 202 # Accepted
    assert success_ingest.json()["status"] == "queued"

    # 4. Ingest using malformed key prefix (should fail)
    bad_ingest = await client.post(
        "/api/v1/events",
        json={"event_name": "error_log", "payload": {}},
        headers={"Authorization": "Bearer pk_live_invalidkeyprefixsecret"}
    )
    assert bad_ingest.status_code == 401

@pytest.mark.asyncio
async def test_csv_ingestion_upload(client: AsyncClient):
    # Setup: Register and authenticate
    signup = await client.post("/api/v1/auth/signup", json={
        "email": "csvowner@corp.com",
        "password": "csvpassword123",
        "org_name": "CSVCorp"
    })
    login = await client.post("/api/v1/auth/login", json={
        "email": "csvowner@corp.com",
        "password": "csvpassword123"
    })
    token = login.json()["access_token"]
    
    orgs_res = await client.get(
        "/api/v1/auth/organizations",
        headers={"Authorization": f"Bearer {token}"}
    )
    org_id = orgs_res.json()[0]["id"]

    # Construct mock CSV content
    csv_content = (
        "event_name,browser,latency_ms,status\n"
        "page_view,Chrome,140,200\n"
        "checkout_success,Safari,320,201\n"
        "api_error,Firefox,20,500\n"
    )
    
    # Upload CSV file via multipart post
    files = {"file": ("data.csv", csv_content.encode("utf-8"), "text/csv")}
    upload_res = await client.post(
        "/api/v1/events/upload-csv",
        files=files,
        headers={"Authorization": f"Bearer {token}", "X-Org-ID": org_id}
    )
    
    assert upload_res.status_code == 202
    assert "Successfully parsed and queued" in upload_res.json()["message"]
