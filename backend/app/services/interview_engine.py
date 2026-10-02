"""
Interview & Viva Engine — StudyOS AI

1. Strict 10-Stage Progression:
   Q1:  Basic concept
   Q2:  Why it is used (Motivation / Problem solved)
   Q3:  How it works (Internal mechanism / Flow)
   Q4:  Architecture / Design patterns
   Q5:  Implementation / Data structures & algorithms
   Q6:  Technical details (Memory, Concurrency, Protocols)
   Q7:  Practical real-world example / Case study
   Q8:  Problem / Edge case / Failure scenario
   Q9:  Project-specific integration / Practical scenario
   Q10: Follow-up / Deeper technical question / Trade-offs

2. Semantic Duplicate Rejection:
   Compares proposed question against all prior questions.
   Rejects duplicates or near-duplicates (similarity > 0.58).

3. Adaptive Questioning:
   Considers candidate's prior answer and score.
   - Weak answer (< 50): Asks conceptual clarification/simpler angle.
   - Strong answer (>= 80): Probes deeper technical complexity and trade-offs.

4. 5-Dimensional Scoring:
   - Correctness
   - Relevance
   - Technical Depth
   - Completeness
   - Communication
"""

import re
import json
import logging
import difflib
from typing import Optional, List, Dict, Any, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

STAGE_NAMES = [
    "Basic Concept",
    "Why It Is Used",
    "How It Works",
    "Architecture & Design",
    "Implementation",
    "Technical Details",
    "Practical Example",
    "Problem & Edge Case",
    "Project-Specific Question",
    "Follow-up & Deeper Question",
]

STAGE_PROMPTS = {
    0: "Focus on the foundational definition and fundamental concept.",
    1: "Focus on the motivation, why it was created, and what specific problem it solves compared to alternatives.",
    2: "Focus on internal mechanics, data flow, and how the system/concept executes step-by-step under the hood.",
    3: "Focus on high-level architecture, component design, modularity, and structural design patterns.",
    4: "Focus on practical implementation, code structure, algorithmic steps, or key data structures used.",
    5: "Focus on low-level technical details such as memory management, concurrency, protocols, or Big-O complexity.",
    6: "Focus on a concrete practical example or real-world production industry scenario.",
    7: "Focus on failure scenarios, race conditions, edge cases, bottlenecks, or security vulnerabilities.",
    8: "Focus on real project application: how this is integrated into a full-stack system or user-facing application.",
    9: "Focus on advanced trade-offs, scaling challenges, or deep architectural optimization.",
}


def compute_question_similarity(q1: str, q2: str) -> float:
    """Computes similarity between two questions using token Jaccard and SequenceMatcher."""
    s1 = re.sub(r"[^\w\s]", "", q1.lower()).strip()
    s2 = re.sub(r"[^\w\s]", "", q2.lower()).strip()
    if not s1 or not s2:
        return 0.0

    # 1. SequenceMatcher ratio
    seq_ratio = difflib.SequenceMatcher(None, s1, s2).ratio()

    # 2. Token Jaccard similarity (ignoring question numbers)
    t1 = set(w for w in s1.split() if w not in {"what", "how", "why", "explain", "is", "the", "a", "an", "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"})
    t2 = set(w for w in s2.split() if w not in {"what", "how", "why", "explain", "is", "the", "a", "an", "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"})

    if not t1 or not t2:
        jaccard = 0.0
    else:
        intersection = len(t1.intersection(t2))
        union = len(t1.union(t2))
        jaccard = intersection / union if union > 0 else 0.0

    return max(seq_ratio, jaccard)


def is_duplicate_question(candidate: str, previous_questions: List[str], threshold: float = 0.58) -> bool:
    """Returns True if candidate question is too similar to any previously asked question."""
    for prev in previous_questions:
        sim = compute_question_similarity(candidate, prev)
        if sim >= threshold:
            logger.info(f"Duplicate rejected (sim={sim:.2f}): '{candidate}' vs '{prev}'")
            return True
    return False


# ─────────────────────────────────────────────────────────────────────────────
# CURATED 10-STAGE QUESTIONS PER TOPIC
# ─────────────────────────────────────────────────────────────────────────────

CURATED_STAGES_BY_TOPIC: Dict[str, List[str]] = {
    "Python": [
        # Q1: Basic concept
        "Explain the fundamental nature of Python as an interpreted, dynamically typed language, and how bytecode execution works.",
        # Q2: Why it is used
        "Why is Python preferred for rapid prototyping, data engineering, and automation compared to statically typed languages like C++ or Java?",
        # Q3: How it works
        "How does Python manage memory internally using reference counting, cyclic garbage collection, and memory arenas (PyMalloc)?",
        # Q4: Architecture/design
        "Explain the architecture of the CPython runtime, specifically the role and trade-offs of the Global Interpreter Lock (GIL).",
        # Q5: Implementation
        "How would you implement a custom context manager using '__enter__' and '__exit__', and how do generator-based context managers differ?",
        # Q6: Technical details
        "Explain how Python's Method Resolution Order (MRO) and C3 Linearization resolve multiple inheritance and avoid diamond problem conflicts.",
        # Q7: Practical example
        "Walk through how you would use asyncio, coroutines, and event loops to handle 5,000 concurrent HTTP requests in a high-throughput backend.",
        # Q8: Problem/edge case
        "What are common memory leak patterns in Python (such as circular references with custom '__del__'), and how do you profile and eliminate them?",
        # Q9: Project-specific question
        "In a production Python project with FastAPI or Django, how do you structure background tasks, database connection pooling, and configuration management?",
        # Q10: Follow-up/deeper question
        "Compare CPython with alternative runtimes like PyPy (JIT) or Mojo. Under what architectural constraints would you move CPU-intensive modules to C/Rust extensions?"
    ],
    "Operating Systems": [
        # Q1: Basic concept
        "What is an Operating System kernel, and what is the difference between a process and a thread at the OS level?",
        # Q2: Why it is used
        "Why do modern CPUs enforce dual-mode operation (User Mode vs Kernel Mode), and what hardware protections prevent unauthorized memory access?",
        # Q3: How it works
        "Explain the step-by-step lifecycle of a system call from the user space trap instruction through the Interrupt Descriptor Table to kernel return.",
        # Q4: Architecture/design
        "Compare monolithic kernel architecture (Linux) with microkernel architecture (Mach/L4) in terms of fault isolation, IPC performance, and security.",
        # Q5: Implementation
        "Explain how CPU scheduling algorithms (Round Robin with quantum, Multi-Level Feedback Queue) are implemented in production operating systems.",
        # Q6: Technical details
        "Walk through virtual memory address translation: how does the MMU use multi-level page tables, TLB hits/misses, and demand paging to service page faults?",
        # Q7: Practical example
        "Describe a real-world multi-threaded application scenario and explain how mutexes, binary semaphores, and condition variables prevent race conditions.",
        # Q8: Problem/edge case
        "What are the four Coffman conditions for deadlocks, and how does Banker's Deadlock Avoidance algorithm determine whether granting a resource request is safe?",
        # Q9: Project-specific question
        "In a distributed or server application, how do you handle inter-process communication (IPC) using shared memory versus Unix domain sockets, and how do you avoid zombie processes?",
        # Q10: Follow-up/deeper question
        "What is thrashing in virtual memory, how does the Working Set Model or Page Fault Frequency strategy resolve it, and what are the trade-offs?"
    ],
    "DBMS": [
        # Q1: Basic concept
        "What is a Relational Database Management System (RDBMS), and what guarantees do the ACID properties provide for database transactions?",
        # Q2: Why it is used
        "Why do we normalize databases from 1NF to BCNF, and what real data anomalies (insertion, deletion, update) does normalization prevent?",
        # Q3: How it works
        "How does Write-Ahead Logging (WAL) and the ARIES recovery algorithm guarantee durability and atomic recovery after a sudden power loss?",
        # Q4: Architecture/design
        "Compare the internal structure and retrieval trade-offs of B+ Tree indexes versus LSM Trees (Log-Structured Merge Trees) for read-heavy versus write-heavy workloads.",
        # Q5: Implementation
        "How do database query engines execute complex multi-table joins (Nested Loop, Hash Join, and Sort-Merge Join), and how does the optimizer pick an execution plan?",
        # Q6: Technical details
        "Explain the 4 ANSI SQL transaction isolation levels (Read Uncommitted, Read Committed, Repeatable Read, Serializable) and the concurrency anomalies each level prevents.",
        # Q7: Practical example
        "Given a slow SQL query scanning millions of rows, explain how you would inspect an EXPLAIN ANALYZE plan, diagnose table scans, and build composite indexes.",
        # Q8: Problem/edge case
        "Explain Two-Phase Locking (2PL) vs Strict 2PL. How does Strict 2PL guarantee cascadeless aborts, and how does the database engine detect and resolve deadlocks?",
        # Q9: Project-specific question
        "When designing the database for a high-traffic project, how do you partition/shard data, implement connection pools, and manage database schema migrations without downtime?",
        # Q10: Follow-up/deeper question
        "Compare relational databases with distributed NoSQL stores under the CAP theorem. When is eventual consistency acceptable over strong serializability?"
    ],
    "Computer Networks": [
        # Q1: Basic concept
        "Explain the layered architecture of the OSI 7-layer model versus the TCP/IP 4-layer model and which protocol operates at each layer.",
        # Q2: Why it is used
        "Why does TCP implement reliable connection-oriented transport with acknowledgments and flow control, whereas UDP prefers lightweight connectionless datagrams?",
        # Q3: How it works
        "Walk through the TCP 3-way handshake (SYN, SYN-ACK, ACK) and 4-way connection teardown, including the purpose of the TIME_WAIT state.",
        # Q4: Architecture/design
        "Explain the hierarchical architecture of the Domain Name System (DNS), including root servers, TLD nameservers, authoritative servers, and DNS caching.",
        # Q5: Implementation
        "How do Sliding Window protocols (Go-Back-N ARQ and Selective Repeat ARQ) work, and how are sequence numbers and timer windows implemented?",
        # Q6: Technical details
        "Explain TCP Congestion Control mechanisms (Slow Start, Congestion Avoidance, Fast Retransmit, and Fast Recovery) and how TCP reacts to packet loss.",
        # Q7: Practical example
        "Walk through everything that happens at the network layer when a user types 'https://example.com' into a browser until the first HTML byte is received.",
        # Q8: Problem/edge case
        "What is Head-of-Line (HoL) blocking in HTTP/1.1 and TCP, and how do HTTP/2 multiplexing and HTTP/3 over QUIC (UDP) solve this issue?",
        # Q9: Project-specific question
        "When deploying a client-server web project, how do you configure NAT, reverse proxies (Nginx), TLS termination, and WebSockets for real-time bidirectional communication?",
        # Q10: Follow-up/deeper question
        "How do BGP (Border Gateway Protocol) and Anycast routing work across global Autonomous Systems, and how do CDNs use them to mitigate DDoS attacks?"
    ],
    "Data Structures & Algorithms": [
        # Q1: Basic concept
        "Explain the fundamental difference between linear and non-linear data structures, and define Big-O, Big-Omega, and Big-Theta asymptotic notations.",
        # Q2: Why it is used
        "Why do Hash Tables provide average-case O(1) lookups, and how do hash collisions occur and get resolved via chaining versus open addressing?",
        # Q3: How it works
        "Walk through QuickSort step-by-step: how does Lomuto or Hoare partitioning work, why can it degrade to O(n^2), and how does randomized pivot selection fix it?",
        # Q4: Architecture/design
        "Explain how balanced search trees like Red-Black Trees or AVL Trees maintain logarithmic height during insertions and deletions through tree rotations.",
        # Q5: Implementation
        "How would you implement Dijkstra's Single-Source Shortest Path algorithm using a min-heap, and why does it fail on graphs with negative edge weights?",
        # Q6: Technical details
        "What is Dynamic Programming? Explain the mathematical principle of optimal substructure and overlapping subproblems with memoization versus tabulation.",
        # Q7: Practical example
        "Walk through how an autocomplete search engine can be implemented using a Trie data structure, including prefix search and ranking mechanisms.",
        # Q8: Problem/edge case
        "How would you find the median of a continuously streaming infinite series of integers in O(log n) time per insertion using two priority queues?",
        # Q9: Project-specific question
        "In a real-world software system (like a task scheduler or social feed), what data structure would you select for priority queuing, cycle detection, or relationship graphs?",
        # Q10: Follow-up/deeper question
        "Explain the Disjoint Set Union (DSU) data structure with Union by Rank and Path Compression, and prove how its operations achieve near O(1) amortized time."
    ],
    "Machine Learning": [
        # Q1: Basic concept
        "Explain the fundamental distinction between supervised learning, unsupervised learning, and reinforcement learning with concrete problem statements.",
        # Q2: Why it is used
        "Why do we split datasets into training, validation, and test sets, and how does k-fold cross-validation prevent data leakage and overfitting?",
        # Q3: How it works
        "How does Gradient Descent (and SGD/Adam) optimize loss functions, and how do learning rates, momentum, and backpropagation update model weights?",
        # Q4: Architecture/design
        "Explain the bias-variance tradeoff in machine learning models and how regularization techniques (L1 Lasso, L2 Ridge, Dropout) control model complexity.",
        # Q5: Implementation
        "How does a Decision Tree algorithm (like CART or ID3) choose split points using Information Gain, Entropy, or Gini Impurity?",
        # Q6: Technical details
        "Explain evaluation metrics for classification (Precision, Recall, F1-Score, ROC-AUC) and when accuracy is completely misleading for imbalanced datasets.",
        # Q7: Practical example
        "Walk through an end-to-end Machine Learning pipeline: data preprocessing, missing value imputation, feature scaling, encoding, model training, and hyperparameter tuning.",
        # Q8: Problem/edge case
        "What is the vanishing/exploding gradient problem in deep neural networks, and how do activation functions (ReLU), batch normalization, and residual connections (ResNet) mitigate it?",
        # Q9: Project-specific question
        "In a production machine learning project, how do you handle data drift, model versioning, feature stores, and low-latency inference serving?",
        # Q10: Follow-up/deeper question
        "Explain the Transformer architecture: how does multi-head self-attention work, and why did it replace RNNs/LSTMs in modern NLP and vision foundation models?"
    ],
    "System Design": [
        # Q1: Basic concept
        "Explain the core tenets of modern System Design: scalability, availability, reliability, and maintainability.",
        # Q2: Why it is used
        "Why and when should an engineering team transition from a monolithic architecture to a distributed microservices architecture?",
        # Q3: How it works
        "How does a distributed cache (like Redis or Memcached) operate, and what are the trade-offs between Cache-Aside, Write-Through, and Write-Back caching strategies?",
        # Q4: Architecture/design
        "Explain the CAP theorem and PACELC theorem. How do modern distributed databases (e.g. Cassandra vs PostgreSQL) choose between consistency and availability?",
        # Q5: Implementation
        "How would you design a distributed rate limiter (Token Bucket or Leaky Bucket algorithm) to protect backend microservices from API abuse?",
        # Q6: Technical details
        "Explain database sharding strategies (Range-based, Hash-based, and Consistent Hashing) and how consistent hashing minimizes re-sharding when nodes join or leave.",
        # Q7: Practical example
        "Walk through the high-level architecture of a URL Shortener service (like TinyURL) handling 100 million daily active requests with low latency.",
        # Q8: Problem/edge case
        "How do you handle distributed transactions across multiple microservices without locking resources? Explain the Saga Pattern (orchestration vs choreography) and 2PC.",
        # Q9: Project-specific question
        "In your application, how do you manage asynchronous message queues (Kafka / RabbitMQ) to decouple heavy processing tasks and handle backpressure?",
        # Q10: Follow-up/deeper question
        "How do you design a real-time collaborative application (like Google Docs or Figma) handling concurrent edits using Operational Transformation (OT) or CRDTs?"
    ]
}


def generate_project_viva_question(
    stage_idx: int,
    project_desc: str,
    previous_questions: List[str],
    last_answer: Optional[str] = None,
    last_score: Optional[float] = None,
) -> str:
    """Generates stage-specific, highly tailored Project Viva questions based on project info."""
    clean_desc = project_desc.strip() if project_desc else "Your Capstone Project"

    # Extract technologies mentioned in description
    known_tech = ["react", "next.js", "vue", "angular", "node.js", "express", "fastapi",
                  "django", "flask", "python", "java", "spring boot", "c++", "go",
                  "postgresql", "mysql", "mongodb", "redis", "sqlite", "docker",
                  "kubernetes", "aws", "gcp", "azure", "graphql", "rest", "websocket",
                  "webrtc", "kafka", "rabbitmq", "tailwind", "typescript", "pytorch",
                  "tensorflow", "machine learning", "nlp", "llm", "rag"]
    found_tech = [t.title() for t in known_tech if re.search(r"\b" + re.escape(t) + r"\b", clean_desc, re.I)]
    tech_str = ", ".join(found_tech[:4]) if found_tech else "your chosen technology stack"

    viva_templates = [
        # Stage 0: Basic Concept
        f"Give an executive summary of your project: what core real-world problem does it solve, and who are the primary end-users?",
        # Stage 1: Why it is used
        f"Why did you choose to build this project? What existing software solutions, libraries, or manual workflows did you evaluate, and what limitations were you addressing?",
        # Stage 2: How it works
        f"Walk me through the complete end-to-end data lifecycle in your system: from when a user triggers an action in the UI, through backend routing and business logic, to database persistence.",
        # Stage 3: Architecture & Design
        f"Explain the high-level architecture of your project. Did you structure it as a monolith, modular client-server, or microservices, and how are components decoupled?",
        # Stage 4: Implementation
        f"Regarding implementation, why did you select {tech_str}? What specific technical advantages did these frameworks offer over alternative options?",
        # Stage 5: Technical Details
        f"Walk through your database schema and data models. How did you structure relationships, enforce data integrity, and index key fields for performant queries?",
        # Stage 6: Practical Example
        f"Walk me through a live demonstration scenario: what is the most critical user journey in your application, and how does the backend validate and process the payload?",
        # Stage 7: Problem & Edge Case
        f"What happens in your application when unexpected failures occur—such as database connection drops, invalid client payloads, or simultaneous concurrent updates?",
        # Stage 8: Project-Specific Question
        f"What was the single most challenging technical hurdle, architectural roadblock, or elusive bug you encountered while building this project, and how did you diagnose and resolve it?",
        # Stage 9: Follow-up & Deeper Question
        f"If you were given 6 months and funding to scale this project from a prototype to 100,000 daily active users, what architectural bottlenecks would you tackle first (caching, load balancing, sharding), and what future features would you build?"
    ]

    # Adaptive follow-up adjustment
    if last_score is not None and last_score < 50 and stage_idx > 0:
        if stage_idx == 2:
            return f"Let's focus on the basics of your project's workflow: what are the main inputs a user provides, and what is the exact output your system produces?"
        elif stage_idx == 4:
            return f"Could you explain step-by-step how your frontend communicates with your backend APIs, including HTTP methods and data formats (like JSON)?"

    idx = min(max(0, stage_idx), len(viva_templates) - 1)
    cand = viva_templates[idx]

    # Ensure no duplicate
    if is_duplicate_question(cand, previous_questions):
        cand = f"In the context of your project ({clean_desc[:40]}...), explain the technical implementation and design rationale for {STAGE_NAMES[idx]}."

    return cand


def generate_universal_stage_question(
    topic: str,
    stage_idx: int,
    previous_questions: List[str],
    last_answer: Optional[str] = None,
    last_score: Optional[float] = None,
) -> str:
    """Generates a natural, human-written, stage-appropriate question for any arbitrary technical topic."""
    idx = min(max(0, stage_idx), len(STAGE_NAMES) - 1)
    stage_name = STAGE_NAMES[idx]

    templates = [
        # Stage 0: Basic Concept
        f"What is {topic} fundamentally, and what core concept or computational abstraction does it represent?",
        # Stage 1: Why It Is Used
        f"Why is {topic} necessary in modern computing, and what specific limitations or challenges does it solve compared to simpler alternatives?",
        # Stage 2: How It Works
        f"Walk through the step-by-step operational mechanism of {topic}: how does data or control flow through the system during execution?",
        # Stage 3: Architecture & Design
        f"Explain the internal architecture and design principles governing {topic}. What are the primary sub-components and their interactions?",
        # Stage 4: Implementation
        f"How is {topic} implemented in software or hardware? What underlying data structures, algorithms, or APIs are fundamental to its operation?",
        # Stage 5: Technical Details
        f"Discuss the low-level technical trade-offs of {topic}, such as memory footprint, CPU utilization, thread safety, or algorithmic complexity.",
        # Stage 6: Practical Example
        f"Provide a concrete real-world engineering scenario where {topic} is deployed in industry. How does it improve performance or reliability in that scenario?",
        # Stage 7: Problem & Edge Case
        f"What are the major failure modes, security vulnerabilities, or edge cases associated with {topic}, and how do engineering teams safeguard against them?",
        # Stage 8: Project-Specific Question
        f"How would you integrate {topic} into a production-grade software project or system? What configuration parameters or design decisions would you need to make?",
        # Stage 9: Follow-up & Deeper Question
        f"Looking at the future and scalability of {topic}, what are its fundamental architectural bottlenecks when scaled to high concurrency or massive data volumes?"
    ]

    cand = templates[idx]
    if is_duplicate_question(cand, previous_questions):
        cand = f"Deepening our exploration of {topic}, explain how {stage_name.lower()} is handled in robust, production-grade systems."

    return cand


def generate_interview_question(
    topic: str,
    question_order: int,
    previous_questions: List[str],
    difficulty: str,
    project_desc: Optional[str] = None,
    mode: str = "technical",
    last_answer: Optional[str] = None,
    last_score: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Generates next interview question strictly adhering to:
    1. 10 progressive stages
    2. Adaptive interviewer behavior
    3. Semantic duplicate rejection
    4. Project-specific Viva alignment
    """
    stage_idx = min(max(0, question_order), 9)
    stage_name = STAGE_NAMES[stage_idx]
    is_viva = mode == "project_viva" or "viva" in topic.lower()

    # 1. Attempt LLM Generation if OpenAI or Gemini is available
    if settings.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)

            prev_formatted = "\n".join(f"- Q{i+1}: {q}" for i, q in enumerate(previous_questions))
            adaptive_context = ""
            if last_answer and last_score is not None:
                if last_score < 50:
                    adaptive_context = f"\nCandidate's previous answer was WEAK (score {last_score:.0f}%). Provide a supportive, simpler conceptual follow-up on this stage to test fundamental understanding."
                elif last_score >= 80:
                    adaptive_context = f"\nCandidate's previous answer was STRONG (score {last_score:.0f}%). Probe deeper into advanced edge cases, trade-offs, and architectural internals."

            project_context = f"\nStudent Capstone Project Info:\n{project_desc}" if is_viva and project_desc else ""

            prompt = f"""You are a senior technical interviewer and university viva examiner conducting an interview on {topic}.
Mode: {"Project Viva Defense" if is_viva else "Technical Mock Round"}
Current Stage: Question {stage_idx + 1} of 10 -> {stage_name}
Target Difficulty: {difficulty}
{STAGE_PROMPTS.get(stage_idx, "")}
{project_context}
{adaptive_context}

PREVIOUS QUESTIONS ALREADY ASKED (DO NOT REPEAT OR PARAPHRASE ANY OF THESE):
{prev_formatted if prev_formatted else "None yet (First question)"}

CRITICAL RULES:
1. The question MUST be genuinely different from all previous questions.
2. Address Stage #{stage_idx + 1} ({stage_name}).
3. Write in natural, professional, human-written style.
4. Do NOT include question number in the question text.

Return strictly valid JSON:
{{
  "question": "Clear, natural, articulate question text here?",
  "stage": "{stage_name}",
  "expected_points": ["point 1", "point 2", "point 3"]
}}"""

            response = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4,
                max_tokens=450,
            )
            raw = response.choices[0].message.content.strip()
            json_m = re.search(r"\{.*\}", raw, re.DOTALL)
            if json_m:
                data = json.loads(json_m.group())
                cand_q = data.get("question", "").strip()
                if cand_q and not is_duplicate_question(cand_q, previous_questions):
                    return {
                        "question": cand_q,
                        "stage": stage_name,
                        "expected_points": data.get("expected_points", []),
                    }
                else:
                    logger.warning(f"LLM produced duplicate question, activating stage fallback.")
        except Exception as e:
            logger.error(f"LLM Interview generation failed: {e}")

    # 2. Stage Fallback
    if is_viva:
        q_text = generate_project_viva_question(
            stage_idx=stage_idx,
            project_desc=project_desc or "",
            previous_questions=previous_questions,
            last_answer=last_answer,
            last_score=last_score,
        )
        return {
            "question": q_text,
            "stage": stage_name,
            "expected_points": ["Core architectural rationale", "Component decoupling", "Edge case validation"],
        }

    # Check curated topic questions
    for top_key, q_list in CURATED_STAGES_BY_TOPIC.items():
        if top_key.lower() in topic.lower() or topic.lower() in top_key.lower():
            if stage_idx < len(q_list):
                cand = q_list[stage_idx]
                if not is_duplicate_question(cand, previous_questions):
                    return {
                        "question": cand,
                        "stage": stage_name,
                        "expected_points": [],
                    }

    # Universal stage template
    q_text = generate_universal_stage_question(
        topic=topic,
        stage_idx=stage_idx,
        previous_questions=previous_questions,
        last_answer=last_answer,
        last_score=last_score,
    )
    return {
        "question": q_text,
        "stage": stage_name,
        "expected_points": [],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5-DIMENSIONAL ANSWER EVALUATION ENGINE
# ─────────────────────────────────────────────────────────────────────────────

def evaluate_interview_answer(
    question: str,
    user_answer: str,
    topic: str,
    stage_idx: int = 0,
    expected_points: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Evaluates answer strictly across 5 dimensions:
    - Correctness (30%)
    - Relevance (20%)
    - Technical Depth (25%)
    - Completeness (15%)
    - Communication (10%)
    """
    ans = user_answer.strip()
    if not ans:
        return {
            "correctness_score": 0.0,
            "relevance_score": 0.0,
            "depth_score": 0.0,
            "completeness_score": 0.0,
            "communication_score": 0.0,
            "overall_score": 0.0,
            "feedback": "No answer provided.",
            "missing_points": ["Candidate did not submit an answer for this question."],
            "follow_up_question": None,
        }

    # 1. Attempt LLM Evaluation
    if settings.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)

            stage_name = STAGE_NAMES[min(max(0, stage_idx), 9)]
            prompt = f"""You are a strict, fair engineering interviewer evaluating a candidate's answer.
Topic: {topic}
Interview Stage: {stage_name}
Question Asked: {question}
Candidate's Answer:
\"\"\"{ans}\"\"\"

Evaluate the candidate's response rigorously across these 5 dimensions (each on a 0-100 scale):
1. correctness (0-100): Accuracy of technical facts, definitions, and algorithms.
2. relevance (0-100): Did the candidate directly answer the specific question asked without rambling?
3. technical_depth (0-100): Did they mention internal mechanisms, trade-offs, complexity, or edge cases?
4. completeness (0-100): How thoroughly did they address all parts of the question?
5. communication (0-100): Clarity, structure, terminology, and concise articulation.

Calculate overall_score as:
overall = round(correctness * 0.30 + relevance * 0.20 + technical_depth * 0.25 + completeness * 0.15 + communication * 0.10)

Return strictly valid JSON:
{{
  "correctness_score": 75,
  "relevance_score": 80,
  "depth_score": 65,
  "completeness_score": 70,
  "communication_score": 85,
  "overall_score": 74,
  "feedback": "2-3 sentences of constructive, specific technical feedback highlighting strengths and weaknesses.",
  "missing_points": ["Important missing detail 1", "Key edge case or formula not mentioned"],
  "follow_up_question": "A natural follow-up question probing deeper into their answer?"
}}"""

            response = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=650,
            )
            raw = response.choices[0].message.content.strip()
            json_m = re.search(r"\{.*\}", raw, re.DOTALL)
            if json_m:
                data = json.loads(json_m.group())
                c = float(data.get("correctness_score", 60))
                r = float(data.get("relevance_score", 65))
                d = float(data.get("depth_score", 55))
                comp = float(data.get("completeness_score", 60))
                comm = float(data.get("communication_score", 70))
                overall = float(data.get("overall_score", round(c * 0.30 + r * 0.20 + d * 0.25 + comp * 0.15 + comm * 0.10)))

                return {
                    "correctness_score": c,
                    "relevance_score": r,
                    "depth_score": d,
                    "completeness_score": comp,
                    "communication_score": comm,
                    "overall_score": overall,
                    "feedback": data.get("feedback", "Good technical explanation."),
                    "missing_points": data.get("missing_points", []),
                    "follow_up_question": data.get("follow_up_question"),
                }
        except Exception as e:
            logger.error(f"LLM Answer evaluation failed: {e}")

    # 2. High-Fidelity Heuristic Evaluator
    words = ans.split()
    word_count = len(words)

    # Base score on depth and articulation
    # Length calibration: < 15 words is weak; 40-120 words is ideal
    if word_count < 10:
        base_correctness = 35.0
        base_relevance = 45.0
        base_depth = 25.0
        base_comp = 30.0
        base_comm = 40.0
        feedback = "Your answer was very brief. In technical interviews, provide precise definitions, operational steps, and real-world examples."
        missing_points = ["Elaborate on the internal execution flow", "Mention Time/Space complexity or design trade-offs"]
    elif word_count < 30:
        base_correctness = 58.0
        base_relevance = 65.0
        base_depth = 48.0
        base_comp = 50.0
        base_comm = 62.0
        feedback = "You stated the basic concept, but lacked depth regarding internal architecture, edge cases, and concrete trade-offs."
        missing_points = ["Detail how the mechanism works step-by-step under the hood", "Discuss failure handling or edge cases"]
    elif word_count < 80:
        base_correctness = 76.0
        base_relevance = 80.0
        base_depth = 72.0
        base_comp = 74.0
        base_comm = 80.0
        feedback = "Solid answer! You explained the core concept clearly with good technical vocabulary."
        missing_points = ["Mention specific architectural trade-offs or performance benchmarks"]
    else:
        base_correctness = 85.0
        base_relevance = 85.0
        base_depth = 82.0
        base_comp = 84.0
        base_comm = 85.0
        feedback = "Comprehensive and structured response! You articulated the design principles and internal mechanisms effectively."
        missing_points = ["Consider concisely summarizing key trade-offs at the end"]

    # Terminology bonus
    has_code = bool("def " in ans or "class " in ans or "return" in ans or "{" in ans)
    has_complexity = bool(re.search(r"O\([^)]+\)", ans) or "time complexity" in ans.lower() or "space complexity" in ans.lower())
    if has_code or has_complexity:
        base_depth = min(100.0, base_depth + 10.0)
        base_correctness = min(100.0, base_correctness + 5.0)

    overall = round(base_correctness * 0.30 + base_relevance * 0.20 + base_depth * 0.25 + base_comp * 0.15 + base_comm * 0.10)

    stage_name = STAGE_NAMES[min(max(0, stage_idx), 9)]
    follow_up = f"How would you optimize or scale this in a high-concurrency production environment?"

    return {
        "correctness_score": base_correctness,
        "relevance_score": base_relevance,
        "depth_score": base_depth,
        "completeness_score": base_comp,
        "communication_score": base_comm,
        "overall_score": overall,
        "feedback": feedback,
        "missing_points": missing_points,
        "follow_up_question": follow_up,
    }
