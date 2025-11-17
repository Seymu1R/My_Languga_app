# MongoDB Setup Instructions

## Starting MongoDB

To use the dictionary feature, you need to start MongoDB:

```bash
# Option 1: Start MongoDB as a service (Linux)
sudo systemctl start mongod
sudo systemctl enable mongod  # Auto-start on boot

# Option 2: Start MongoDB manually
mongod --dbpath /path/to/your/data/directory

# Option 3: Use MongoDB in Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

## Verify MongoDB is Running

```bash
# Check if MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Should output: { ok: 1 }
```

## Configuration

MongoDB connection string is configured in `.env`:
```
MONGODB_URI=mongodb://localhost:27017/language_learning
```

## Database Structure

**Collection:** `words`
- `_id`: MongoDB ObjectId (auto-generated)
- `english`: String (required, indexed)
- `translation`: String (required)
- `pronunciation`: String (optional, IPA format)
- `dateAdded`: Date (auto-generated)
- `createdAt`: Date (auto-generated)
- `updatedAt`: Date (auto-generated)

## Features

✅ All dictionary operations now use MongoDB:
- GET /api/dictionary/words - Fetch all words
- POST /api/dictionary/words - Add new word
- PUT /api/dictionary/words/:id - Update word
- DELETE /api/dictionary/words/:id - Delete word

✅ Case-insensitive duplicate checking
✅ Automatic timestamps
✅ Indexed for fast lookups
✅ Supports pronunciation field
