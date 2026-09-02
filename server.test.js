const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Set environment variables before requiring the server
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ssamba-test-'));
const TEST_DATA_FILE = path.join(TEST_DIR, 'data.json');
const TEST_UPLOADS_DIR = path.join(TEST_DIR, 'uploads');

process.env.DATA_FILE = TEST_DATA_FILE;
process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;

const server = require('./server');

describe('Server API and Endpoints', () => {
    beforeAll(() => {
        if (!fs.existsSync(TEST_UPLOADS_DIR)) {
            fs.mkdirSync(TEST_UPLOADS_DIR);
        }
    });

    afterAll((done) => {
        // Clean up test directory
        fs.rmSync(TEST_DIR, { recursive: true, force: true });

        // We need to stop the server if it happens to be running (supertest doesn't start it if we pass the app object, but it's good practice)
        if (server.listening) {
            server.close(done);
        } else {
            done();
        }
    });

    afterEach(() => {
        // Clean up data.json between tests if we want, or reset module cache to reset cachedData
        if (fs.existsSync(TEST_DATA_FILE)) {
            fs.unlinkSync(TEST_DATA_FILE);
        }
    });

    it('should handle OPTIONS requests', async () => {
        const response = await request(server).options('/api/data');
        expect(response.status).toBe(204);
        expect(response.headers['access-control-allow-origin']).toBe('*');
    });

    it('should return null when /api/data is requested and no file exists', async () => {
        // Reset cachedData in server module
        jest.resetModules();

        process.env.DATA_FILE = TEST_DATA_FILE;
        process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;
        const freshServer = require('./server');

        const response = await request(freshServer).get('/api/data');
        expect(response.status).toBe(200);
        expect(response.body).toBe(null);

        freshServer.close();
    });

    it('should save data when POST /api/data is called and return 200', async () => {
        jest.resetModules();

        process.env.DATA_FILE = TEST_DATA_FILE;
        process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;
        const freshServer = require('./server');

        const testData = { settings: { title: "Test Carnaval" }, schools: [] };

        const response = await request(freshServer)
            .post('/api/data')
            .send(testData);

        expect(response.status).toBe(200);

        // Wait a bit for async write to finish (since it writes to disk async after returning response if not optimized)
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(fs.existsSync(TEST_DATA_FILE)).toBe(true);
        const fileContent = JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf8'));
        expect(fileContent.settings.title).toBe("Test Carnaval");

        freshServer.close();
    });

    it('should extract base64 images, save them, and modify the JSON payload', async () => {
        jest.resetModules();

        process.env.DATA_FILE = TEST_DATA_FILE;
        process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;
        const freshServer = require('./server');

        // A minimal valid 1x1 transparent PNG base64
        const transparentPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

        const testData = {
            settings: {
                background: transparentPng
            },
            schools: [
                { id: "1", logoDataURL: transparentPng }
            ]
        };

        const response = await request(freshServer)
            .post('/api/data')
            .send(testData);

        expect(response.status).toBe(200);

        // Check that it returns the modified data when optimized
        const returnedData = response.body;

        // Settings background should now be a URL
        expect(returnedData.settings.background).toMatch(/^\/uploads\/setting_background_\d+\.png$/);
        expect(returnedData.schools[0].logoDataURL).toMatch(/^\/uploads\/school_1_\d+\.png$/);

        // Wait for async write
        await new Promise(resolve => setTimeout(resolve, 50));

        // Check file exists
        const fileContent = JSON.parse(fs.readFileSync(TEST_DATA_FILE, 'utf8'));
        expect(fileContent.settings.background).toBe(returnedData.settings.background);

        freshServer.close();
    });

    it('should handle SSE connection at /api/events', async () => {
        jest.resetModules();
        process.env.DATA_FILE = TEST_DATA_FILE;
        process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;
        const freshServer = require('./server');

        // Simple test for SSE logic
        const req = request(freshServer).get('/api/events');

        // Let it run in the background without awaiting it to avoid timeout
        const reqObject = req.end(() => {});

        // Wait a bit just to allow internal SSE client to register
        await new Promise(resolve => setTimeout(resolve, 100));

        // Important: Abort the request so the socket closes and Jest can exit cleanly
        if (reqObject && reqObject.abort) {
             reqObject.abort();
        }

        freshServer.close();
    });

    it('should serve index.html for /', async () => {
        const response = await request(server).get('/');
        // Assuming index.html exists in the root
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('text/html');
    });

    it('should return 404 for non-existent static files', async () => {
        const response = await request(server).get('/non-existent-file.xyz');
        expect(response.status).toBe(404);
    });
});
