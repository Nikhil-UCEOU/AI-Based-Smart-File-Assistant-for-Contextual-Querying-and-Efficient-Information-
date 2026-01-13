# 🚀 AI-Powered Document Processing & Authentication System

A comprehensive full-stack application that combines secure user authentication with advanced AI-powered document processing capabilities. Built with React, TypeScript, Node.js, and integrated with OpenAI and Pinecone for intelligent document analysis and retrieval.

## ✨ Features

### 🔐 Authentication & User Management
- **Secure JWT Authentication** with refresh token support
- **Password Reset** via email with secure token validation
- **Profile Management** with dynamic profile picture upload
- **Real-time Profile Updates** across the application
- **Professional Dashboard** with comprehensive metrics and activity tracking

### 📄 Document Processing
- **Multi-format Support** - PDF, DOCX, TXT, and more
- **AI-Powered Analysis** using OpenAI GPT models
- **Vector Search** with Pinecone integration for semantic document retrieval
- **Batch Upload Processing** with progress tracking
- **Document Chunking** and embedding optimization
- **Advanced Chat Interface** for document Q&A

### 📊 Dashboard & Analytics
- **Real-time Activity Feed** with automatic updates
- **Processing Metrics** and performance analytics
- **Quick Actions Grid** for common tasks
- **Responsive Design** with animated UI components
- **Professional Layout** with modern glassmorphism effects

### 🛡️ Security & Performance
- **Rate Limiting** and security headers
- **Input Validation** and sanitization
- **File Upload Security** with type validation
- **Database Optimization** with proper indexing
- **Error Handling** and logging
- **CORS Configuration** for secure cross-origin requests

## 🏗️ Architecture

### Frontend (React + TypeScript)
```
src/
├── components/          # Reusable UI components
│   ├── dashboard/      # Dashboard-specific components
│   ├── profile/        # Profile management components
│   └── ui/            # Generic UI components
├── contexts/           # React contexts (Auth, etc.)
├── hooks/             # Custom React hooks
├── pages/             # Page components
├── services/          # API service layers
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
```

### Backend (Node.js + Express)
```
server/
├── controllers/        # Request handlers
├── models/            # Database models
├── routes/            # API route definitions
├── services/          # Business logic services
├── middleware/        # Custom middleware
├── config/            # Configuration files
├── scripts/           # Database scripts
└── uploads/           # File upload storage
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **OpenAI API Key**
- **Pinecone API Key**
- **SMTP Server** (for email functionality)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd auth-system
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   npm install
   
   # Install backend dependencies
   cd server
   npm install
   cd ..
   ```

3. **Environment Configuration**
   
   **Frontend** - Create `auth-system/.env`:
   ```env
   VITE_API_URL=http://localhost:3001
   ```
   
   **Backend** - Create `auth-system/server/.env`:
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRES_IN=24h
   JWT_REFRESH_EXPIRES_IN=7d
   
   # Database Configuration
   DB_PATH=./database/auth.db
   
   # File Upload Configuration
   UPLOAD_DIR=./uploads
   MAX_FILE_SIZE=5242880
   
   # CORS Configuration
   FRONTEND_URL=http://localhost:5173
   
   # OpenAI Configuration
   OPENAI_API_KEY=your-openai-api-key
   
   # Pinecone Configuration
   PINECONE_API_KEY=your-pinecone-api-key
   PINECONE_ENVIRONMENT=your-pinecone-environment
   PINECONE_INDEX_NAME=your-index-name
   
   # SMTP Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   FROM_EMAIL=your-email@gmail.com
   FROM_NAME=Auth System
   ```

4. **Database Setup**
   ```bash
   cd server
   
   # Create database tables
   node scripts/create-users-table.js
   node scripts/create-documents-table.js
   node scripts/create-activities-table.js
   node scripts/add-profile-fields.js
   
   # Seed sample data (optional)
   node scripts/seed-activities.js
   ```

5. **Start the Application**
   ```bash
   # Start both frontend and backend
   npm run start:all
   
   # Or start separately:
   # Backend: npm run server:dev
   # Frontend: npm run dev
   ```

6. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Profile Management
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update user profile
- `POST /api/profile/picture` - Upload profile picture
- `DELETE /api/profile/picture` - Remove profile picture

### Document Processing
- `POST /api/documents/upload` - Upload documents
- `GET /api/documents` - Get user documents
- `DELETE /api/documents/:id` - Delete document
- `POST /api/documents/search` - Search documents

### Activity Tracking
- `GET /api/activity` - Get user activities
- `GET /api/activity/stats` - Get activity statistics

### Chat Interface
- `POST /api/chat` - Send chat message
- `GET /api/chat/history` - Get chat history

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Styled Components** - CSS-in-JS styling
- **React Router** - Client-side routing
- **Vite** - Fast build tool and dev server

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **SQLite3** - Lightweight database
- **JWT** - JSON Web Tokens for authentication
- **Multer** - File upload handling
- **Bcrypt** - Password hashing

### AI & Vector Database
- **OpenAI GPT** - Language model for document analysis
- **Pinecone** - Vector database for semantic search
- **LangChain** - AI application framework
- **PDF-Parse** - PDF text extraction
- **Mammoth** - DOCX processing

### Development Tools
- **ESLint** - Code linting
- **Jest** - Testing framework
- **Nodemon** - Development server
- **Concurrently** - Run multiple commands

## 🧪 Testing

```bash
# Run backend tests
cd server
npm test

# Run tests in watch mode
npm run test:watch
```

## 📁 Project Structure

```
auth-system/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom hooks
│   ├── pages/             # Page components
│   ├── services/          # API services
│   ├── types/             # TypeScript types
│   └── utils/             # Utility functions
├── server/                 # Backend source code
│   ├── controllers/       # Route controllers
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   ├── middleware/       # Express middleware
│   ├── config/           # Configuration
│   ├── scripts/          # Database scripts
│   └── uploads/          # File storage
├── public/                # Static assets
├── dist/                  # Build output
└── docs/                  # Documentation
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Secret key for JWT tokens | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `PINECONE_API_KEY` | Pinecone API key | Yes |
| `SMTP_USER` | Email service username | Yes |
| `SMTP_PASS` | Email service password | Yes |
| `DB_PATH` | SQLite database path | No |
| `PORT` | Server port | No |

### Database Schema

The application uses SQLite with the following main tables:
- **users** - User accounts and profiles
- **documents** - Uploaded document metadata
- **activities** - User activity tracking
- **chats** - Chat conversation history

## 🚀 Deployment

### Production Build
```bash
# Build frontend
npm run build

# Start production server
cd server
npm start
```

### Docker Deployment
```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write tests for new features
- Use conventional commit messages
- Ensure code passes ESLint checks
- Update documentation as needed

## 👥 Collaborators

- **Eruva Akhil** - Lead Developer
  - Email: eruvaakku25@gmail.com
  - GitHub: [Akhil-811](https://github.com/Akhil-811)

- **Eruva Nikhil** - Full Stack Developer
  - Email: eruvaniku@gmail.com
  - GitHub: [Nikhil-UCEOU](https://github.com/Nikhil-UCEOU)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](../../issues) page
2. Create a new issue with detailed information
3. Contact the development team

## 🔄 Changelog

### Version 1.0.0
- Initial release with authentication system
- Document upload and processing
- AI-powered chat interface
- Professional dashboard design
- Profile management system
- Activity tracking and analytics

---

**Built with ❤️ by the Eruva Development Team**