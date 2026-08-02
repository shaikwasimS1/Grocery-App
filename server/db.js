require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const dns = require('dns');

// Force Node.js to use Google DNS to resolve MongoDB Atlas SRV records
// (local ISP DNS may block SRV lookups on port 27017)
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, { family: 4 });
    console.log(`✅ Connected to MongoDB Atlas (${conn.connection.host})`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
