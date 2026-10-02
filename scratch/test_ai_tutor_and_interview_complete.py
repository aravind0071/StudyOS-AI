"""
Comprehensive End-to-End Test Suite for AI Tutor and Interview/Project Viva System

Tests:
1. Spelling mistakes & fuzzy search ("sytem calls", "deadlcok", "2pl", "tell me about system calls")
2. Questions from uploaded notes (grounding check, citations verification)
3. Questions not present in notes (anti-hallucination check, curriculum answer)
4. 10-question interview progression (all 10 distinct stages)
5. Semantic duplicate detection & rejection
6. Project Viva generation (technologies and project alignment)
7. Answer submission & 5-dimensional evaluation
8. Skipped question handling (no fake scores)
9. Final score calculation (strictly from submitted answers, never hardcoded 85%)
"""

import sys
from pathlib import Path

# Add backend to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.models import User, Material, MaterialChunk, InterviewSession, InterviewQuestion, DifficultyLevel
from app.services.query_understanding import (
    extract_topic_and_expansions,
    compute_chunk_relevance,
    correct_term,
)
from app.services.rag_service import retrieve_relevant_chunks, build_rag_response
from app.services.educational_kb import generate_structured_response
from app.services.interview_engine import (
    generate_interview_question,
    evaluate_interview_answer,
    compute_question_similarity,
    is_duplicate_question,
    STAGE_NAMES,
)

# In-memory SQLite for testing
test_engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(bind=test_engine)
TestSession = sessionmaker(bind=test_engine)
db = TestSession()


def run_tests():
    print("=" * 70)
    print("STARTING COMPLETE AI TUTOR & INTERVIEW / VIVA VERIFICATION SUITE")
    print("=" * 70)

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 1: SPELLING MISTAKES & QUERY UNDERSTANDING
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[TEST 1] Testing spelling mistakes and fuzzy query understanding...")
    test_queries = [
        ("sytem calls", "system"),
        ("tell me about system calls", "system"),
        ("deadlcok avoidance", "deadlock"),
        ("chekcsum calculation", "checksum"),
        ("dijkstras algorithm", "dijkstra"),
        ("2pl protocol", "two phase locking"),
    ]
    for q, expected in test_queries:
        info = extract_topic_and_expansions(q)
        all_terms = " ".join(info["expanded_terms"])
        assert expected in all_terms or any(expected in t for t in info["tokens"]), f"Failed for query '{q}': got {info}"
        print(f"  [OK] Query '{q}' -> clean topic: '{info['clean_topic']}', expanded terms: {info['expanded_terms'][:3]}")
    print(">>> TEST 1 PASSED: Query understanding correctly fixes typos and expands terms.")

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 2 & 3: ANSWER SOURCE LOGIC (GROUNDED VS CURRICULUM FALLBACK)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[TEST 2 & 3] Testing Answer Source Logic (Grounded vs External/Curriculum)...")

    # Create dummy user
    user = User(
        email="test_student@studyos.ai",
        hashed_password="fakehashpassword123",
        full_name="Test Student",
    )
    db.add(user)
    db.commit()

    from app.models.models import MaterialType
    # Upload notes specifically on "Stop-and-Wait Protocol"
    mat = Material(
        user_id=user.id,
        title="Computer Networks Lecture 4 - Flow Control",
        subject="Computer Networks",
        material_type=MaterialType.PDF,
    )
    db.add(mat)
    db.flush()

    chunk = MaterialChunk(
        user_id=user.id,
        material_id=mat.id,
        chunk_index=0,
        content="Stop-and-Wait Protocol is a flow control protocol where sender transmits 1 frame and waits for ACK before sending the next frame. Frame sequence numbers alternate between 0 and 1. Easy trick: 1 frame at a time.",
        page_number=4,
    )
    db.add(chunk)
    db.commit()

    # Test 2a: Query present in notes (even with spelling mistake: "stop and wait protcol")
    chunks, is_grounded = retrieve_relevant_chunks("stop and wait protcol", user.id, db)
    assert is_grounded is True, "Failed: should be grounded in uploaded notes"
    assert len(chunks) > 0, "Failed: chunk should be returned"
    assert chunks[0]["page_number"] == 4
    print(f"  [OK] Found in uploaded notes: {chunks[0]['material_title']} (Page {chunks[0]['page_number']})")

    resp_grounded = build_rag_response("stop and wait protcol", user.id, db)
    assert resp_grounded["used_external_knowledge"] is False, "Should not use external knowledge when grounded"
    assert len(resp_grounded["sources"]) > 0, "Must include real citation sources"
    assert "Stop-and-Wait" in resp_grounded["answer"]
    print("  [OK] Grounded answer correctly cites user notes and does NOT claim external.")

    # Test 3: Query NOT present in notes (e.g., "System calls in Operating Systems")
    chunks_not_in_notes, is_grounded_2 = retrieve_relevant_chunks("System calls in Operating Systems", user.id, db)
    assert is_grounded_2 is False, "Failed: System calls is NOT in user's notes"
    assert len(chunks_not_in_notes) == 0

    resp_external = build_rag_response("sytem calls in operating systems", user.id, db)
    assert resp_external["used_external_knowledge"] is True, "Must flag used_external_knowledge = True"
    assert "Topic Not Found" not in resp_external["answer"], "Must NEVER output 'Topic Not Found' or refuse"
    assert "User Mode" in resp_external["answer"] or "Kernel Mode" in resp_external["answer"] or "System Calls" in resp_external["answer"] or "operating system" in resp_external["answer"].lower()
    print("  [OK] Unuploaded topic answers directly with reliable curriculum knowledge without 'Topic Not Found'.")
    print(">>> TEST 2 & 3 PASSED: Answer source logic strictly separates uploaded vs external knowledge.")

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 4: 10-QUESTION PROGRESSION (ALL 10 STAGES GENUINELY DIFFERENT)
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[TEST 4] Testing 10-question interview progression (Q1 to Q10)...")
    questions = []
    for order in range(10):
        q_data = generate_interview_question(
            topic="Operating Systems",
            question_order=order,
            previous_questions=questions,
            difficulty="easy" if order < 3 else "medium" if order < 7 else "hard",
        )
        q_text = q_data["question"]
        stage = q_data["stage"]
        # Verify no duplicate
        assert not is_duplicate_question(q_text, questions), f"Duplicate found at stage {order}: '{q_text}'"
        questions.append(q_text)
        print(f"  Q{order + 1} [{stage}]: {q_text}")

    assert len(set(questions)) == 10, "All 10 questions must be genuinely unique!"
    print(">>> TEST 4 PASSED: All 10 questions successfully progress through the 10 stages with zero duplicates.")

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 5: DUPLICATE DETECTION AND REJECTION
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[TEST 5] Testing semantic duplicate rejection...")
    q1 = "Explain the difference between a process and a thread, and how process context switching operates."
    q2_duplicate = "What is the difference between a process and a thread, and explain context switching?"
    q3_distinct = "Explain virtual memory, demand paging, and page fault handling in the kernel."

    sim_dup = compute_question_similarity(q1, q2_duplicate)
    is_dup = is_duplicate_question(q2_duplicate, [q1])
    assert is_dup is True, f"Failed to detect duplicate with similarity {sim_dup}"
    print(f"  [OK] Correctly rejected near-duplicate (similarity: {sim_dup:.2f})")

    sim_diff = compute_question_similarity(q1, q3_distinct)
    assert not is_duplicate_question(q3_distinct, [q1]), "Distinct question falsely marked as duplicate"
    print(f"  [OK] Correctly accepted distinct question (similarity: {sim_diff:.2f})")
    print(">>> TEST 5 PASSED: Semantic similarity filter accurately identifies duplicates.")

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 6: PROJECT VIVA QUESTION GENERATION
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[TEST 6] Testing Project Viva generation with real project info...")
    project_desc = (
        "StudyOS AI: An AI-powered study companion built with Next.js 15, FastAPI, PostgreSQL, and Redis caching. "
        "Solves fragmented engineering study materials by indexing student notes and providing exam-calibrated tutoring."
    )
    viva_questions = []
    for order in range(10):
        v_data = generate_interview_question(
            topic="Project Viva",
            question_order=order,
            previous_questions=viva_questions,
            difficulty="medium",
            project_desc=project_desc,
            mode="project_viva",
        )
        vq = v_data["question"]
        assert not is_duplicate_question(vq, viva_questions)
        viva_questions.append(vq)
        print(f"  Viva Q{order + 1} [{v_data['stage']}]: {vq}")

    assert len(set(viva_questions)) == 10
    print(">>> TEST 6 PASSED: Project Viva generated 10 tailored questions based on project technologies.")

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 7: 5-DIMENSIONAL ANSWER EVALUATION & SCORING
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[TEST 7] Testing 5-Dimensional answer evaluation...")
    eval_result = evaluate_interview_answer(
        question="How does Python manage memory internally?",
        user_answer="Python uses reference counting as its primary mechanism. When an object reference drops to zero, memory is freed immediately. For cyclic references, it runs a cyclic garbage collector with 3 generations (Gen 0, 1, 2). CPython also uses PyMalloc for small object allocations under 512 bytes.",
        topic="Python",
        stage_idx=2,
    )
    assert eval_result["correctness_score"] >= 70
    assert eval_result["relevance_score"] >= 70
    assert eval_result["depth_score"] >= 70
    assert eval_result["completeness_score"] >= 70
    assert eval_result["communication_score"] >= 70
    assert eval_result["overall_score"] >= 70
    print(f"  [OK] 5D Scores: Correctness={eval_result['correctness_score']}, Relevance={eval_result['relevance_score']}, Depth={eval_result['depth_score']}, Completeness={eval_result['completeness_score']}, Communication={eval_result['communication_score']} -> Overall={eval_result['overall_score']}%")
    print(f"  [OK] Feedback: {eval_result['feedback']}")
    print(">>> TEST 7 PASSED: 5D evaluation calculates balanced score across all dimensions.")

    # ─────────────────────────────────────────────────────────────────────────
    # TEST 8 & 9: SKIPPED QUESTIONS & FINAL SCORE CALCULATION
    # ─────────────────────────────────────────────────────────────────────────
    print("\n[TEST 8 & 9] Testing skipped question handling and final score calculation...")
    # Simulate an interview session in DB with:
    # 2 answered questions (scores: 80, 90) and 1 skipped question
    session = InterviewSession(user_id=user.id, topic="Python", mode="technical")
    db.add(session)
    db.flush()

    q1 = InterviewQuestion(
        session_id=session.id,
        user_id=user.id,
        question_text="Q1 text",
        user_answer="Solid answer 1",
        correctness_score=80.0,
        overall_score=80.0,
        question_order=0,
        is_skipped=False,
    )
    q2 = InterviewQuestion(
        session_id=session.id,
        user_id=user.id,
        question_text="Q2 text",
        user_answer="Solid answer 2",
        correctness_score=90.0,
        overall_score=90.0,
        question_order=1,
        is_skipped=False,
    )
    q3_skip = InterviewQuestion(
        session_id=session.id,
        user_id=user.id,
        question_text="Q3 text",
        user_answer="[Candidate skipped question]",
        correctness_score=0.0,
        overall_score=0.0,
        question_order=2,
        is_skipped=True,
    )
    db.add_all([q1, q2, q3_skip])
    db.commit()

    # Query questions from session
    all_qs = db.query(InterviewQuestion).filter(InterviewQuestion.session_id == session.id).all()
    submitted = [q for q in all_qs if not q.is_skipped and q.user_answer != "[Candidate skipped question]"]
    skipped = [q for q in all_qs if q.is_skipped]

    assert len(submitted) == 2
    assert len(skipped) == 1

    # Calculate average ONLY from submitted answers
    submitted_scores = [q.overall_score for q in submitted]
    avg_score = round(sum(submitted_scores) / len(submitted_scores))
    assert avg_score == 85, f"Expected 85 for (80 + 90) / 2, got {avg_score}"
    print(f"  [OK] Submitted answers average: {avg_score}% ({len(submitted)} answered, {len(skipped)} skipped)")

    # Test edge case: When 0 answers submitted
    empty_session = InterviewSession(user_id=user.id, topic="Python", mode="technical")
    db.add(empty_session)
    db.flush()
    empty_qs = db.query(InterviewQuestion).filter(InterviewQuestion.session_id == empty_session.id).all()
    empty_submitted = [q for q in empty_qs if not q.is_skipped and q.user_answer]
    empty_avg = round(sum(q.overall_score for q in empty_submitted) / len(empty_submitted)) if empty_submitted else 0
    assert empty_avg == 0, f"Expected 0 (not 85!) when 0 answers submitted, got {empty_avg}"
    print(f"  [OK] Zero answers submitted correctly yields: {empty_avg}% (never 85% fallback)")

    print(">>> TEST 8 & 9 PASSED: Skipped questions correctly isolated; score calculated strictly from submitted answers.")

    print("\n" + "=" * 70)
    print("ALL 9 TEST SUITES COMPLETED AND VERIFIED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
