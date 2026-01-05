const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import Models
const { SchedulerModel, UserModel } = require('../models');

async function cleanup() {
    console.log('Connecting to MongoDB...');
    try {
        await mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/autosong');
        console.log('✅ Connected to MongoDB');
    } catch (e) {
        console.error('❌ Connection Failed:', e.message);
        process.exit(1);
    }

    // Get direct access to Mongoose Models to bypass adapters if needed, 
    // but using adapters is fine too. Let's use Mongoose directly for administration.
    const Scheduler = mongoose.model('Scheduler');
    const User = mongoose.model('User');
    const Video = mongoose.model('Video');

    const schedulers = await Scheduler.find({});
    console.log(`\n🔍 Scanning ${schedulers.length} schedulers for orphans...`);

    let deletedCount = 0;

    for (const doc of schedulers) {
        const scheduler = doc.toObject();
        console.log(`Checking Scheduler: "${scheduler.name}" (User ID: ${scheduler.userId})`);

        // Check if user exists
        // We use findById with try/catch in case ID format is weird
        let userExists = false;
        try {
            const user = await User.findById(scheduler.userId);
            if (user) userExists = true;
        } catch (e) {
            userExists = false;
        }

        if (!userExists) {
            console.warn(`   ⚠️  User NOT found. Deleting orphan scheduler...`);

            // Delete Scheduler
            await Scheduler.findByIdAndDelete(scheduler._id);

            // Delete associated videos
            const vidResult = await Video.deleteMany({ schedulerId: scheduler._id });
            console.log(`      ↳ Deleted scheduler and ${vidResult.deletedCount} videos.`);

            deletedCount++;
        } else {
            console.log(`   ✅ Valid link to user.`);
        }
    }

    console.log(`\n🎉 Cleanup Complete! Removed ${deletedCount} orphaned schedulers.`);
    console.log(`ℹ️  Note: If you still see errors, please Sign Out and Sign In again in the App.`);
    process.exit(0);
}

cleanup();
