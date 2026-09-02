const fs = require('fs');
const path = require('path');
const { processImages } = require('./server');

// Mock fs methods
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    writeFileSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(true), // Assuming dir exists for tests
}));

describe('processImages', () => {
    let mockDateNow;

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock Date.now to return a fixed timestamp for predictable filenames
        mockDateNow = jest.spyOn(Date, 'now').mockReturnValue(1234567890);
    });

    afterEach(() => {
        mockDateNow.mockRestore();
    });

    test('should return false if data is missing or empty', () => {
        expect(processImages(null)).toBe(false);
        expect(processImages({})).toBe(false);
    });

    test('should process logoDataURL in schools', () => {
        const data = {
            schools: [
                { id: '1', logoDataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' }
            ]
        };

        const result = processImages(data);

        expect(result).toBe(true);
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);

        // Check if the filename prefix and format are correct
        const expectedFileName = `school_1_1234567890.png`;
        const expectedPath = path.join(__dirname, 'uploads', expectedFileName);

        expect(fs.writeFileSync).toHaveBeenCalledWith(
            expectedPath,
            expect.any(Buffer)
        );

        // Check if the data object was updated correctly
        expect(data.schools[0].logoDataURL).toBe(`/uploads/${expectedFileName}`);
    });

    test('should handle jpeg to jpg extension normalization', () => {
        const data = {
            settings: {
                background: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD'
            }
        };

        const result = processImages(data);

        expect(result).toBe(true);
        const expectedFileName = `setting_background_1234567890.jpg`;
        const expectedPath = path.join(__dirname, 'uploads', expectedFileName);

        expect(fs.writeFileSync).toHaveBeenCalledWith(
            expectedPath,
            expect.any(Buffer)
        );

        expect(data.settings.background).toBe(`/uploads/${expectedFileName}`);
    });

    test('should handle svg+xml to svg extension normalization', () => {
         const data = {
            settings: {
                logo: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPg=='
            }
        };

        const result = processImages(data);

        expect(result).toBe(true);
        const expectedFileName = `setting_logo_1234567890.svg`;
        const expectedPath = path.join(__dirname, 'uploads', expectedFileName);

        expect(fs.writeFileSync).toHaveBeenCalledWith(
            expectedPath,
            expect.any(Buffer)
        );

        expect(data.settings.logo).toBe(`/uploads/${expectedFileName}`);
    });

    test('should return false and not modify data if images are not base64', () => {
         const data = {
            schools: [
                { id: '1', logoDataURL: '/uploads/existing_image.png' }
            ],
            settings: {
                background: '/uploads/bg.jpg'
            }
        };

        const result = processImages(data);

        expect(result).toBe(false);
        expect(fs.writeFileSync).not.toHaveBeenCalled();
        expect(data.schools[0].logoDataURL).toBe('/uploads/existing_image.png');
        expect(data.settings.background).toBe('/uploads/bg.jpg');
    });

    test('should catch and log errors gracefully when parsing invalid base64 data', () => {
        const data = {
            settings: {
                // Invalid base64 data format that passes the regex but fails Buffer parsing?
                // Wait, Buffer.from doesn't usually throw unless encoding is completely wrong.
                // We can mock fs.writeFileSync to throw to test the catch block.
                logo: 'data:image/png;base64,valid_base64_format'
            }
        };

        fs.writeFileSync.mockImplementationOnce(() => {
            throw new Error('Simulated disk error');
        });

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        const result = processImages(data);

        // processImages itself shouldn't throw, it should catch and log.
        // Also if it threw before updating obj[key], changed will be false?
        // Wait, 'changed = true' happens AFTER fs.writeFileSync.
        // So result will be false.
        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('❌ Error processing image for setting_logo:'),
            'Simulated disk error'
        );

        consoleSpy.mockRestore();
    });
});
