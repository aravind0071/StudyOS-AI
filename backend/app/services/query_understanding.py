"""
Query Understanding & Fuzzy Semantic Matching Engine — StudyOS AI

Provides robust tolerance for:
1. Spelling mistakes ("sytem calls", "deadlcok", "chekcsum", "dijkstras")
2. Grammar variations & filler phrases ("tell me about system calls", "explain what is a system call")
3. Short forms & acronyms ("os" -> "operating systems", "syscall" -> "system call", "2pl" -> "two phase locking")
4. Suffix variations (plurals, verb tenses: "calls" <-> "call", "locking" <-> "lock")
"""

import re
import difflib
from typing import List, Set, Tuple, Optional, Dict

STOPWORDS: Set[str] = {
    "what", "is", "a", "an", "the", "in", "on", "at", "to", "for", "of", "with",
    "by", "and", "or", "how", "does", "do", "explain", "describe", "tell", "me",
    "about", "give", "write", "define", "definition", "marks", "mark", "2m", "5m",
    "10m", "16m", "question", "answer", "please", "can", "you", "detailed", "brief",
    "simple", "simply", "overview", "study", "lecture", "notes", "slide", "slides",
    "concept", "concepts", "topic", "topics", "i", "want", "know", "mean", "meant",
    "understand", "kindly", "discuss", "solve", "working", "difference", "between"
}

# Common CS & engineering acronyms / short forms
ACRONYM_MAP: Dict[str, List[str]] = {
    "os": ["operating system", "operating systems"],
    "dbms": ["database management system", "database", "databases"],
    "cn": ["computer network", "computer networks"],
    "dsa": ["data structures", "algorithms"],
    "ml": ["machine learning"],
    "ai": ["artificial intelligence"],
    "dl": ["deep learning"],
    "2pl": ["two phase locking", "two-phase locking", "locking protocol"],
    "wal": ["write ahead logging", "write-ahead logging"],
    "ipc": ["inter process communication", "inter-process communication"],
    "syscall": ["system call", "system calls"],
    "syscalls": ["system call", "system calls"],
    "tcp": ["transmission control protocol"],
    "udp": ["user datagram protocol"],
    "ip": ["internet protocol"],
    "dns": ["domain name system"],
    "http": ["hypertext transfer protocol"],
    "https": ["hypertext transfer protocol secure"],
    "ssl": ["secure sockets layer", "tls"],
    "tls": ["transport layer security"],
    "crc": ["cyclic redundancy check"],
    "hdlc": ["high level data link control"],
    "vm": ["virtual memory"],
    "mmu": ["memory management unit"],
    "tlb": ["translation lookaside buffer"],
    "cpu": ["central processing unit", "processor"],
    "ram": ["random access memory"],
    "gil": ["global interpreter lock"],
    "mro": ["method resolution order"],
    "bfs": ["breadth first search"],
    "dfs": ["depth first search"],
    "dp": ["dynamic programming"],
    "avl": ["avl tree", "balanced tree"],
    "bst": ["binary search tree"],
    "fifo": ["first in first out"],
    "lru": ["least recently used"],
    "acid": ["atomicity consistency isolation durability"],
    "1nf": ["first normal form"],
    "2nf": ["second normal form"],
    "3nf": ["third normal form"],
    "bcnf": ["boyce codd normal form"],
    "rdbms": ["relational database"],
    "sql": ["structured query language"],
    "nosql": ["non relational database"],
    "api": ["application programming interface"],
    "rest": ["representational state transfer"],
    "gui": ["graphical user interface"],
    "cli": ["command line interface"],
    "oop": ["object oriented programming"],
    "oops": ["object oriented programming"],
}

# Direct common typo corrections
KNOWN_TYPOS: Dict[str, str] = {
    "sytem": "system",
    "sysem": "system",
    "systm": "system",
    "sysstem": "system",
    "deadlcok": "deadlock",
    "deadlok": "deadlock",
    "dedlock": "deadlock",
    "chekcsum": "checksum",
    "chksum": "checksum",
    "checksm": "checksum",
    "proccess": "process",
    "proccesses": "processes",
    "proces": "process",
    "thred": "thread",
    "threds": "threads",
    "algoritm": "algorithm",
    "algoritem": "algorithm",
    "algorithem": "algorithm",
    "algos": "algorithms",
    "scheduing": "scheduling",
    "schedulin": "scheduling",
    "schedulng": "scheduling",
    "semephore": "semaphore",
    "semaphor": "semaphore",
    "semaphores": "semaphores",
    "dijkstras": "dijkstra",
    "dijkstr": "dijkstra",
    "dijkstraa": "dijkstra",
    "normalisation": "normalization",
    "interupt": "interrupt",
    "intrupt": "interrupt",
    "concurrancy": "concurrency",
    "concurreny": "concurrency",
    "serialisability": "serializability",
    "serializability": "serializability",
    "quicksort": "quicksort",
    "qsort": "quicksort",
    "mergesort": "mergesort",
    "heapsort": "heapsort",
    "recurrsion": "recursion",
    "polymorphim": "polymorphism",
    "inheretance": "inheritance",
    "inheritence": "inheritance",
    "encapsulaton": "encapsulation",
    "abstrction": "abstraction",
    "memmory": "memory",
    "memroy": "memory",
    "segmetation": "segmentation",
    "pagging": "paging",
    "subnettng": "subnetting",
    "subntting": "subnetting",
    "routng": "routing",
}

# Standard CS term dictionary for fuzzy spell-checking
CS_VOCABULARY: Set[str] = {
    "system", "systems", "call", "calls", "process", "processes", "thread", "threads",
    "deadlock", "deadlocks", "semaphore", "semaphores", "mutex", "mutexes", "monitor",
    "paging", "segmentation", "virtual", "memory", "scheduling", "banker", "bankers",
    "algorithm", "algorithms", "dijkstra", "normalization", "transaction", "transactions",
    "locking", "lock", "locks", "two-phase", "acid", "checksum", "crc", "protocol", "protocols",
    "transport", "routing", "network", "networks", "packet", "packets", "socket", "sockets",
    "sliding", "window", "knapsack", "tree", "trees", "graph", "graphs", "heap", "heaps",
    "quicksort", "mergesort", "dynamic", "programming", "inheritance", "polymorphism",
    "encapsulation", "abstraction", "generator", "decorators", "decorator", "asyncio",
    "cache", "caching", "sharding", "replica", "replication", "index", "indexes", "indices",
    "recursion", "pointer", "pointers", "array", "arrays", "queue", "queues", "stack", "stacks",
    "linked", "list", "binary", "search", "sorting", "complexity", "kernel", "user", "mode",
    "interrupt", "interrupts", "trap", "traps", "page", "fault", "faults", "thrashing",
    "frame", "frames", "datagram", "segment", "handshake", "congestion", "control", "flow",
    "optical", "fiber", "transmission", "medium", "stop", "wait", "parity", "hamming",
    "distance", "b-tree", "b+tree", "hash", "hashing", "collision", "foreign", "primary",
    "key", "keys", "candidate", "super", "join", "joins", "view", "views", "trigger", "triggers",
}


def basic_stem(word: str) -> str:
    """Strip common English plural and verb suffixes for topic normalization."""
    w = word.lower().strip()
    if len(w) <= 3:
        return w
    if w.endswith("ies") and len(w) > 4:
        return w[:-3] + "y"
    if w.endswith("es") and len(w) > 4:
        # e.g., processes -> process, boxes -> box
        if w.endswith(("sses", "shes", "ches", "xes")):
            return w[:-2]
        return w[:-1]
    if w.endswith("s") and not w.endswith("ss") and len(w) > 3:
        return w[:-1]
    if w.endswith("ing") and len(w) > 5:
        return w[:-3]
    if w.endswith("ed") and len(w) > 4:
        return w[:-2]
    return w


def correct_term(token: str) -> str:
    """Correct a single token using typo dictionary and difflib similarity against CS vocabulary."""
    t = token.lower().strip()
    if not t or len(t) < 3:
        return t

    # 1. Direct typo dictionary
    if t in KNOWN_TYPOS:
        return KNOWN_TYPOS[t]

    # 2. Check if already in vocabulary or stopwords
    if t in CS_VOCABULARY or t in STOPWORDS:
        return t

    # 3. Check stem in vocabulary
    t_stem = basic_stem(t)
    for v in CS_VOCABULARY:
        if basic_stem(v) == t_stem:
            return v

    # 4. Fuzzy match using difflib
    matches = difflib.get_close_matches(t, list(CS_VOCABULARY), n=1, cutoff=0.76)
    if matches:
        return matches[0]

    return t


def normalize_query_text(query: str) -> str:
    """Lowers and removes punctuation."""
    if not query:
        return ""
    clean = re.sub(r"[^\w\s\-]", " ", query.lower())
    clean = re.sub(r"[\s\-_]+", " ", clean).strip()
    return clean


def extract_topic_and_expansions(query: str) -> dict:
    """
    Given a student query (with potential typos, grammar, fillers, or short forms),
    extract:
    - raw_query
    - cleaned_topic: core normalized topic phrase (e.g. "system call")
    - corrected_tokens: list of cleaned and typo-corrected tokens
    - stemmed_tokens: list of stemmed tokens
    - expanded_terms: list of expanded synonyms/acronyms (e.g. "system calls", "operating system")
    """
    raw = query.strip()

    # 1. Extract portion after colon if prompt was structured (e.g., "Explain for 5 marks: system calls")
    q_target = raw
    while ":" in q_target:
        parts = q_target.split(":", 1)
        after_colon = parts[1].strip()
        if len(after_colon) >= 2:
            q_target = after_colon
        else:
            break

    # 2. Strip conversational prefixes and marks boilerplate
    clean_q = re.sub(
        r"^(what is|what are|define|explain about|explain simply|explain|describe|tell me about|how does|how do|can you tell me about|can you explain|give an account on|write short notes on|discuss about|discuss|give a|solve a|provide a|i want to learn about|notes on)\s+",
        "",
        q_target,
        flags=re.IGNORECASE,
    )
    # Strip conversational give/tell me phrases
    clean_q = re.sub(r"^(?:give|tell|show|provide)(?:\s+me)?\s+(?:(?:a|an|the)\s+)?", "", clean_q, flags=re.IGNORECASE)
    # Strip marks qualifiers wherever they appear in the query
    clean_q = re.sub(r"\b\d+\s*(?:marks?|mark|m|answers?|questions?|solutions?)\b", "", clean_q, flags=re.IGNORECASE)
    clean_q = re.sub(r"\b(?:answer|question|solution|notes?|explanation)\s+(?:for|on|about|of)\b", "", clean_q, flags=re.IGNORECASE)
    clean_q = re.sub(r"\b(?:answer|question|solution|notes?|explanation)\b", "", clean_q, flags=re.IGNORECASE)

    # Strip any leading and trailing prepositions/filler iteratively
    prev_str = None
    while prev_str != clean_q:
        prev_str = clean_q
        clean_q = re.sub(r"^(?:for|on|about|of|the|a|an|in|with|to)\s+", "", clean_q, flags=re.IGNORECASE).strip()
        clean_q = re.sub(r"\s+(?:for|on|about|of|in|to)\s*$", "", clean_q, flags=re.IGNORECASE).strip()
        clean_q = re.sub(r"^\d+\s+", "", clean_q).strip()

    clean_q = re.sub(r"[?!.,;:]+$", "", clean_q).strip()

    norm_clean = normalize_query_text(clean_q)
    tokens = [t for t in norm_clean.split() if t]

    # 3. Correct typos for each token
    corrected_tokens = []
    for t in tokens:
        corrected = correct_term(t)
        corrected_tokens.append(corrected)

    # Filter stopwords for topic keywords
    meaningful_tokens = [t for t in corrected_tokens if t not in STOPWORDS and len(t) > 1]
    if not meaningful_tokens:
        meaningful_tokens = [t for t in tokens if t not in STOPWORDS and len(t) > 1]
    if not meaningful_tokens:
        meaningful_tokens = corrected_tokens or tokens

    clean_topic = " ".join(meaningful_tokens)

    # 4. Generate expansions (acronyms, plurals, stems)
    expanded_terms: List[str] = [clean_topic]
    stemmed_tokens = [basic_stem(t) for t in meaningful_tokens]

    # For SINGLE-token queries, add singular/plural and stem variations
    if len(meaningful_tokens) == 1:
        t = meaningful_tokens[0]
        s = basic_stem(t)
        if s != t and s not in expanded_terms:
            expanded_terms.append(s)
        if not t.endswith("s"):
            expanded_terms.append(t + "s")
        elif t.endswith("s") and len(t) > 3:
            expanded_terms.append(t[:-1])
    else:
        # For MULTI-token queries, add full phrase variations and sub-phrases:
        if norm_clean and norm_clean not in expanded_terms:
            expanded_terms.append(norm_clean)

        # Core 2-token sub-phrase (e.g. "file handling in python" -> "file handling")
        if len(meaningful_tokens) >= 2:
            sub2 = f"{meaningful_tokens[0]} {meaningful_tokens[1]}"
            if sub2 not in expanded_terms:
                expanded_terms.append(sub2)

        # Plural/singular on phrase
        if clean_topic.endswith("s") and len(clean_topic) > 4:
            expanded_terms.append(clean_topic[:-1])
        else:
            expanded_terms.append(clean_topic + "s")

        # Word-level singular/plural variant for first word (e.g., "file handling" <-> "files handling")
        first_w = meaningful_tokens[0]
        rest_w = " ".join(meaningful_tokens[1:])
        if first_w.endswith("s") and len(first_w) > 3:
            alt_phrase = f"{first_w[:-1]} {rest_w}"
            if alt_phrase not in expanded_terms:
                expanded_terms.append(alt_phrase)
        elif not first_w.endswith("s"):
            alt_phrase = f"{first_w}s {rest_w}"
            if alt_phrase not in expanded_terms:
                expanded_terms.append(alt_phrase)

    # Add acronym expansions
    if len(meaningful_tokens) == 1:
        t = meaningful_tokens[0]
        if t in ACRONYM_MAP:
            for phrase in ACRONYM_MAP[t]:
                if phrase not in expanded_terms:
                    expanded_terms.append(phrase)

    # Also check full topic in acronym map
    if norm_clean in ACRONYM_MAP:
        for phrase in ACRONYM_MAP[norm_clean]:
            if phrase not in expanded_terms:
                expanded_terms.append(phrase)

    if clean_topic in ACRONYM_MAP:
        for phrase in ACRONYM_MAP[clean_topic]:
            if phrase not in expanded_terms:
                expanded_terms.append(phrase)

    # Special common compounds (full phrases only):
    # "system call" -> "system calls", "syscall", "syscalls"
    if "system" in meaningful_tokens and ("call" in meaningful_tokens or "calls" in meaningful_tokens):
        expanded_terms.extend(["system call", "system calls", "syscall", "syscalls", "systemcall"])
    elif "deadlock" in meaningful_tokens or "deadlocks" in meaningful_tokens:
        expanded_terms.extend(["deadlock", "deadlocks", "deadlock avoidance", "deadlock prevention"])
    elif "two" in meaningful_tokens and "phase" in meaningful_tokens and "locking" in meaningful_tokens:
        expanded_terms.extend(["two phase locking", "2pl", "two-phase locking"])
    elif "banker" in meaningful_tokens:
        expanded_terms.extend(["banker", "bankers", "banker's algorithm"])
    elif "stop" in meaningful_tokens and "wait" in meaningful_tokens:
        expanded_terms.extend(["stop and wait", "stop-and-wait", "stop and wait arq"])
    elif "keyword" in meaningful_tokens and ("argument" in meaningful_tokens or "arguments" in meaningful_tokens):
        expanded_terms.extend(["keyword arguments", "keyword argument", "kwargs"])

    # Unique list while preserving order
    seen: Set[str] = set()
    unique_expansions: List[str] = []
    for exp in expanded_terms:
        exp_clean = exp.strip().lower()
        if exp_clean and exp_clean not in seen:
            seen.add(exp_clean)
            unique_expansions.append(exp_clean)

    return {
        "raw_query": raw,
        "clean_topic": clean_topic,
        "tokens": meaningful_tokens,
        "stemmed_tokens": stemmed_tokens,
        "expanded_terms": unique_expansions,
    }


def compute_chunk_relevance(
    query_info: dict,
    content: str,
    title: str,
    subject: Optional[str] = None,
    unit: Optional[str] = None,
) -> Tuple[float, bool]:
    """
    Calculates fuzzy relevance score of a material chunk against the parsed query.
    Returns: (score, has_strong_match)

    Strict anti-hallucination / anti-false-positive policy:
    A chunk is ONLY considered relevant and grounded if the actual content of the chunk
    genuinely supports and discusses the exact topic or its valid expansions.
    Never match an unrelated file simply because of a single common word or title overlap.
    """
    clean_topic = query_info["clean_topic"]
    tokens = [t for t in query_info["tokens"] if len(t) > 1]
    stemmed_tokens = [basic_stem(t) for t in tokens if len(t) > 1]
    expansions = query_info["expanded_terms"]

    norm_content = normalize_query_text(content)
    norm_title = normalize_query_text(title)

    if not norm_content and not norm_title:
        return 0.0, False

    # 1. Content Support Verification:
    # A chunk is ONLY a valid source if its content actually discusses the topic.
    # Check if exact topic or expansion phrase is found in content
    has_exact_phrase_in_content = any(exp in norm_content for exp in expansions if len(exp) > 2)

    # Check token presence in content
    content_words = set(norm_content.split())
    content_stems = set(basic_stem(w) for w in norm_content.split())

    matched_token_count = 0
    for t, st in zip(tokens, stemmed_tokens):
        if t in content_words or (len(st) > 2 and st in content_stems):
            matched_token_count += 1

    all_tokens_in_content = (matched_token_count == len(tokens) and len(tokens) > 0)

    # For single-token queries: token or stem must be present in content
    # For multi-token queries: exact phrase or ALL tokens must be present in content
    if len(tokens) <= 1:
        content_supports_topic = has_exact_phrase_in_content or (matched_token_count >= 1)
    else:
        content_supports_topic = has_exact_phrase_in_content or all_tokens_in_content

    # CRITICAL: If the chunk content does not support the topic, it CANNOT be a source!
    if not content_supports_topic:
        return 0.0, False

    # 2. Score Computation (only reached when content genuinely discusses the topic)
    score = 0.0
    matched_expansion = False

    if has_exact_phrase_in_content:
        score += 50.0
        matched_expansion = True

    if tokens:
        token_ratio = matched_token_count / len(tokens)
        score += token_ratio * 40.0

    # Title match bonus (reinforces relevance)
    title_words = set(norm_title.split())
    title_stems = set(basic_stem(w) for w in norm_title.split())
    title_token_matches = sum(1 for t, st in zip(tokens, stemmed_tokens) if t in title_words or st in title_stems)

    if any(exp in norm_title for exp in expansions if len(exp) > 2):
        score += 25.0
        matched_expansion = True
    elif tokens and title_token_matches >= min(2, len(tokens)):
        score += 20.0
        matched_expansion = True

    # Pattern matches in content (e.g. "what is <topic>", "definition of <topic>", headings)
    for exp in expansions[:4]:
        if len(exp) > 2:
            pattern = r"(what is|define|explain|topic:?|unit:?)\s+" + re.escape(exp)
            if re.search(pattern, norm_content):
                score += 20.0
                break

    # Subject & Unit bonus
    if subject and norm_title:
        norm_sub = normalize_query_text(subject)
        if norm_sub and norm_sub in norm_title:
            score += 10.0

    if unit and norm_title:
        norm_unit = normalize_query_text(unit)
        if norm_unit and norm_unit in norm_title:
            score += 10.0

    has_strong_match = (matched_expansion or all_tokens_in_content) and score >= 35.0

    return score, has_strong_match
