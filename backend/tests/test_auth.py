import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_user_signup_and_login(client: AsyncClient):
    # 1. Sign up a new user and create an organization
    signup_payload = {
        "email": "owner@company.com",
        "password": "strongpassword123",
        "org_name": "Acme SaaS Solutions"
    }
    signup_res = await client.post("/api/v1/auth/signup", json=signup_payload)
    assert signup_res.status_code == 200
    signup_data = signup_res.json()
    assert signup_data["email"] == "owner@company.com"
    assert "id" in signup_data

    # 2. Login to retrieve the JWT access token
    login_payload = {
        "email": "owner@company.com",
        "password": "strongpassword123"
    }
    login_res = await client.post("/api/v1/auth/login", json=login_payload)
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["token_type"] == "bearer"
    assert login_data["user"]["email"] == "owner@company.com"

@pytest.mark.asyncio
async def test_invitation_system_and_roles(client: AsyncClient):
    # Setup - Register User A (Owner) and User B (No org yet)
    # Register Owner
    signup_a = await client.post("/api/v1/auth/signup", json={
        "email": "boss@acme.com",
        "password": "bosssecretpassword",
        "org_name": "Acme Corporation"
    })
    owner_user = signup_a.json()
    
    # Register invitee (User B)
    signup_b = await client.post("/api/v1/auth/signup", json={
        "email": "employee@acme.com",
        "password": "employeesecretpassword"
    })
    invitee_user = signup_b.json()

    # Login as Owner to get token & fetch organizations
    login_a = await client.post("/api/v1/auth/login", json={
        "email": "boss@acme.com",
        "password": "bosssecretpassword"
    })
    token_a = login_a.json()["access_token"]
    
    # Get active organization id
    orgs_res = await client.get(
        "/api/v1/auth/organizations",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert orgs_res.status_code == 200
    org_id = orgs_res.json()[0]["id"]

    # 1. Owner invites employee as an "Analyst"
    invite_res = await client.post(
        "/api/v1/auth/invite",
        json={"email": "employee@acme.com", "role": "Analyst"},
        headers={"Authorization": f"Bearer {token_a}", "X-Org-ID": org_id}
    )
    assert invite_res.status_code == 200
    invite_data = invite_res.json()
    assert invite_data["email"] == "employee@acme.com"
    assert invite_data["role"] == "Analyst"
    assert "token" in invite_data
    invite_token = invite_data["token"]

    # 2. Login as employee (who is not yet in the org) and try to query members
    login_b = await client.post("/api/v1/auth/login", json={
        "email": "employee@acme.com",
        "password": "employeesecretpassword"
    })
    token_b = login_b.json()["access_token"]

    # Trying to list members should fail before accepting the invite
    fail_list = await client.get(
        "/api/v1/auth/members",
        headers={"Authorization": f"Bearer {token_b}", "X-Org-ID": org_id}
    )
    assert fail_list.status_code == 403 # Forbidden

    # 3. Employee accepts the invitation using the token
    accept_res = await client.post(
        "/api/v1/auth/invite/accept",
        json={"token": invite_token},
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert accept_res.status_code == 200
    assert accept_res.json()["organization_id"] == org_id

    # 4. Now list members as the employee (should succeed as Analyst has Viewer minimum rank)
    success_list = await client.get(
        "/api/v1/auth/members",
        headers={"Authorization": f"Bearer {token_b}", "X-Org-ID": org_id}
    )
    assert success_list.status_code == 200
    members_data = success_list.json()
    assert len(members_data) == 2 # Owner and Analyst
    emails = [m["user"]["email"] for m in members_data]
    assert "boss@acme.com" in emails
    assert "employee@acme.com" in emails

@pytest.mark.asyncio
async def test_create_organization_endpoint(client: AsyncClient):
    # 1. Register a user without an organization
    signup_payload = {
        "email": "individual@company.com",
        "password": "strongpassword123"
    }
    signup_res = await client.post("/api/v1/auth/signup", json=signup_payload)
    assert signup_res.status_code == 200

    # 2. Login
    login_payload = {
        "email": "individual@company.com",
        "password": "strongpassword123"
    }
    login_res = await client.post("/api/v1/auth/login", json=login_payload)
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # Verify no organizations yet
    orgs_res = await client.get(
        "/api/v1/auth/organizations",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert orgs_res.status_code == 200
    assert len(orgs_res.json()) == 0

    # 3. Create organization
    create_org_payload = {
        "name": "Solo Enterprise"
    }
    create_res = await client.post(
        "/api/v1/auth/organizations",
        json=create_org_payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert create_res.status_code == 201
    create_data = create_res.json()
    assert create_data["name"] == "Solo Enterprise"
    assert "id" in create_data

    # Verify organization exists in list now
    orgs_res2 = await client.get(
        "/api/v1/auth/organizations",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert orgs_res2.status_code == 200
    assert len(orgs_res2.json()) == 1
    assert orgs_res2.json()[0]["name"] == "Solo Enterprise"
