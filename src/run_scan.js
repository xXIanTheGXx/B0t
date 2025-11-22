const { loadConfig } = require('./config');
const { ScanPipeline } = require('./pipeline');

async function run() {
    console.log("Starting Phase 1 Scanner (Masscan + Pipeline)...");

    const config = loadConfig();

    if (!config.masscan) {
        console.error('Error: "masscan" section missing in configuration.');
        console.error('Please add it to config.json or ensure it is loaded.');
        process.exit(1);
    }

    // Construct range
    let range = config.scan.range;
    if (!range) {
        if (config.scan.startIp && config.scan.endIp) {
            range = `${config.scan.startIp}-${config.scan.endIp}`;
        } else {
            console.error('Error: No IP range specified (scan.range or scan.startIp/endIp).');
            process.exit(1);
        }
    }

    const pipelineConfig = {
        masscanPath: config.masscan.bin || 'masscan',
        rate: config.masscan.rate,
        excludeFile: config.masscan.excludeFile,

        dbUri: config.database ? config.database.uri : process.env.MONGO_URI,
        range: range,
        concurrency: config.scan.portConcurrency || 200,
        ports: '25565'
    };

    if (!pipelineConfig.dbUri) {
         console.error('Error: Database URI missing (database.uri).');
         process.exit(1);
    }

    const pipeline = new ScanPipeline(pipelineConfig);

    try {
        await pipeline.start();
        console.log('Scan complete.');
        process.exit(0);
    } catch (err) {
        console.error('Scan failed:', err);
        process.exit(1);
    }
}

run();
