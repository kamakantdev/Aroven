/**
 * MongoDB Configuration
 * Used for high-volume data: audit logs, chat messages, analytics, ambulance tracking
 */
const mongoose = require('mongoose');
const config = require('./index');

let isConnected = false;

const connectMongoDB = async () => {
  if (!config.mongodb.uri) {
    console.warn('⚠️  MongoDB URI not configured. MongoDB features will be unavailable.');
    return null;
  }

  if (isConnected) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(config.mongodb.uri, {
      dbName: config.mongodb.dbName,
    });

    isConnected = true;
    console.log('✅ MongoDB connected successfully');

    // Track connection state changes
    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.warn('⚠️  MongoDB disconnected');
    });
    mongoose.connection.on('error', (err) => {
      isConnected = false;
      console.error('❌ MongoDB connection error:', err.message);
    });
    mongoose.connection.on('reconnected', () => {
      isConnected = true;
      console.log('✅ MongoDB reconnected');
    });

    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.warn('⚠️  Continuing without MongoDB. Some features (audit logs, chat history, analytics) will be limited.');
    return null;
  }
};

const getMongoConnection = () => {
  if (!isConnected) return null;
  return mongoose.connection;
};

module.exports = { mongoose, connectMongoDB, getMongoConnection };
