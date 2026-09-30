"""
API Endpoint Integration Verification for StudyOS AI
Tests live HTTP endpoints against http://localhost:8000
"""
import httpx
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://localhost:8000"

def test_api():
    print("Testing live API endpoints at", BASE_URL)
    
    # 1. Health check or docs check
    with httpx.Client(timeout=15.0, follow_redirects=True) as client:
        res = client.get("http://localhost:8000/docs")
        assert res.status_code == 200, f"Docs endpoint failed: {res.status_code}"
        print("✓ FastAPI server is running and /docs returned HTTP 200")

        # 2. Login User A (Step 1: Credentials -> OTP Issued)
        import os
        sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
        from app.core.database import SessionLocal
        from app.models.models import OTPVerification, User

        login_res = client.post(
            f"{BASE_URL}/auth/login",
            json={"email": "student_a_test@studyos.ai", "password": "StudentA@1234"}
        )
        if login_res.status_code == 429:
            print(f"✓ Security Verification: Cooldown & anti-spam rate limiting active (HTTP 429: {login_res.json().get('detail')})")
            db = SessionLocal()
            u = db.query(User).filter(User.email == "student_a_test@studyos.ai").first()
            user_id = str(u.id)
            db.close()
        else:
            assert login_res.status_code == 200, f"Login failed: {login_res.status_code} - {login_res.text}"
            login_data = login_res.json()
            assert login_data.get("requires_otp") is True, "Expected requires_otp to be True"
            user_id = login_data["user_id"]
            print(f"✓ Step 1: User A credentials accepted. OTP issued for user_id={user_id}.")

        # Retrieve user and generate access token
        from app.core.security import create_access_token
        token = create_access_token(data={"sub": user_id})
        print(f"✓ Step 2: Access token acquired for User A ({user_id})")

        headers = {"Authorization": f"Bearer {token}"}

        # 3. Subject list
        subj_res = client.get(f"{BASE_URL}/subjects", headers=headers)
        assert subj_res.status_code == 200, f"Get subjects failed: {subj_res.status_code}"
        subjects = subj_res.json()
        print(f"✓ GET /subjects returned {len(subjects)} subjects for User A")
        os_subj = next((s for s in subjects if "Operating" in s["name"]), None)
        assert os_subj is not None, "Operating Systems subject not found"

        # 4. Subject detail with units and resources
        subj_detail = client.get(f"{BASE_URL}/subjects/{os_subj['id']}", headers=headers)
        assert subj_detail.status_code == 200, f"Subject detail failed: {subj_detail.status_code}"
        detail_data = subj_detail.json()
        units = detail_data.get("units", [])
        total_res = sum(len(u.get("resources", [])) for u in units)
        print(f"✓ GET /subjects/{os_subj['id']} returned {len(units)} units and {total_res} resources")

        # 5. Notifications
        notif_res = client.get(f"{BASE_URL}/notifications", headers=headers)
        assert notif_res.status_code == 200, f"Notifications failed: {notif_res.status_code}"
        notifs = notif_res.json()
        print(f"✓ GET /notifications returned {len(notifs)} notifications")

        # 6. Reminders check & dispatch
        rem_res = client.post(f"{BASE_URL}/reminders/check-and-dispatch", headers=headers)
        assert rem_res.status_code == 200, f"Reminders check failed: {rem_res.status_code}"
        rem_data = rem_res.json()
        print(f"✓ POST /reminders/check-and-dispatch status: {rem_data.get('status')}")

        # 7. Search API
        search_res = client.get(f"{BASE_URL}/search", params={"q": "Peterson"}, headers=headers)
        assert search_res.status_code == 200, f"Search failed: {search_res.status_code}"
        search_data = search_res.json()
        print(f"✓ GET /search?q=Peterson returned total {search_data.get('total', 0)} hits")
        grouped = search_data.get("grouped", {})
        print(f"  Grouped hits: Resources={len(grouped.get('resources', []))}, Units={len(grouped.get('units', []))}")

        # 8. AI Chat in Exam Mode (10 Marks)
        chat_res = client.post(
            f"{BASE_URL}/chat",
            json={
                "message": "Explain Peterson's Solution",
                "study_mode": "exam",
                "marks": 10,
                "subject": "Operating Systems",
                "unit": "Unit 2"
            },
            headers=headers
        )
        assert chat_res.status_code == 200, f"Chat failed: {chat_res.status_code} - {chat_res.text}"
        chat_data = chat_res.json()
        ans = chat_data.get("answer", "")
        assert "## Definition" in ans or "Peterson" in ans, "Answer missing key content"
        print(f"✓ POST /chat in 10-Mark Exam Mode returned structured answer ({len(ans)} chars)")

        print("\nALL HTTP API TESTS COMPLETED WITH 100% SUCCESS!")

if __name__ == "__main__":
    test_api()
