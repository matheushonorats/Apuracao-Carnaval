const fs = require('fs');
try {
    const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

    console.log('--- Key Sizes ---');
    for (const key in data) {
        const size = JSON.stringify(data[key]).length;
        console.log(`${key}: ${size} bytes`);

        if (size > 100000) {
            console.log(`[BLOAT DETECTED IN ${key}]`);
            if (key === 'settings') {
                console.log(JSON.stringify(data[key], null, 2).substring(0, 500));
            }
        }
    }
} catch (e) {
    console.error(e);
}
