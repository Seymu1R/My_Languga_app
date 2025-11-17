# Language Learning Application 🎓

AI-powered English learning application with translation, pronunciation, and vocabulary building features.

## 🚀 Quick Start

### Start the application (Recommended - with MongoDB)
```bash
./start.sh
```
This will automatically:
- Start MongoDB on port 27018
- Start backend server on port 7000
- Start frontend on port 5173
- All vocabulary data will be saved permanently

### Stop the application
```bash
./stop.sh
```
This will stop both the app and MongoDB cleanly.

### Alternative: Run without MongoDB
```bash
npm run dev
```
App will work with in-memory storage (data lost on restart).

## ✨ Features

✅ **AI Provider Selection**: OpenAI, Claude, Gemini, Cohere  
✅ **13 Language Support**: Azerbaijani, Turkish, Russian, Spanish, French, German, Chinese, Japanese, Arabic, Polish, Ukrainian, Italian, Portuguese  
✅ **AI Translation**: Click any word → get instant translation in your native language  
✅ **AI Pronunciation**: IPA format pronunciation (e.g., /əˈpɑːrt/ for "apart")  
✅ **Persistent Storage**: MongoDB integration for permanent vocabulary storage  
✅ **In-Memory Fallback**: Works without MongoDB if needed  
✅ **Interactive Reading**: Click words in AI-generated texts to add to dictionary  
✅ **5 Proficiency Levels**: Elementary to Advanced

## 📋 Technology Stack

- **Frontend**: React with TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js with Express.js and TypeScript
- **Database**: MongoDB (with in-memory fallback)
- **AI Integration**: OpenAI, Anthropic Claude, Google Gemini, Cohere

## 🎯 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository
2. Install all dependencies:
   ```bash
   npm run install:all
   ```

### Development

Run both frontend and backend in development mode:
```bash
npm run dev
```

This will start:
- Frontend on http://localhost:5173
- Backend on http://localhost:3001

### Individual Services

Run only frontend:
```bash
npm run dev:frontend
```

Run only backend:
```bash
npm run dev:backend
```

### Production Build

Build the frontend for production:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## Project Structure

```
language-learning-app/
├── frontend/          # React TypeScript app
├── backend/           # Express.js TypeScript server
├── package.json       # Root package configuration
└── README.md          # This file
```

## Usage

1. Enter your AI API token using the "Add AI Token" button
2. Select your English proficiency level
3. Generate text appropriate for your level
4. Click on unknown words to add them to your dictionary
5. View your saved words in the "My Dictionary" section