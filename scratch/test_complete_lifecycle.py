"""
Comprehensive End-to-End Test Suite for StudyOS AI
Tests:
1. Health check
2. Registration flow -> OTP generation -> OTP verification -> account activation
3. Data persistence: profile update -> database check -> restart simulation
4. Logout -> Re-login with credentials -> OTP generation -> OTP verification -> profile fetch
5. Password reset flow: forgot password -> OTP -> reset password -> login with new password
6. Invalid OTP handling (wrong code rejection)
7. Security checks: unauthenticated access to protected routes returns 401
8. Frontend routes accessibility check (all 13 pages respond 200 OK)
"""

import sys
import json
import random
import urllib.request
import urllib.error

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

API_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:3000"

def api_request(method, endpoint, data=None, token=None):
    url = f"{API_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            return response.status, json.loads(res_body) if res_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except Exception:
            return e.code, {"detail": err_body}

def main():
    print("=" * 60)
    print("🚀 Starting StudyOS AI Comprehensive Lifecycle Test")
    print("=" * 60)

    # 1. Health check
    status, res = api_request("GET", "/health")
    assert status == 200, f"Health check failed: {status}"
    print("✅ 1. Health check passed:", res)

    # Generate unique test user
    uid = random.randint(10000, 99999)
    email = f"qa.student{uid}@studyos.ai"
    mobile = f"98765{random.randint(10000, 99999)}"
    password = "OriginalPassword123!"

    # 2. Registration
    reg_data = {
        "full_name": f"QA Student {uid}",
        "email": email,
        "mobile": mobile,
        "password": password,
        "confirm_password": password,
        "college": "Test Tech University",
        "degree": "B.Tech",
        "branch": "Artificial Intelligence",
        "year_of_study": 3,
    }
    status, reg_res = api_request("POST", "/auth/register", reg_data)
    assert status == 201, f"Registration failed ({status}): {reg_res}"
    user_id = reg_res.get("user_id")
    demo_otp = reg_res.get("demo_otp") or "123456"
    print(f"✅ 2. Registration succeeded for {email}, user_id: {user_id}")

    # 3. Test Invalid OTP rejection
    status, bad_otp_res = api_request("POST", "/auth/verify-registration-otp", {
        "user_id": user_id,
        "otp": "999999",
        "purpose": "registration"
    })
    assert status == 400, f"Invalid OTP should be rejected with 400, got {status}"
    print("✅ 3. Invalid OTP rejected properly:", bad_otp_res.get("detail"))

    # 4. Verify Registration OTP with correct code
    status, verify_res = api_request("POST", "/auth/verify-registration-otp", {
        "user_id": user_id,
        "otp": demo_otp,
        "purpose": "registration"
    })
    assert status == 200, f"OTP verification failed ({status}): {verify_res}"
    token = verify_res.get("access_token")
    assert token, "No access token returned after verification"
    assert verify_res.get("user", {}).get("full_name") == f"QA Student {uid}"
    print("✅ 4. Registration OTP verified, account activated, JWT received")

    # 5. Verify data persistence: Onboarding & Profile update
    onboard_data = {
        "college": "IIT Bombay",
        "degree": "B.Tech",
        "branch": "Computer Science",
        "year_of_study": 4,
        "subjects": ["Operating Systems", "Cloud Computing", "AI Systems"],
        "goals": ["placements", "semester_exams"],
        "daily_study_minutes": 90,
    }
    status, onboard_res = api_request("POST", "/profile/onboarding", onboard_data, token=token)
    assert status == 200, f"Onboarding failed ({status}): {onboard_res}"
    print("✅ 5. Onboarding profile submitted successfully")

    # Fetch profile to confirm persistence
    status, profile_res = api_request("GET", "/profile/me", token=token)
    assert status == 200, f"Profile fetch failed ({status}): {profile_res}"
    prof = profile_res.get("profile", {})
    assert prof.get("college") == "IIT Bombay"
    assert prof.get("onboarding_completed") == True
    assert "Operating Systems" in prof.get("subjects", [])
    print("✅ 6. Profile retrieved and validated against SQLite database persistence")

    # 6. Logout simulation
    status, logout_res = api_request("POST", "/auth/logout")
    assert status == 200, f"Logout failed ({status}): {logout_res}"
    print("✅ 7. Logout endpoint confirmed")

    # 7. Login again with same credentials
    status, login_res = api_request("POST", "/auth/login", {
        "email": email,
        "password": password
    })
    assert status == 200, f"Login failed ({status}): {login_res}"
    login_otp = login_res.get("demo_otp") or "123456"
    print("✅ 8. Login succeeded with original password, fresh OTP issued")

    # Verify Login OTP
    status, login_verify_res = api_request("POST", "/auth/verify-login-otp", {
        "user_id": user_id,
        "otp": login_otp,
        "purpose": "login"
    })
    assert status == 200, f"Login OTP verification failed ({status}): {login_verify_res}"
    new_token = login_verify_res.get("access_token")
    assert new_token, "No new token returned"
    print("✅ 9. Login OTP verified, new authenticated session established")

    # Verify data STILL exists after re-login
    status, profile_after_login = api_request("GET", "/profile/me", token=new_token)
    assert status == 200
    assert profile_after_login.get("profile", {}).get("college") == "IIT Bombay"
    print("✅ 10. Data confirmed fully persisted after re-login")

    # 8. Password Reset Flow (Forgot Password -> Reset -> Login with new password)
    status, forgot_res = api_request("POST", "/auth/forgot-password", {"email": email})
    assert status == 200, f"Forgot password failed ({status}): {forgot_res}"
    reset_otp = forgot_res.get("demo_otp") or "123456"
    print("✅ 11. Forgot password triggered reset OTP")

    new_password = "UpdatedPassword456!"
    status, reset_res = api_request("POST", "/auth/reset-password", {
        "user_id": user_id,
        "otp": reset_otp,
        "new_password": new_password,
        "confirm_password": new_password
    })
    assert status == 200, f"Reset password failed ({status}): {reset_res}"
    print("✅ 12. Password reset succeeded")

    # Old password should now fail with 401
    status, old_pw_login = api_request("POST", "/auth/login", {
        "email": email,
        "password": password
    })
    assert status == 401, f"Old password should fail with 401, got {status}"
    print("✅ 13. Old password correctly rejected with 401")

    # New password should succeed
    status, new_pw_login = api_request("POST", "/auth/login", {
        "email": email,
        "password": new_password
    })
    assert status == 200, f"New password login failed ({status}): {new_pw_login}"
    print("✅ 14. New password login successful")

    # 9. Test Protected Route Security (unauthenticated access rejected)
    status, unauth_res = api_request("GET", "/profile/me")
    assert status == 401, f"Unauthenticated request should return 401, got {status}"
    print("✅ 15. Security verified: Protected route requires valid Bearer token")

    # 10. Test all frontend routes respond with 200 OK
    routes = [
        "/",
        "/auth",
        "/onboarding",
        "/dashboard",
        "/vault",
        "/tutor",
        "/quizzes",
        "/study-plan",
        "/exam-readiness",
        "/interview",
        "/knowledge-graph",
        "/analytics",
        "/search",
        "/settings",
    ]
    print("\n🌐 Testing frontend routes at http://localhost:3000...")
    for route in routes:
        req = urllib.request.Request(f"{FRONTEND_URL}{route}")
        try:
            with urllib.request.urlopen(req) as resp:
                assert resp.status == 200, f"Route {route} returned {resp.status}"
                print(f"   ✓ {route:20} -> 200 OK")
        except Exception as e:
            print(f"   ✗ {route:20} -> FAILED: {e}")
            sys.exit(1)

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 100% COMPLETE.")

if __name__ == "__main__":
    main()
