import os
import json
import base64
import io
import sqlite3
from datetime import datetime
from PIL import Image
import numpy as np
import cv2
import easyocr
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from groq import Groq

# Load environment variables
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY not found in environment variables.")

# Primary LLM model
LLM_MODEL = "openai/gpt-oss-20b"

# Initialize Groq client
client = Groq(api_key=GROQ_API_KEY)

# Initialize EasyOCR reader on startup
print("Initializing EasyOCR neural engine...")
ocr_reader = easyocr.Reader(['en'], gpu=False)
print("EasyOCR neural engine ready!")

app = FastAPI(title="MediGuard API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Setup
DB_FILE = "mediguard.db"

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS medications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            active_ingredients TEXT,
            inactive_ingredients TEXT,
            alternatives TEXT,
            interactions TEXT,
            side_effects TEXT,
            scan_date TEXT,
            risk_level TEXT,
            extracted_tokens TEXT
        )
    """)
    conn.commit()
    conn.close()

init_db()

# Models
class SearchRequest(BaseModel):
    query: str

class ScanRequest(BaseModel):
    image: str  # Base64 string

class ChatRequest(BaseModel):
    message: str
    context: dict
    chat_history: list = []

def parse_llm_json(response_text: str) -> dict:
    """Cleans up markdown fences and parses JSON string safely."""
    cleaned = response_text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    
    first_idx = cleaned.find("{")
    last_idx = cleaned.rfind("}")
    if first_idx != -1 and last_idx != -1:
        cleaned = cleaned[first_idx:last_idx + 1]
        
    return json.loads(cleaned)

def calculate_risk(interactions: list) -> str:
    """Calculates risk level based on interactions severity and count."""
    has_high = any(str(i.get("severity", "")).upper() == "HIGH" for i in interactions)
    if has_high or len(interactions) > 2:
        return "high"
    elif len(interactions) > 0:
        return "medium"
    return "low"

import re

def ensure_inr_pricing(data: dict) -> dict:
    """Ensures all alternative prices are formatted in Indian Rupees (₹)."""
    alts = data.get("alternatives", [])
    for alt in alts:
        price = str(alt.get("price", "")).strip()
        if not price or price.upper() == "N/A":
            alt["price"] = "₹15 - ₹45"
            continue
        
        if "$" in price or "USD" in price.upper():
            nums = re.findall(r"\d+(?:\.\d+)?", price)
            if nums:
                try:
                    floats = [float(n) for n in nums]
                    if all(f < 25 for f in floats):
                        inr_vals = [max(10, int(round(f * 35))) for f in floats]
                        if len(inr_vals) >= 2:
                            alt["price"] = f"₹{inr_vals[0]} - ₹{inr_vals[1]}"
                        else:
                            alt["price"] = f"₹{inr_vals[0]}"
                    else:
                        alt["price"] = price.replace("$", "₹")
                except Exception:
                    alt["price"] = "₹20 - ₹50"
            else:
                alt["price"] = "₹20 - ₹50"
        elif "₹" not in price and "INR" not in price.upper() and "RS" not in price.upper():
            alt["price"] = f"₹{price}"
    return data

def save_medication_to_db(data: dict, tokens: list = None) -> dict:
    """Saves medication analysis data to local SQLite database."""
    data = ensure_inr_pricing(data)
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    interactions = data.get("interactions", [])
    risk = calculate_risk(interactions)
    scan_date = datetime.now().isoformat()
    tokens_json = json.dumps(tokens or [])
    
    cursor.execute("""
        INSERT INTO medications (
            name, description, active_ingredients, inactive_ingredients, 
            alternatives, interactions, side_effects, scan_date, risk_level, extracted_tokens
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("name", "Unknown Medicine"),
        data.get("description", ""),
        json.dumps(data.get("activeIngredients", data.get("active_ingredients", []))),
        json.dumps(data.get("inactiveIngredients", data.get("inactive_ingredients", []))),
        json.dumps(data.get("alternatives", [])),
        json.dumps(interactions),
        json.dumps(data.get("sideEffects", data.get("side_effects", []))),
        scan_date,
        risk,
        tokens_json
    ))
    conn.commit()
    inserted_id = cursor.lastrowid
    conn.close()
    
    data["id"] = inserted_id
    data["scan_date"] = scan_date
    data["risk_level"] = risk
    data["extractedTokens"] = tokens or []
    return data

def seed_db():
    dataset_file = "medications_dataset.json"
    if not os.path.exists(dataset_file):
        print(f"Dataset file {dataset_file} not found. Skipping seeding.")
        return
    
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # Seed each medication if not already present by name
        seeded_count = 0
        with open(dataset_file, "r", encoding="utf-8") as f:
            meds = json.load(f)
        for med in meds:
            name = med.get("name", "Unknown Medicine")
            cursor.execute("SELECT COUNT(*) FROM medications WHERE name = ?", (name,))
            if cursor.fetchone()[0] == 0:
                # Save to database (save_medication_to_db opens its own connection and inserts)
                save_medication_to_db(med, [name])
                seeded_count += 1
        conn.close()
        if seeded_count > 0:
            print(f"Successfully seeded {seeded_count} new medications.")
    except Exception as e:
        print("Error seeding database:", e)

seed_db()


def preprocess_image_for_ocr(image_np: np.ndarray) -> list:
    """Runs OCR on both original and contrast-enhanced variations to maximize token detection."""
    tokens = []
    
    # 1. OCR on original
    try:
        res1 = ocr_reader.readtext(image_np)
        for bbox, text, prob in res1:
            t = text.strip()
            if len(t) > 1 and t not in tokens:
                tokens.append(t)
    except Exception as e:
        print("Direct OCR pass error:", e)

    # 2. OCR on enhanced grayscale
    try:
        gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        res2 = ocr_reader.readtext(enhanced)
        for bbox, text, prob in res2:
            t = text.strip()
            if len(t) > 1 and t not in tokens:
                tokens.append(t)
    except Exception as e:
        print("Enhanced OCR pass error:", e)

    return tokens

@app.post("/api/search")
async def search_medication(req: SearchRequest):
    try:
        query_str = req.query.strip().lower()
        
        # 1. Try to find the medication in the local database first
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Match by name (case-insensitive substring) or active ingredients or extracted tokens
        cursor.execute("""
            SELECT * FROM medications 
            WHERE LOWER(name) LIKE ? 
               OR LOWER(active_ingredients) LIKE ? 
               OR LOWER(extracted_tokens) LIKE ?
            LIMIT 1
        """, (f"%{query_str}%", f"%{query_str}%", f"%{query_str}%"))
        
        row = cursor.fetchone()
        
        if row:
            print(f"Found match for query '{req.query}' in local database: {row['name']}")
            extracted_tokens = []
            if "extracted_tokens" in row.keys() and row["extracted_tokens"]:
                try:
                    extracted_tokens = json.loads(row["extracted_tokens"])
                except Exception:
                    pass
            
            data = {
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "activeIngredients": json.loads(row["active_ingredients"]),
                "inactiveIngredients": json.loads(row["inactive_ingredients"]),
                "alternatives": json.loads(row["alternatives"]),
                "interactions": json.loads(row["interactions"]),
                "sideEffects": json.loads(row["side_effects"]),
                "scan_date": row["scan_date"],
                "risk_level": row["risk_level"],
                "extractedTokens": extracted_tokens
            }
            conn.close()
            return data
            
        conn.close()
        print(f"Query '{req.query}' not found in local database. Fetching from Groq LLM API...")
        
        # 2. Fall back to Groq LLM if not found locally
        prompt = f"""
        You are a clinical pharmacist AI. Analyze the medication query '{req.query}'.
        Identify the exact active chemical molecule (salt), dosages, inactive excipients, brand/generic substitutes, drug interactions, and side effects.
        
        Return a strict, valid JSON object matching this schema:
        {{
            "name": "Full medicine brand name with dosage (e.g. Disprin 500mg)",
            "description": "Short clinical purpose & mechanism of action in plain English",
            "activeIngredients": [
                {{"name": "Active Chemical Molecule / Salt Name (e.g. Acetylsalicylic Acid)", "amount": "Dosage (e.g. 500mg)"}}
            ],
            "inactiveIngredients": ["Excipient 1", "Excipient 2", "Excipient 3"],
            "alternatives": [
                {{"name": "Substitute Name", "type": "generic or branded", "price": "Price range in Rupees (e.g. ₹20 - ₹45)", "availability": "High", "savings": "Percentage savings e.g. 45%", "similarityScore": 95}}
            ],
            "interactions": [
                {{"substance": "Substance / Drug Name", "severity": "HIGH or MEDIUM or LOW", "description": "Specific clinical risk"}}
            ],
            "sideEffects": [
                {{"name": "Side effect name", "frequency": "common or uncommon or rare"}}
            ]
        }}

        CRITICAL REQUIREMENT FOR PRICING:
        - Output all alternative prices in Indian Rupees using the '₹' symbol (e.g. '₹15 - ₹30' or '₹40 - ₹80').
        - NEVER use US Dollar signs ($).

        Do NOT return empty fields. Return ONLY the raw JSON object.
        """
        
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": "You are a professional clinical pharmacist and database expert. Always output complete, high-quality, strict JSON without markdown formatting."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
        )
        
        result_text = response.choices[0].message.content
        data = parse_llm_json(result_text)
        saved_data = save_medication_to_db(data, [req.query])
        return saved_data
    except Exception as e:
        print("Search error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scan")
async def scan_medication(req: ScanRequest):
    try:
        image_data = req.image
        if "," in image_data:
            image_data = image_data.split(",")[1]
            
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        image_np = np.array(image)

        # Run multi-pass OCR
        extracted_tokens = preprocess_image_for_ocr(image_np)
        print(f"Extracted {len(extracted_tokens)} tokens from uploaded image:", extracted_tokens)
        
        if not extracted_tokens:
            extracted_tokens = ["Medicine", "Pharmaceutical", "Tablet", "Capsule"]

        tokens_str = ", ".join([f'"{t}"' for t in extracted_tokens])
        
        prompt = f"""
        You are a clinical pharmacist AI. The following OCR text fragments were extracted from a medicine package/box photo:
        [{tokens_str}]

        YOUR TASK:
        1. Identify the actual medicine name, brand, and active chemical salt(s) from the tokens.
        2. Even if some tokens are blurry, noisy, or misspelled, infer the real medicine (e.g. 'Augmentin', 'Paracetamol', 'Disprin', 'Amoxicillin', 'Azithromycin', 'Crocin', etc.).
        3. Fill in the full medical breakdown: active salts, inactive binders, generic & branded alternatives with price/savings, dangerous drug interactions, and side effects.
        
        Return a strict JSON object with this exact schema:
        {{
            "name": "Identified Medicine Name & Dosage",
            "description": "Clinical purpose and mechanism in plain English",
            "activeIngredients": [
                {{"name": "Active Salt / Molecule Name", "amount": "Strength (e.g. 500mg)"}}
            ],
            "inactiveIngredients": ["Inactive Excipient 1", "Binder 2", "Coating 3"],
            "alternatives": [
                {{"name": "Alternative Name", "type": "generic or branded", "price": "₹20 - ₹50", "availability": "High", "savings": "50%", "similarityScore": 95}}
            ],
            "interactions": [
                {{"substance": "Drug / Substance", "severity": "HIGH or MEDIUM or LOW", "description": "Specific danger / precaution"}}
            ],
            "sideEffects": [
                {{"name": "Side effect name", "frequency": "common or uncommon or rare"}}
            ]
        }}

        CRITICAL REQUIREMENT FOR PRICING:
        - Output all alternative prices in Indian Rupees using the '₹' symbol (e.g. '₹20 - ₹40' or '₹50 - ₹120').
        - NEVER use US Dollar signs ($).

        Do NOT return empty fields. Return ONLY the raw JSON object.
        """
        
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": "You are a clinical pharmacist AI that interprets noisy OCR text from medicine boxes into structured medical JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
        )
        
        result_text = response.choices[0].message.content
        data = parse_llm_json(result_text)
        saved_data = save_medication_to_db(data, extracted_tokens)
        return saved_data
    except Exception as e:
        print("Scan error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat_assistant(req: ChatRequest):
    try:
        context_str = json.dumps(req.context, indent=2)
        
        messages = [
            {
                "role": "system", 
                "content": f"You are MediGuard Clinical Assistant, an expert pharmacist. You are discussing this medication:\n{context_str}\nProvide clear, helpful, and concise answers to the user's questions. Always remind them that you provide informational guidance, not formal clinical prescriptions."
            }
        ]
        
        # Add conversation history
        for msg in req.chat_history:
            messages.append({"role": msg.get("role"), "content": msg.get("content")})
            
        # Add user's latest query
        messages.append({"role": "user", "content": req.message})
        
        response = client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            temperature=0.5,
        )
        
        return {"response": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history")
async def get_history():
    try:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM medications ORDER BY scan_date DESC")
        rows = cursor.fetchall()
        
        history = []
        for r in rows:
            extracted_tokens = []
            if "extracted_tokens" in r.keys() and r["extracted_tokens"]:
                try:
                    extracted_tokens = json.loads(r["extracted_tokens"])
                except Exception:
                    pass
            history.append({
                "id": r["id"],
                "name": r["name"],
                "description": r["description"],
                "activeIngredients": json.loads(r["active_ingredients"]),
                "inactiveIngredients": json.loads(r["inactive_ingredients"]),
                "alternatives": json.loads(r["alternatives"]),
                "interactions": json.loads(r["interactions"]),
                "sideEffects": json.loads(r["side_effects"]),
                "scan_date": r["scan_date"],
                "risk_level": r["risk_level"],
                "extractedTokens": extracted_tokens
            })
        conn.close()
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/history/{id}")
async def delete_history_item(id: int):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM medications WHERE id = ?", (id,))
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Deleted item {id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Static files mount
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_root():
    try:
        with open("static/index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="<h1>MediGuard Dashboard: Static files not yet created. Check back in a moment!</h1>")
