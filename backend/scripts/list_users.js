const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function listUsers() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/autosong');
    console.log('Connected!\n');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

    const users = await User.find({});

    console.log(`Found ${users.length} users:\n`);

    for (const user of users) {
        console.log(`  ID: ${user._id}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Plan: ${user.plan}`);
        console.log(`  Suno Key: ${user.sunoApiKey ? 'SET' : 'NOT SET'}`);
        console.log('  ---');
    }

    if (users.length === 0) {
        console.log('No users found! The database is empty.');
        console.log('Please sign out and sign in again in the app.');
    }

    process.exit(0);
}

listUsers().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
