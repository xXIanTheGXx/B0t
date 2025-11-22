const geoip = require('geoip-lite');

function lookup(ip) {
    const geo = geoip.lookup(ip);
    if (!geo) return null;

    return {
        country: geo.country,
        region: geo.region,
        city: geo.city,
        ll: geo.ll, // [latitude, longitude]
        range: geo.range
    };
}

module.exports = { lookup };
