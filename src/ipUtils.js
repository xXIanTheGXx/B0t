function ip2long(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return -1;
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function long2ip(ip) {
    return ((ip >>> 24) & 0xFF) + '.' +
           ((ip >>> 16) & 0xFF) + '.' +
           ((ip >>> 8)  & 0xFF) + '.' +
           (ip & 0xFF);
}

module.exports = { ip2long, long2ip };
