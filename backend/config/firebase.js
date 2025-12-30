const admin = require('firebase-admin');
const config = require('./index');

let firebaseApp;

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebase() {
    if (firebaseApp) {
        return firebaseApp;
    }

    try {
        // Decode base64 service account JSON
        const serviceAccountJson = Buffer.from(
            config.firebaseConfig.jsonBase64,
            'base64'
        ).toString('utf-8');

        const serviceAccount = JSON.parse(serviceAccountJson);

        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        console.log('✅ Firebase Admin SDK initialized successfully');
        return firebaseApp;
    } catch (error) {
        console.error('❌ Failed to initialize Firebase:', error.message);
        throw new Error('Firebase initialization failed');
    }
}

/**
 * Get Firestore database instance
 */
function getFirestore() {
    if (!firebaseApp) {
        initializeFirebase();
    }
    return admin.firestore();
}

/**
 * Get Firebase Auth instance
 */
function getAuth() {
    if (!firebaseApp) {
        initializeFirebase();
    }
    return admin.auth();
}

module.exports = {
    initializeFirebase,
    getFirestore,
    getAuth,
    admin
};
