# MediGuard 🛡️💊
> **"Verify Before You Swallow"** — An AI-powered medication verification dashboard that scans medicine packaging labels, extracts chemical salts/compositions via OCR, checks dangerous drug/substance interactions, and suggests bioequivalent cheaper alternatives.

---

## ✨ Features

- 📸 **Optical Character Recognition (OCR)**: Extracts text tokens from medicine boxes with multi-pass OpenCV contrast enhancement and EasyOCR.
- 🧬 **Salt & Composition Breakdown**: Disambiguates active chemical molecules, dosages, and inactive excipients.
- ⚠️ **Interaction & Risk Engine**: Highlights high/medium/low severity warnings when mixed with other drugs, alcohol, or foods.
- 💰 **Alternative & Savings Finder**: Compares generic vs. branded options with similarity scores and cost savings.
- 💬 **Interactive Clinical Assistant**: Integrated AI pharmacist chatbot for follow-up questions.
- 💾 **Local Persistence**: Stores past scans in SQLite (`mediguard.db`).

---

## 🛠️ Tech Stack

- **Backend**: FastAPI, Uvicorn, SQLite
- **OCR Engine**: EasyOCR, PyTorch, OpenCV
- **AI & Clinical Reasoning**: Groq LLMs (`openai/gpt-oss-20b`)
- **Frontend**: Vanilla HTML5, CSS3 (Dark Glassmorphic UI), JavaScript (ES6+)

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/aratrikaa/mediguard.git
cd mediguard
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure `.env`
Create a `.env` file in the root directory:
```env
GROQ_API_KEY=your_groq_api_key_here
```

### 4. Run the application
```bash
python -m uvicorn main:app --port 8000 --reload
```

Open your browser and navigate to:
```
http://127.0.0.1:8000
```
