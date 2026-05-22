import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_multi_tenant_isolation_boundaries(client: AsyncClient):
    # 1. Register User A under Org A
    signup_a = await client.post("/api/v1/auth/signup", json={
        "email": "admin-a@company-a.com",
        "password": "passwordorg-a",
        "org_name": "Corporation Alpha"
    })
    login_a = await client.post("/api/v1/auth/login", json={
        "email": "admin-a@company-a.com",
        "password": "passwordorg-a"
    })
    token_a = login_a.json()["access_token"]
    
    orgs_a = await client.get(
        "/api/v1/auth/organizations",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    org_id_a = orgs_a.json()[0]["id"]

    # 2. Register User B under Org B
    signup_b = await client.post("/api/v1/auth/signup", json={
        "email": "admin-b@company-b.com",
        "password": "passwordorg-b",
        "org_name": "Corporation Beta"
    })
    login_b = await client.post("/api/v1/auth/login", json={
        "email": "admin-b@company-b.com",
        "password": "passwordorg-b"
    })
    token_b = login_b.json()["access_token"]
    
    orgs_b = await client.get(
        "/api/v1/auth/organizations",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    org_id_b = orgs_b.json()[0]["id"]

    # 3. Inject event to Org A using User A's context
    ingest_res = await client.post(
        "/api/v1/events",
        json={"event_name": "alpha_event", "payload": {"secret": "alpha_code"}},
        headers={"Authorization": f"Bearer {token_a}", "X-Org-ID": org_id_a}
    )
    assert ingest_res.status_code == 202

    # 4. User B attempts to access Org A's stats (should be blocked with 403 Forbidden)
    blocked_stats = await client.get(
        "/api/v1/events/stats",
        headers={"Authorization": f"Bearer {token_b}", "X-Org-ID": org_id_a}
    )
    assert blocked_stats.status_code == 403 # Forbidden
    assert blocked_stats.json()["detail"] == "You do not belong to this organization"

    # 5. User B attempts to list members of Org A (should be blocked with 403 Forbidden)
    blocked_members = await client.get(
        "/api/v1/auth/members",
        headers={"Authorization": f"Bearer {token_b}", "X-Org-ID": org_id_a}
    )
    assert blocked_members.status_code == 403
    assert blocked_members.json()["detail"] == "You do not belong to this organization"

    # 6. User B attempts to create an API Key under Org A context (should be blocked)
    blocked_key_create = await client.post(
        "/api/v1/keys",
        json={"name": "hacked-key"},
        headers={"Authorization": f"Bearer {token_b}", "X-Org-ID": org_id_a}
      )
    assert blocked_key_create.status_code == 403
