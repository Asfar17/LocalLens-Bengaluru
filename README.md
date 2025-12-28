# 🌆 LocalLens Bengaluru

**Version:** `v1.0.0`
**Status:** 🚀 Production Ready

![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 🧭 About the Project

**LocalLens Bengaluru** is a **context-aware AI-powered local guide** designed to help residents, newcomers, and tourists understand Bengaluru the way locals do.

Instead of generic answers, LocalLens uses **custom local context files** and **persona-aware AI steering** to deliver culturally relevant, location-sensitive, and practical responses.

🔗 **Live Demo:** [https://locallens-bengaluru.vercel.app/](https://locallens-bengaluru.vercel.app/)

---

## ✨ Key Features

* 🏙️ **Context-aware responses** powered by Bangalore-specific knowledge
* 👤 **Persona-based adaptation**

  * Newbie
  * Student
  * IT Professional
  * Tourist
* 🗣️ **Local slang interpretation** (voice & text)
* 🍛 **Location-aware street food recommendations**
* 🚗 **Traffic & commute guidance** based on time and area
* 🙏 **Cultural etiquette tips** for everyday interactions
* 🔄 **Dynamic context switching** without redeployment

---

## 🛠 Tech Stack

### Frontend

* **React 18**
* **Vite**
* **TypeScript**
* **CSS3 (Responsive UI)**

### Backend

* **Node.js (18+)**
* **Express**
* **TypeScript**

### Database

* **MongoDB Atlas**

### AI & External Services (Optional Enhancements)

* **OpenAI / OpenRouter** – AI responses
* **Google Cloud APIs**

  * Speech-to-Text
  * Vision OCR
  * Translation
  * Maps (Places API)

### Deployment

* **Vercel (Serverless Functions)**

---

## 🚀 Getting Started

### Prerequisites

* Node.js `18+`
* MongoDB (Local or Atlas)

---

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp server/.env.example server/.env

# Start development servers
npm run dev
```

---

### Environment Variables

Create `server/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/bangalore-assistant
```

---

## ☁️ Vercel Deployment

### Quick Deploy

1. Push the repository to GitHub
2. Import it in **Vercel** → [https://vercel.com/new](https://vercel.com/new)
3. Configure environment variables
4. Deploy 🚀

---

### Required & Optional Environment Variables

| Variable               | Required    | Description                     |
| ---------------------- | ----------- | ------------------------------- |
| `MONGODB_URI`          | ✅ Yes       | MongoDB Atlas connection string |
| `OPENAI_API_KEY`       | ⚠️ Optional | AI-powered responses            |
| `GOOGLE_CLOUD_API_KEY` | ⚠️ Optional | Speech, Vision, Translate       |
| `GOOGLE_MAPS_API_KEY`  | ⚠️ Optional | Places & location services      |
| `ALLOWED_ORIGINS`      | ⚠️ Optional | CORS control                    |
| `NODE_ENV`             | Auto        | Set by Vercel                   |

> ℹ️ The app **works even without AI APIs** using local context files.

---

## 🔐 API Key Setup

### MongoDB Atlas (Required)

1. Create a free cluster
2. Add DB user (read/write)
3. IP Access List → `0.0.0.0/0`
4. Copy connection string

```text
mongodb+srv://username:password@cluster.mongodb.net/bangalore-assistant
```

---

### OpenAI (Optional)

* Used for AI-powered conversational responses
* Billing required for quota access

---

### Google Cloud APIs (Optional)

Enable:

* Speech-to-Text
* Vision OCR
* Translation
* Maps (Places API)

🔒 **Always restrict API keys by service**

---

## 📦 Project Structure

```
├── api/             # Vercel serverless functions
│   └── index.ts
├── client/          # React frontend
│   └── src/
├── server/          # Express backend
│   └── src/
├── context/         # Local knowledge (Markdown)
│   ├── city.md
│   ├── slang.md
│   ├── food.md
│   ├── traffic.md
│   └── etiquette.md
├── vercel.json
└── package.json
```

---

## 🔌 API Endpoints

| Method | Endpoint                   | Description            |
| ------ | -------------------------- | ---------------------- |
| POST   | `/api/query`               | Submit user query      |
| GET    | `/api/contexts`            | List context files     |
| POST   | `/api/contexts/:id/toggle` | Enable/disable context |
| POST   | `/api/persona`             | Set user persona       |
| GET    | `/api/health`              | Health check           |

---

## 🧪 Troubleshooting

| Issue               | Fix                        |
| ------------------- | -------------------------- |
| DB connection error | Check MongoDB IP whitelist |
| CORS error          | Verify `ALLOWED_ORIGINS`   |
| AI not responding   | Check API keys in Vercel   |
| 503 error           | Check function logs        |

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 🙌 Acknowledgements

Built with ❤️ using **AWS Kiro**, showcasing the power of **context-driven AI development** and **human-AI collaboration**.

---
