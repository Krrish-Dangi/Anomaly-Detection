# 🛡️ AI-Powered Smart Retail Surveillance System

An intelligent real-time surveillance dashboard built for retail environments. The system leverages AI to detect anomalies such as **shelf tampering**, **loitering**, and **suspicious behavior** — helping store managers respond faster and reduce losses.

> ⚠️ Currently running on **dummy data**. AI model and database integration coming soon.

---

## ✨ Features

- **📊 Dashboard** — Overview with live camera feeds, detection stats, and an activity trend chart
- **🎬 Video Analysis** — Upload surveillance footage from your PC for AI-powered analysis with detection overlays and live logs
- **📁 Event History** — Filter and browse past incidents by date, event type, camera, and confidence level with dynamic stats
- **⚙️ System Settings** — Fully functional settings panel including:
  - User profile editing
  - AI detection toggles (Suspicious Behavior, Loitering, Shelf Interaction)
  - Confidence threshold slider
  - Alert notification toggles (Desktop, Email, Sound)
  - Camera configuration (toggle Active/Inactive)
  - 🌗 **Dark / Light mode** toggle (persists across sessions)
  - Save settings with confirmation animation
- **🏠 Landing Page** — Modern homepage with hero section, features overview, demo preview, and auth modal

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework |
| **Vite** | Build tool & dev server |
| **React Router v7** | Client-side routing |
| **GSAP** | Smooth animations |
| **Vanilla CSS** | Styling with CSS variables for theming |

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- **Node.js** (v18 or higher) — [Download here](https://nodejs.org/)
- **Git** — [Download here](https://git-scm.com/)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Krrish-Dangi/Anomaly-Detection.git
   ```

2. **Navigate into the project folder**

   ```bash
   cd Anomaly-Detection
   ```

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Start the development server**

   ```bash
   npm run dev
   ```

5. **Open in your browser**

   The terminal will show a local URL (usually `http://localhost:5173`). Open it in your browser.

---

## 📂 Project Structure

```
Anomaly-Detection/
├── public/                  # Static assets
├── src/
│   ├── assets/              # Images (camera feeds, hero, etc.)
│   ├── components/          # Reusable UI components
│   │   ├── Navbar.jsx       # Navigation bar
│   │   ├── Hero.jsx         # Hero section
│   │   ├── Features.jsx     # Features showcase
│   │   ├── HowItWorks.jsx   # How It Works section
│   │   ├── DemoPreview.jsx  # Demo preview section
│   │   ├── Footer.jsx       # Footer
│   │   ├── AuthModal.jsx    # Login/Signup modal
│   │   └── DashboardLayout.jsx  # Dashboard sidebar & header layout
│   ├── context/
│   │   └── ThemeContext.jsx  # Dark/Light mode state management
│   ├── pages/
│   │   ├── LandingPage.jsx  # Homepage
│   │   ├── Dashboard.jsx    # Main dashboard
│   │   ├── VideoAnalysis.jsx # Video upload & analysis
│   │   ├── EventHistory.jsx # Incident history & filters
│   │   └── Settings.jsx     # System settings panel
│   ├── App.jsx              # Router setup
│   ├── main.jsx             # Entry point
│   └── index.css            # Global styles & CSS variables
├── package.json
├── vite.config.js
└── README.md
```

---

## 🗺️ Routes

| Path | Page |
|------|------|
| `/` | Landing Page |
| `/dashboard` | Main Dashboard |
| `/dashboard/video-analysis` | Video Analysis |
| `/dashboard/event-history` | Event History & Filters |
| `/dashboard/settings` | System Settings |

---

## 🔮 Upcoming

- [ ] AI model integration for real-time anomaly detection
- [ ] Database connection for persistent data
- [ ] User authentication (login / signup)
- [ ] Live camera feed streaming
- [ ] Export reports as PDF

---

## 📝 License

This project is for educational purposes as part of a DTI (Design Thinking & Innovation) project.

---
