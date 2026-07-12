const fs = require('fs');
try {
    const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    const settings = data.settings;

    console.log('--- Settings Analysis ---');
    if (!settings) {
        console.log('No settings found');
    } else {
        for (const key in settings) {
            const val = settings[key];
            const size = JSON.stringify(val).length;
            const type = Array.isArray(val) ? 'Array' : typeof val;

            console.log(`Key: ${key} | Type: ${type} | Size: ${size} bytes`);

            if (Array.isArray(val)) {
                console.log(`  Length: ${val.length} items`);
                if (val.length > 0) {
                    console.log(`  Sample: ${JSON.stringify(val[0]).substring(0, 100)}`);
                }
            } else if (type === 'string' && size > 100) {
                console.log(`  Start: ${val.substring(0, 50)}...`);
            }
        }
    }
} catch (e) {
    console.error(e);
}
