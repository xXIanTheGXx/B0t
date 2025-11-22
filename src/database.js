const mongoose = require('mongoose');

const ServerSchema = new mongoose.Schema({
    ip: { type: String, required: true, index: true },
    port: { type: Number, required: true, default: 25565 },

    version: {
        name: String, // e.g., "1.20.1" or "Paper 1.20.1"
        protocol: Number,
        software: String // Extracted software type (Paper, Spigot, Forge, etc.)
    },

    motd: {
        raw: String, // Original JSON or text
        clean: String, // Stripped of colors for search
        html: String // HTML formatted for UI
    },

    players: {
        online: Number,
        max: Number,
        sample: [{
            id: String,
            name: String
        }]
    },

    modInfo: {
        type: { type: String }, // "FML", etc.
        modList: [String]
    },

    favicon: String, // Base64 encoded image

    // Geospatial data
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            default: [0, 0]
        }
    },

    discovered: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now }
});

// Compound index for unique server identification
ServerSchema.index({ ip: 1, port: 1 }, { unique: true });
// Geospatial index
ServerSchema.index({ location: '2dsphere' });
// Text index for searching MOTD
ServerSchema.index({ 'motd.clean': 'text', 'version.software': 'text' });

const BlacklistSchema = new mongoose.Schema({
    ip: { type: String, required: true, unique: true },
    reason: { type: String, default: 'Opt-out' },
    created: { type: Date, default: Date.now }
});

const Server = mongoose.model('Server', ServerSchema);
const Blacklist = mongoose.model('Blacklist', BlacklistSchema);

async function connect(uri) {
    if (!uri) {
        throw new Error('Database URI is required');
    }
    try {
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
}

async function disconnect() {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
}

module.exports = {
    Server,
    Blacklist,
    connect,
    disconnect
};
