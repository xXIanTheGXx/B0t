const express = require('express');
const { Server } = require('./database');

const router = express.Router();

// Get Servers (with pagination and filters)
router.get('/servers', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const query = {};
        if (req.query.version) query['version.name'] = new RegExp(req.query.version, 'i');
        if (req.query.software) query['version.software'] = new RegExp(req.query.software, 'i');
        if (req.query.minPlayers) query['players.online'] = { $gte: parseInt(req.query.minPlayers) };

        const total = await Server.countDocuments(query);
        const servers = await Server.find(query)
            .sort({ lastSeen: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            page,
            limit,
            total,
            servers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Map Data (GeoJSON)
router.get('/map', async (req, res) => {
    try {
        // Only return servers with location
        // Return specific fields to keep payload small
        // Limit to 10000 for performance
        const servers = await Server.find({
            'location.coordinates': { $exists: true, $ne: [0,0] }
        })
        .select('ip port version location players geo')
        .limit(10000);

        const geojson = {
            type: 'FeatureCollection',
            features: servers.map(s => ({
                type: 'Feature',
                geometry: s.location,
                properties: {
                    ip: s.ip,
                    port: s.port,
                    version: s.version ? s.version.name : '?',
                    players: s.players ? s.players.online : 0,
                    city: s.geo ? s.geo.city : 'Unknown',
                    country: s.geo ? s.geo.country : 'Unknown'
                }
            }))
        };

        res.json(geojson);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
