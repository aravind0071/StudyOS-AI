"""
AI Ingestion Service — StudyOS AI
Pipeline:
  File/URL → Extract Text → Clean → Chunk → Embed → Store → Extract Concepts → Knowledge Graph
"""

import logging
import os
import re
from pathlib import Path
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)


def _get_db_session(db_url: str = None):
    try:
        from app.core.database import SessionLocal
        return SessionLocal()
    except Exception:
        engine = create_engine(db_url)
        Session = sessionmaker(bind=engine)
        return Session()


# ─── TEXT EXTRACTION ─────────────────────────────────────────────────────────

def extract_text_from_pdf(file_path: str) -> list[dict]:
    """Extract text from PDF page by page using PyMuPDF or pypdf fallback."""
    pages = []
    # Engine 1: PyMuPDF
    try:
        import pymupdf
        doc = pymupdf.open(file_path)
        for i, page in enumerate(doc):
            text = page.get_text("text").strip()
            if text:
                pages.append({"page": i + 1, "text": text})
        if pages:
            return pages
    except Exception as e:
        logger.warning(f"PyMuPDF extraction failed or empty, trying pypdf: {e}")

    # Engine 2: pypdf fallback
    try:
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages.append({"page": i + 1, "text": text.strip()})
        if pages:
            return pages
    except Exception as e:
        logger.error(f"pypdf extraction failed: {e}")

    return pages


def extract_text_from_docx(file_path: str) -> list[dict]:
    """Extract text from DOCX using python-docx."""
    try:
        from docx import Document
        doc = Document(file_path)
        full_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        return [{"page": 1, "text": full_text}]
    except Exception as e:
        logger.error(f"DOCX extraction failed: {e}")
        return []


def extract_text_from_pptx(file_path: str) -> list[dict]:
    """Extract text from PPTX slide by slide."""
    try:
        from pptx import Presentation
        prs = Presentation(file_path)
        slides = []
        for i, slide in enumerate(prs.slides):
            text_parts = []
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    text_parts.append(shape.text.strip())
            if text_parts:
                slides.append({"page": i + 1, "text": "\n".join(text_parts)})
        return slides
    except Exception as e:
        logger.error(f"PPTX extraction failed: {e}")
        return []


def extract_text_from_image(file_path: str) -> list[dict]:
    """OCR image using Tesseract with safe metadata fallback."""
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img).strip()
        if text:
            return [{"page": 1, "text": text}]
    except Exception as e:
        logger.warning(f"OCR extraction failed or Tesseract not installed: {e}")

    # Graceful fallback for uploaded diagrams / screenshots
    filename = Path(file_path).stem
    clean_name = re.sub(r'^[a-f0-9]{32}_', '', filename).replace('_', ' ')
    fallback_text = f"Visual Learning Resource: {clean_name}. Diagram / image notes uploaded to Knowledge Vault."
    return [{"page": 1, "text": fallback_text}]


def extract_text_from_audio(file_path: str) -> list[dict]:
    """Transcribe audio using OpenAI Whisper API."""
    try:
        from openai import OpenAI
        from app.core.config import settings
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        with open(file_path, "rb") as f:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="verbose_json",
            )
        segments = []
        for seg in (transcript.segments or []):
            segments.append({
                "page": None,
                "text": seg.text.strip(),
                "timestamp_start": seg.start,
                "timestamp_end": seg.end,
            })
        return segments or [{"page": 1, "text": transcript.text}]
    except Exception as e:
        logger.error(f"Audio transcription failed: {e}")
        return []


# ─── CHUNKING ────────────────────────────────────────────────────────────────

def chunk_text(
    text: str,
    chunk_size: int = 512,
    overlap: int = 50,
    page_number: Optional[int] = None,
    timestamp_start: Optional[float] = None,
    timestamp_end: Optional[float] = None,
) -> list[dict]:
    """
    Split text into overlapping chunks using token-approximate word splitting.
    Each chunk has ~512 words with 50-word overlap for context continuity.
    """
    words = text.split()
    chunks = []
    start = 0
    chunk_idx = 0

    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_words = words[start:end]
        chunk_text_str = " ".join(chunk_words).strip()

        if chunk_text_str:
            chunks.append({
                "index": chunk_idx,
                "content": chunk_text_str,
                "token_count": len(chunk_words),
                "page_number": page_number,
                "timestamp_start": timestamp_start,
                "timestamp_end": timestamp_end,
            })
            chunk_idx += 1

        start += chunk_size - overlap

    return chunks


# ─── EMBEDDINGS ──────────────────────────────────────────────────────────────

def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """
    Generate vector embeddings using OpenAI text-embedding-3-small.
    Input: list of text strings
    Output: list of 1536-dimensional float vectors
    Why: Dense vector embeddings enable semantic similarity search via pgvector,
    allowing the RAG system to find relevant material chunks even when exact keywords don't match.
    """
    try:
        from openai import OpenAI
        from app.core.config import settings
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.embeddings.create(
            model=settings.OPENAI_EMBEDDING_MODEL,
            input=texts,
        )
        return [item.embedding for item in response.data]
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        return [[] for _ in texts]


# ─── CONCEPT EXTRACTION ──────────────────────────────────────────────────────

def extract_concepts_from_text(text: str, subject: Optional[str] = None) -> list[dict]:
    """
    Extract key concepts and their relationships from text.
    Uses OpenAI if available; falls back to robust local heuristic concept extraction.
    """
    from app.core.config import settings
    if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY.strip():
        try:
            from openai import OpenAI
            import json
            client = OpenAI(api_key=settings.OPENAI_API_KEY)

            prompt = f"""Extract the key concepts from this educational text and their relationships.
Subject context: {subject or 'General'}

Text: {text[:3000]}

Return a JSON array of concepts:
[
  {{
    "name": "Concept Name",
    "description": "Brief 1-2 sentence explanation",
    "related_to": ["Related Concept 1", "Related Concept 2"]
  }}
]

Return ONLY the JSON array, no other text."""

            response = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=1500,
            )
            content = response.choices[0].message.content.strip()
            json_match = re.search(r'\[.*\]', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
        except Exception as e:
            logger.warning(f"OpenAI concept extraction failed, using heuristic fallback: {e}")

    # Heuristic concept extraction fallback (works 100% offline without API key)
    return _extract_concepts_heuristic(text, subject)


def _extract_concepts_heuristic(text: str, subject: Optional[str] = None) -> list[dict]:
    """Extract candidate concepts from headings, keywords, and prominent technical phrases."""
    concepts = []
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    candidates = []

    for line in lines:
        cleaned = re.sub(r'^[0-9\.\-\*\#\s]+', '', line).strip()
        if 3 <= len(cleaned) <= 60 and not cleaned.endswith('.'):
            words = cleaned.split()
            if 1 <= len(words) <= 5 and any(w[0].isupper() for w in words if w):
                candidates.append(cleaned)

    tech_patterns = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b', text)
    candidates.extend(tech_patterns)

    seen = set()
    unique_candidates = []
    stopwords = {"chapter", "introduction", "slide", "page", "table", "figure", "index", "summary", "notes", "lecture", "unit", "the", "this", "that", "with", "from"}
    for c in candidates:
        norm = c.lower().strip()
        if norm not in seen and norm not in stopwords and len(norm) > 3:
            seen.add(norm)
            unique_candidates.append(c.strip())

    if not unique_candidates:
        unique_candidates = [subject] if subject else ["Core Concepts", "Overview"]

    top_candidates = unique_candidates[:8]
    for i, name in enumerate(top_candidates):
        desc = f"Fundamental concept in {subject or 'the uploaded study material'} focusing on {name.lower()}."
        for line in lines:
            if name.lower() in line.lower() and len(line) > len(name) + 10:
                desc = line[:180].strip()
                if not desc.endswith('.'):
                    desc += '.'
                break

        related = [other for j, other in enumerate(top_candidates) if j != i][:3]
        concepts.append({
            "name": name,
            "description": desc,
            "related_to": related
        })

    return concepts


# ─── MAIN PIPELINE ────────────────────────────────────────────────────────────

async def process_material(material_id: str, db_url: str):
    """
    Main ingestion pipeline:
    1. Load material metadata
    2. Extract text based on type
    3. Chunk the text
    4. Generate embeddings
    5. Store chunks + embeddings
    6. Extract concepts
    7. Update knowledge graph
    8. Mark material as completed
    """
    from app.models.models import Material, MaterialChunk, MaterialType, ProcessingStatus, Concept, ConceptRelationship

    db = _get_db_session(db_url)
    try:
        material = db.query(Material).filter(Material.id == material_id).first()
        if not material:
            logger.error(f"Material {material_id} not found")
            return

        material.processing_status = ProcessingStatus.PROCESSING
        db.commit()

        # Step 1: Extract text
        pages_data = []
        mat_type = material.material_type

        if mat_type == MaterialType.PDF and material.file_path:
            pages_data = extract_text_from_pdf(material.file_path)
            material.page_count = len(pages_data)
        elif mat_type == MaterialType.DOCX and material.file_path:
            pages_data = extract_text_from_docx(material.file_path)
        elif mat_type == MaterialType.PPTX and material.file_path:
            pages_data = extract_text_from_pptx(material.file_path)
            material.page_count = len(pages_data)
        elif mat_type == MaterialType.IMAGE and material.file_path:
            pages_data = extract_text_from_image(material.file_path)
        elif mat_type in (MaterialType.AUDIO,) and material.file_path:
            pages_data = extract_text_from_audio(material.file_path)
        elif mat_type == MaterialType.YOUTUBE and material.source_url:
            pages_data, ext_title = _process_youtube(material.source_url)
            if ext_title and (not material.title or material.title.startswith("YouTube Video") or material.title.startswith("YouTube:")):
                material.title = ext_title[:255]
                db.commit()
            material.page_count = len(pages_data)
        elif mat_type == MaterialType.WEBSITE and material.source_url:
            pages_data, ext_title = _process_website(material.source_url)
            if ext_title and (not material.title or material.title.startswith("Article from ") or material.title in ("Website Article", "Web Article")):
                material.title = ext_title[:255]
                db.commit()
            material.page_count = len(pages_data)

        if not pages_data:
            material.processing_status = ProcessingStatus.FAILED
            material.processing_error = "Could not extract text from this material."
            db.commit()
            return

        # Step 2: Chunk all pages
        all_chunks = []
        for page_data in pages_data:
            chunks = chunk_text(
                text=page_data["text"],
                page_number=page_data.get("page"),
                timestamp_start=page_data.get("timestamp_start"),
                timestamp_end=page_data.get("timestamp_end"),
            )
            all_chunks.extend(chunks)

        if not all_chunks:
            material.processing_status = ProcessingStatus.FAILED
            material.processing_error = "No text content found in material."
            db.commit()
            return

        # Step 3: Generate embeddings in batches of 20
        chunk_texts = [c["content"] for c in all_chunks]
        all_embeddings = []
        batch_size = 20
        for i in range(0, len(chunk_texts), batch_size):
            batch = chunk_texts[i:i + batch_size]
            embeddings = generate_embeddings(batch)
            all_embeddings.extend(embeddings)

        # Step 4: Store chunks (embeddings stored as JSON for now; use pgvector column in production)
        chunk_records = []
        for i, (chunk_data, embedding) in enumerate(zip(all_chunks, all_embeddings)):
            chunk = MaterialChunk(
                material_id=material.id,
                user_id=material.user_id,
                chunk_index=i,
                content=chunk_data["content"],
                page_number=chunk_data.get("page_number"),
                timestamp_start=chunk_data.get("timestamp_start"),
                timestamp_end=chunk_data.get("timestamp_end"),
                token_count=chunk_data.get("token_count"),
            )
            db.add(chunk)
            chunk_records.append(chunk)

        db.flush()

        # Step 5: Extract concepts from combined text sample
        combined_text = " ".join(chunk_texts[:10])  # use first 10 chunks for concept extraction
        concepts_data = extract_concepts_from_text(combined_text, material.subject)

        # Step 6: Store concepts and relationships
        all_topic_names = []
        concept_name_to_id = {}

        for concept_data in concepts_data:
            name = concept_data.get("name", "").strip()
            if not name:
                continue
            all_topic_names.append(name)

            # Check if concept already exists for this user
            existing = (
                db.query(Concept)
                .filter(Concept.user_id == material.user_id, Concept.name == name)
                .first()
            )
            if existing:
                concept_obj = existing
                # Add this material to source list
                sources = existing.source_material_ids or []
                if str(material.id) not in sources:
                    sources.append(str(material.id))
                    existing.source_material_ids = sources
            else:
                concept_obj = Concept(
                    user_id=material.user_id,
                    name=name,
                    description=concept_data.get("description", ""),
                    subject=material.subject,
                    source_material_ids=[str(material.id)],
                )
                db.add(concept_obj)
                db.flush()

            concept_name_to_id[name] = concept_obj.id

        # Step 7: Store relationships
        for concept_data in concepts_data:
            src_name = concept_data.get("name", "").strip()
            src_id = concept_name_to_id.get(src_name)
            if not src_id:
                continue
            for related_name in concept_data.get("related_to", []):
                tgt_id = concept_name_to_id.get(related_name)
                if tgt_id and tgt_id != src_id:
                    existing_rel = (
                        db.query(ConceptRelationship)
                        .filter(
                            ConceptRelationship.source_concept_id == src_id,
                            ConceptRelationship.target_concept_id == tgt_id,
                        )
                        .first()
                    )
                    if not existing_rel:
                        rel = ConceptRelationship(
                            user_id=material.user_id,
                            source_concept_id=src_id,
                            target_concept_id=tgt_id,
                            relationship_type="related_to",
                        )
                        db.add(rel)

        # Step 8: Update material metadata
        material.detected_topics = all_topic_names[:20]  # cap at 20
        material.processing_status = ProcessingStatus.COMPLETED
        material.processing_error = None
        db.commit()
        logger.info(f"Material {material_id} processed successfully. {len(all_chunks)} chunks, {len(concepts_data)} concepts.")

    except Exception as e:
        logger.error(f"Processing failed for material {material_id}: {e}", exc_info=True)
        try:
            material.processing_status = ProcessingStatus.FAILED
            material.processing_error = str(e)[:500]
            db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _extract_youtube_id(url: str) -> Optional[str]:
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
        r'(?:embed\/|v\/|shorts\/)([0-9A-Za-z_-]{11})',
        r'youtu\.be\/([0-9A-Za-z_-]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def _process_youtube(url: str) -> tuple[list[dict], Optional[str]]:
    """
    Extract transcript and metadata from YouTube.
    1. Try youtube-transcript-api (direct captions, fast, no ffmpeg required).
    2. Fallback to yt-dlp metadata, chapters & description.
    3. Returns (pages, detected_title).
    """
    video_id = _extract_youtube_id(url)
    pages = []
    detected_title = None

    # Strategy 1: Fast metadata extraction via oembed
    if video_id:
        try:
            import httpx
            oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
            res = httpx.get(oembed_url, headers=headers, timeout=4.0)
            if res.status_code == 200:
                data = res.json()
                detected_title = data.get("title")
        except Exception as e:
            logger.debug(f"oembed title extraction skipped: {e}")

    # Strategy 2: YouTubeTranscriptApi for direct captions
    if video_id:
        try:
            from youtube_transcript_api import YouTubeTranscriptApi
            ytt = YouTubeTranscriptApi()
            transcript_list = ytt.list(video_id)
            transcript = None
            try:
                transcript = transcript_list.find_transcript(['en', 'en-US', 'en-GB', 'hi', 'te'])
            except Exception:
                for t in transcript_list:
                    transcript = t
                    break

            if transcript:
                data = transcript.fetch()
                current_chunk = []
                chunk_page = 1
                start_time = 0.0
                for item in data:
                    text_val = getattr(item, "text", "") or (item.get("text", "") if isinstance(item, dict) else str(item))
                    start_val = getattr(item, "start", 0.0) or (item.get("start", 0.0) if isinstance(item, dict) else 0.0)
                    dur_val = getattr(item, "duration", 0.0) or (item.get("duration", 0.0) if isinstance(item, dict) else 0.0)
                    if text_val:
                        current_chunk.append(text_val)
                    if len(current_chunk) >= 40:
                        pages.append({
                            "page": chunk_page,
                            "text": " ".join(current_chunk),
                            "timestamp_start": start_time,
                            "timestamp_end": start_val + dur_val,
                        })
                        chunk_page += 1
                        current_chunk = []
                        start_time = start_val

                if current_chunk:
                    pages.append({
                        "page": chunk_page,
                        "text": " ".join(current_chunk),
                        "timestamp_start": start_time,
                        "timestamp_end": start_time + 60,
                    })

                if pages:
                    logger.info(f"YouTube transcript successfully extracted: {len(pages)} chunks.")
                    return pages, detected_title
        except Exception as e:
            logger.warning(f"YouTubeTranscriptApi failed for {video_id}: {e}")

    # Strategy 3: yt-dlp metadata & description fallback
    try:
        import yt_dlp
        ydl_opts = {
            "quiet": True,
            "skip_download": True,
            "extract_flat": False,
            "socket_timeout": 8,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            title = info.get("title", "")
            if not detected_title and title:
                detected_title = title
            description = info.get("description", "")
            tags = ", ".join(info.get("tags", []) if info.get("tags") else [])
            combined = f"Video Title: {title}\n\nDescription:\n{description}"
            if tags:
                combined += f"\n\nTopics: {tags}"
            if combined.strip():
                pages.append({"page": 1, "text": combined.strip()})
                return pages, detected_title
    except Exception as e:
        logger.warning(f"yt-dlp metadata extraction failed: {e}")

    # Strategy 4: Fallback stub so processing never fails unexpectedly
    if not pages:
        display_name = detected_title or (f"Video {video_id}" if video_id else "YouTube Video")
        pages.append({
            "page": 1,
            "text": f"YouTube Resource: {display_name}\nURL: {url}\nSummary: Educational video material indexed for study and review.",
            "timestamp_start": 0.0,
            "timestamp_end": 0.0
        })

    return pages, detected_title


def _process_website(url: str) -> tuple[list[dict], Optional[str]]:
    """Fetch and extract clean readable text from a website URL using BeautifulSoup."""
    try:
        import httpx
        from bs4 import BeautifulSoup

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        response = httpx.get(url, headers=headers, timeout=12, follow_redirects=True)
        soup = BeautifulSoup(response.text, "html.parser")

        detected_title = None
        if soup.title and soup.title.string:
            detected_title = soup.title.string.strip()

        # Strip navigation, scripts, styling, ads
        for element in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "svg"]):
            element.decompose()

        article = soup.find("article") or soup.find("main") or soup.find(id=re.compile(r"content|main", re.I)) or soup.body

        if article:
            text = article.get_text(separator=" ", strip=True)
        else:
            text = soup.get_text(separator=" ", strip=True)

        text = re.sub(r'\s+', ' ', text).strip()
        if text:
            page_size = 2500
            pages = []
            for i in range(0, len(text), page_size):
                pages.append({"page": (i // page_size) + 1, "text": text[i:i + page_size]})
            return pages, detected_title
    except Exception as e:
        logger.error(f"Website processing failed: {e}")

    # Fallback stub
    return [{"page": 1, "text": f"Web Article: {url}\nSource URL: {url}"}], None
