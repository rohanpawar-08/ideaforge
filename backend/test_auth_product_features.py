"""
Test Suite: Phase 4 — Auth Product Features & Account Lifecycle
Tests all 20 required behaviors:
1. forgot password existing email
2. forgot password nonexistent email returns identical public response
3. token hash stored instead of plaintext
4. token expires correctly
5. reset with valid token
6. reset with reused token rejected
7. reset with expired token rejected
8. second reset request invalidates previous token
9. login works with new password
10. old password fails after reset
11. change password with correct current password
12. wrong current password rejected
13. account endpoint returns safe fields only
14. export returns only current user's data
15. delete account requires password
16. deletion removes user's roadmaps
17. deletion removes reset tokens
18. deleted user can no longer login
19. new endpoint rate limits work
20. no account enumeration
"""

import hashlib
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Set test environment
temp_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
temp_db_path = temp_db_file.name
temp_db_file.close()

os.environ["DATABASE_URL"] = f"sqlite:///{temp_db_path}"
os.environ["APP_ENV"] = "development"
os.environ["SECRET_KEY"] = "ideaforge_jwt_super_secret_test_key_32_characters_long"

import database
import models
from database import Base, get_db
import main
from main import app, limiter
from services import email_service

# Setup clean test database
test_engine = create_engine(
    f"sqlite:///{temp_db_path}",
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Create tables in test DB
Base.metadata.create_all(bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_suite():
    print("\n=======================================================")
    print("Running Phase 4: Auth Product Features & Account Lifecycle Test Suite")
    print("=======================================================\n")

    # Helper: register a user
    user_email = "alice@example.com"
    user_password = "Password123"

    res = client.post("/auth/signup", json={"email": user_email, "password": user_password})
    assert res.status_code == 200, f"Signup failed: {res.text}"
    token_alice = res.json()["access_token"]
    auth_header_alice = {"Authorization": f"Bearer {token_alice}"}
    print("[PASS] Setup: Registered test user alice@example.com")

    # Helper: create another user for isolation tests
    res2 = client.post("/auth/signup", json={"email": "bob@example.com", "password": "PasswordBob123"})
    assert res2.status_code == 200
    token_bob = res2.json()["access_token"]
    auth_header_bob = {"Authorization": f"Bearer {token_bob}"}
    print("[PASS] Setup: Registered test user bob@example.com")

    # --- Test 1 & Test 20: Forgot password existing email & No account enumeration ---
    email_service.clear_last_dev_email()
    res = client.post("/auth/forgot-password", json={"email": user_email})
    assert res.status_code == 200
    res_json_existing = res.json()
    assert "message" in res_json_existing
    expected_generic_msg = "If an account exists for that email, reset instructions have been sent."
    assert res_json_existing["message"] == expected_generic_msg

    last_email = email_service.get_last_dev_email()
    assert last_email is not None
    assert last_email["to"] == user_email
    raw_token_1 = last_email["raw_token"]
    assert raw_token_1 is not None and len(raw_token_1) > 20
    print("[PASS] Test 1: Forgot password existing email dispatched reset email.")

    # --- Test 2 & Test 20: Nonexistent email returns identical public response ---
    email_service.clear_last_dev_email()
    res_nonexistent = client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
    assert res_nonexistent.status_code == 200
    res_json_nonexistent = res_nonexistent.json()
    assert res_json_nonexistent == res_json_existing, "Response for nonexistent email must be identical!"
    assert email_service.get_last_dev_email() is None, "No email should be dispatched for nonexistent user."
    print("[PASS] Test 2 & Test 20: Nonexistent email returns identical response (no account enumeration).")

    # --- Test 3: Token hash stored instead of plaintext ---
    db = TestingSessionLocal()
    token_records = db.query(models.PasswordResetToken).all()
    assert len(token_records) >= 1
    stored_hash = token_records[-1].token_hash
    computed_hash = hashlib.sha256(raw_token_1.encode("utf-8")).hexdigest()
    assert stored_hash == computed_hash, "Token hash in database must match SHA256 of raw token."
    assert raw_token_1 not in stored_hash, "Raw plaintext token must NEVER be stored in database."
    db.close()
    print("[PASS] Test 3: Plaintext token is never stored; only cryptographic SHA-256 hash stored.")

    # --- Test 8: Second reset request invalidates previous token ---
    email_service.clear_last_dev_email()
    res = client.post("/auth/forgot-password", json={"email": user_email})
    assert res.status_code == 200
    last_email_2 = email_service.get_last_dev_email()
    raw_token_2 = last_email_2["raw_token"]
    assert raw_token_2 != raw_token_1

    # First token should now be invalidated / rejected
    res_stale = client.post("/auth/reset-password", json={"token": raw_token_1, "new_password": "NewPassword123"})
    assert res_stale.status_code == 400
    assert "Invalid or expired reset token" in res_stale.json()["detail"]
    print("[PASS] Test 8: Second reset request invalidates previous active reset token.")

    # --- Test 4 & Test 7: Token expires correctly / expired token rejected ---
    db = TestingSessionLocal()
    # Force expiration of raw_token_2 in the database for testing
    token_2_hash = hashlib.sha256(raw_token_2.encode("utf-8")).hexdigest()
    rec_2 = db.query(models.PasswordResetToken).filter_by(token_hash=token_2_hash).first()
    assert rec_2 is not None
    rec_2.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db.commit()
    db.close()

    res_expired = client.post("/auth/reset-password", json={"token": raw_token_2, "new_password": "NewPassword123"})
    assert res_expired.status_code == 400
    assert "Invalid or expired reset token" in res_expired.json()["detail"]
    print("[PASS] Test 4 & Test 7: Expired reset token is correctly rejected.")

    # Generate a fresh valid token for alice
    email_service.clear_last_dev_email()
    client.post("/auth/forgot-password", json={"email": user_email})
    raw_token_valid = email_service.get_last_dev_email()["raw_token"]

    # --- Test 5: Reset with valid token ---
    new_pass = "BrandNewPassword2026!"
    res_reset = client.post("/auth/reset-password", json={"token": raw_token_valid, "new_password": new_pass})
    assert res_reset.status_code == 200
    assert "Password has been successfully reset" in res_reset.json()["message"]
    print("[PASS] Test 5: Successfully reset password with valid token.")

    # --- Test 6: Reused token rejected ---
    res_reuse = client.post("/auth/reset-password", json={"token": raw_token_valid, "new_password": "AnotherPassword123"})
    assert res_reuse.status_code == 400
    assert "Invalid or expired reset token" in res_reuse.json()["detail"]
    print("[PASS] Test 6: Reset token reuse rejected (single-use enforced).")

    # --- Test 9: Login works with new password ---
    res_login_new = client.post("/auth/login", json={"email": user_email, "password": new_pass})
    assert res_login_new.status_code == 200
    token_alice = res_login_new.json()["access_token"]
    auth_header_alice = {"Authorization": f"Bearer {token_alice}"}
    print("[PASS] Test 9: Login successful with newly reset password.")

    # --- Test 10: Old password fails after reset ---
    res_login_old = client.post("/auth/login", json={"email": user_email, "password": user_password})
    assert res_login_old.status_code == 401
    print("[PASS] Test 10: Old password fails authentication after password reset.")

    # --- Test 11: Change password with correct current password ---
    newer_pass = "SuperSecureChangedPass123"
    res_change = client.post(
        "/auth/change-password",
        headers=auth_header_alice,
        json={"current_password": new_pass, "new_password": newer_pass},
    )
    assert res_change.status_code == 200
    assert res_change.json()["message"] == "Password changed successfully."
    print("[PASS] Test 11: Change password succeeds with correct current password.")

    # --- Test 12: Wrong current password rejected ---
    res_change_wrong = client.post(
        "/auth/change-password",
        headers=auth_header_alice,
        json={"current_password": "WrongPasswordXYZ", "new_password": "NewRandomPassword123"},
    )
    assert res_change_wrong.status_code == 400
    assert "Current password is incorrect" in res_change_wrong.json()["detail"]

    # Also test same password rejected
    res_change_same = client.post(
        "/auth/change-password",
        headers=auth_header_alice,
        json={"current_password": newer_pass, "new_password": newer_pass},
    )
    assert res_change_same.status_code == 400
    assert "cannot be the same" in res_change_same.json()["detail"]
    print("[PASS] Test 12: Wrong current password and identical new password rejected.")

    # --- Test 13: Account endpoint returns safe fields only ---
    res_acc = client.get("/account", headers=auth_header_alice)
    assert res_acc.status_code == 200
    acc_data = res_acc.json()
    assert "id" in acc_data
    assert acc_data["email"] == user_email
    assert "created_at" in acc_data
    assert "hashed_password" not in acc_data
    assert "password" not in acc_data
    print("[PASS] Test 13: /account returns safe profile fields only (no password hashes).")

    # --- Test 14: Export returns only current user's data ---
    # Add a roadmap for Alice and a roadmap for Bob
    db = TestingSessionLocal()
    alice_user = db.query(models.User).filter_by(email=user_email).first()
    bob_user = db.query(models.User).filter_by(email="bob@example.com").first()
    alice_id = alice_user.id
    bob_id = bob_user.id

    r_alice = models.Roadmap(user_id=alice_id, original_idea="Alice's Pomodoro App", data={"weeks": 4})
    r_bob = models.Roadmap(user_id=bob_id, original_idea="Bob's Secret Drone Project", data={"weeks": 12})
    db.add_all([r_alice, r_bob])
    db.commit()
    db.close()

    res_exp_alice = client.get("/account/export", headers=auth_header_alice)
    assert res_exp_alice.status_code == 200
    exp_alice = res_exp_alice.json()
    assert exp_alice["account"]["email"] == user_email
    assert "hashed_password" not in exp_alice["account"]
    alice_ideas = [rm["original_idea"] for rm in exp_alice["roadmaps"]]
    assert "Alice's Pomodoro App" in alice_ideas
    assert "Bob's Secret Drone Project" not in alice_ideas, "Data export must never leak another user's roadmaps!"
    print("[PASS] Test 14: /account/export returns strictly the current user's data and roadmaps.")

    # --- Test 15: Delete account requires password ---
    res_del_bad_pass = client.request(
        "DELETE",
        "/account",
        headers=auth_header_alice,
        json={"password": "IncorrectPassword123"},
    )
    assert res_del_bad_pass.status_code == 400
    assert "Incorrect password" in res_del_bad_pass.json()["detail"]
    print("[PASS] Test 15: Delete account with wrong password is rejected.")

    # --- Test 16, 17, 18: Deletion removes user, roadmaps, tokens, and prevents login ---
    res_del = client.request(
        "DELETE",
        "/account",
        headers=auth_header_alice,
        json={"password": newer_pass},
    )
    assert res_del.status_code == 200
    assert "permanently deleted" in res_del.json()["message"]

    db = TestingSessionLocal()
    assert db.query(models.User).filter_by(id=alice_id).first() is None, "User should be deleted."
    assert db.query(models.Roadmap).filter_by(user_id=alice_id).count() == 0, "User roadmaps should be deleted."
    assert db.query(models.PasswordResetToken).filter_by(user_id=alice_id).count() == 0, "User tokens should be deleted."
    # Bob's data should still exist
    assert db.query(models.User).filter_by(id=bob_id).first() is not None, "Bob should remain untouched."
    assert db.query(models.Roadmap).filter_by(user_id=bob_id).count() == 1, "Bob's roadmap should remain."
    db.close()

    # Deleted user can no longer log in
    res_login_deleted = client.post("/auth/login", json={"email": user_email, "password": newer_pass})
    assert res_login_deleted.status_code == 401
    print("[PASS] Tests 16, 17, 18: Account deletion safely removed roadmaps, tokens, user, and blocks login.")

    # --- Test 19: Rate limit checks on new endpoints ---
    # Delete account rate limit is 3/hour
    # We can verify the limiter configuration decorators on the endpoint routes
    routes = {r.path: r for r in app.routes if hasattr(r, "path")}
    assert "/auth/forgot-password" in routes
    assert "/auth/reset-password" in routes
    assert "/auth/change-password" in routes
    assert "/account" in routes

    # Direct rate limit verification:
    # 1. delete-account (3/hour)
    for i in range(3):
        client.request("DELETE", "/account", headers=auth_header_bob, json={"password": "wrong"})
    res_rl_del = client.request("DELETE", "/account", headers=auth_header_bob, json={"password": "wrong"})
    assert res_rl_del.status_code == 429, f"Expected 429 for DELETE /account, got {res_rl_del.status_code}"

    # 2. forgot-password (5/hour)
    limiter._limiter.storage.reset()
    for _ in range(5):
        res = client.post("/auth/forgot-password", json={"email": "ratelimit_fp@example.com"})
        assert res.status_code == 200
    res_rl_fp = client.post("/auth/forgot-password", json={"email": "ratelimit_fp@example.com"})
    assert res_rl_fp.status_code == 429, f"Expected 429 for /auth/forgot-password, got {res_rl_fp.status_code}"

    # 3. reset-password (10/hour)
    limiter._limiter.storage.reset()
    for _ in range(10):
        client.post("/auth/reset-password", json={"token": "dummy", "new_password": "invalid"})
    res_rl_rp = client.post("/auth/reset-password", json={"token": "dummy", "new_password": "invalid"})
    assert res_rl_rp.status_code == 429, f"Expected 429 for /auth/reset-password, got {res_rl_rp.status_code}"

    # 4. change-password (5/hour)
    limiter._limiter.storage.reset()
    for _ in range(5):
        client.post("/auth/change-password", headers=auth_header_bob, json={"current_password": "bad", "new_password": "bad"})
    res_rl_cp = client.post("/auth/change-password", headers=auth_header_bob, json={"current_password": "bad", "new_password": "bad"})
    assert res_rl_cp.status_code == 429, f"Expected 429 for /auth/change-password, got {res_rl_cp.status_code}"

    print("[PASS] Test 19: All 4 new endpoints enforce rate limits and return 429 upon threshold breach.")

    print("\n=======================================================")
    print("ALL 20 PHASE 4 AUTH PRODUCT & ACCOUNT LIFECYCLE TESTS PASSED!")
    print("=======================================================\n")


if __name__ == "__main__":
    try:
        test_suite()
    finally:
        try:
            if os.path.exists(temp_db_path):
                os.remove(temp_db_path)
        except Exception:
            pass
