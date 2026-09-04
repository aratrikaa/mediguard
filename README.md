# MediGuard 🛡️💊
> **"Verify Before You Swallow"** — An AI-powered medication verification dashboard that scans medicine packaging labels, extracts chemical salts/compositions via OCR, checks dangerous drug/substance interactions, and suggests bioequivalent cheaper alternatives.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://mediguard-rztd.onrender.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

🔗 **Live Application URL**: [https://mediguard-rztd.onrender.com](https://mediguard-rztd.onrender.com/)

---

## 📖 About MediGuard

**MediGuard** is a patient-first digital health utility designed to eliminate medication confusion, prevent adverse drug-drug interactions, and combat high healthcare costs. By combining **Optical Character Recognition (OCR)** with **Clinical AI reasoning (Groq)**, MediGuard allows patients to photograph any medication strip or box and instantly receive:
- **Active Chemical Molecules**: Clear disambiguation of active salts, dosages, and inactive excipients.
- **Real-time Interaction Warnings**: Multi-tier severity alerts for conflicting medications, food, and alcohol.
- **Bioequivalent Substitutes**: Generic and branded alternatives in Indian Rupees (₹) with up to 70% cost savings.
- **Clinical AI Pharmacist**: Built-in interactive clinical chatbot for continuous Q&A.

Try it live here 👉 **[mediguard-rztd.onrender.com](https://mediguard-rztd.onrender.com/)**

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

### 4. Run the application locally
```bash
python -m uvicorn main:app --port 8000 --reload
```

Open your browser and navigate to:
```
http://127.0.0.1:8000
```

---

## 🌐 Deploy to Render

### Option A: 1-Click / Blueprint Deployment (Recommended)
1. Push your latest code to your GitHub repository:
   ```bash
   git add .
   git commit -m "Add Render deployment config"
   git push origin main
   ```
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** → **Blueprint**.
3. Connect your `mediguard` repository.
4. Render will automatically detect `render.yaml` and configure the service as a Docker container.
5. In the **Environment Variables** prompt, enter your `GROQ_API_KEY`.
6. Click **Apply** to deploy!

### Option B: Manual Web Service on Render
1. In [Render Dashboard](https://dashboard.render.com/), click **New +** → **Web Service**.
2. Connect `https://github.com/aratrikaa/mediguard`.
3. Choose **Docker** environment (or **Python 3**).
   - If choosing **Docker**: Render uses the included [Dockerfile](file:///Dockerfile).
   - If choosing **Python 3**:
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Under **Environment Variables**, add:
   - `GROQ_API_KEY`: `<Your Groq API Key>`
5. Click **Deploy Web Service**.

