# 👁️ GhostEye

### Privacy-Focused Visual Perception for Lightweight Browser Agents

GhostEye is an AI-powered browser extension designed to understand what is visible on a webpage while keeping user privacy in mind.

It captures the visible browser screen, analyzes the visual content using Gemini, identifies UI elements, text, objects, and potentially sensitive information, and returns structured information that can later be used by a browser agent to perform automated actions.

The project is designed around the concept of **privacy-preserving browser agents**, where sensitive information can be detected and redacted before visual context is shared with a remote AI service.

---

## 🚀 Key Features

- 📸 **Browser Screenshot Capture**
  - Captures the currently visible Chrome tab.

- 👁️ **AI Visual Understanding**
  - Uses Gemini to analyze screenshots.
  - Identifies webpages, photographs, wallpapers, documents, and other visual content.

- 🧩 **UI Element Detection**
  - Detects buttons, input fields, links, menus, checkboxes, tabs, and other UI elements.

- 📝 **Text Detection**
  - Extracts clearly visible text from screenshots.

- 🔴 **Sensitive Information Detection**
  - Identifies potentially sensitive information such as:
    - Names
    - Email addresses
    - Phone numbers
    - Passwords
    - Bank account numbers
    - UPI IDs
    - Transaction IDs
    - API keys
    - Faces
    - Identification numbers
    - Private URLs

- 📦 **Structured JSON Output**
  - Returns machine-readable information containing:
    - Image type
    - Detailed description
    - UI elements
    - Objects
    - Visible text
    - Sensitive regions
    - Bounding boxes
    - Confidence scores

- 🖼️ **Visual Bounding Boxes**
  - UI elements can be highlighted with bounding boxes.
  - Sensitive regions can be highlighted separately.

- 📄 **Dataset Annotation**
  - Generates JSON annotations that can be used later for ML dataset creation and evaluation.

---

# 🏗️ Architecture


                  ┌───────────────────┐
                  │    Chrome Tab     │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ GhostEye          │
                  │ Chrome Extension  │
                  └─────────┬─────────┘
                            │
                      Screenshot
                            │
                            ▼
                  ┌───────────────────┐
                  │ Local FastAPI     │
                  │ Server            │
                  │ localhost:8000    │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ ghosteye_api.py   │
                  │                   │
                  │ Gemini Vision     │
                  └─────────┬─────────┘
                            │
                            ▼
                   Structured JSON
                            │
            ┌───────────────┼────────────────┐
            ▼               ▼                ▼
       UI Elements       Objects       Sensitive Data
       + Bounding Box   + Bounding Box    + Bounding Box

🔐 Privacy Architecture

The planned privacy-preserving architecture is:

            Browser Screenshot
                    │
                    ▼
          Local Visual Processing
                    │
                    ▼
           Sensitive Data Detection
                    │
                    ▼
             Local Redaction
                    │
                    ▼
            Sanitized Screenshot
                    │
                    ▼
                Gemini / VLM
                    │
                    ▼
             Agentic Reasoning
                    │
                    ▼
              Browser Action

📁 Project Structure
C:\Riaz
│
├── ghosteye_api.py
├── server.py
├── requirements.txt
├── test.png
├── test_annotation.json
│
└── ghosteye_browser_extension
    │
    ├── manifest.json
    ├── popup.html
    ├── popup.css
    └── popup.js
