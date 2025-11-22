function ip2long(ip) {
    let components = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (components) {
        let iplong = 0;
        let power = 1;
        for (let i = 4; i >= 1; i -= 1) {
            iplong += power * parseInt(components[i]);
            power *= 256;
        }
        return iplong;
    } else {
        return -1;
    }
}

function long2ip(proper_address) {
    let output = false;
    if (!isNaN(proper_address) && (proper_address >= 0 || proper_address <= 4294967295)) {
        output = Math.floor(proper_address / Math.pow(256, 3)) + '.' +
            Math.floor((proper_address % Math.pow(256, 3)) / Math.pow(256, 2)) + '.' +
            Math.floor(((proper_address % Math.pow(256, 3)) % Math.pow(256, 2)) / Math.pow(256, 1)) + '.' +
            Math.floor((((proper_address % Math.pow(256, 3)) % Math.pow(256, 2)) % Math.pow(256, 1)) / Math.pow(256, 0));
    }
    return output;
}

module.exports = { ip2long, long2ip };
