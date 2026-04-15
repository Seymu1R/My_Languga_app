import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://seymu1r:n0gHwrweGYdHz1fi@cluster0.b4icad3.mongodb.net/';
    
    // Extract DB name from URI or use default
    await mongoose.connect(mongoURI, {
       dbName: 'language_learning'
    });
    
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database: ${mongoose.connection.name}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    console.log('⚠️  Server will continue without MongoDB (in-memory storage)');
    console.log('💡 To enable MongoDB, run: mongod --port 27018 --dbpath ~/mongodb_data --fork --logpath ~/mongodb.log');
    // Don't exit - allow server to continue without MongoDB
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

export default connectDB;
