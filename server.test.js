const os = require('os');
const { getLocalIP } = require('./server');

jest.mock('os');

describe('getLocalIP', () => {
    afterEach(() => {
        jest.resetAllMocks();
    });

    it('should prioritize 192.168.x.x addresses', () => {
        os.networkInterfaces.mockReturnValue({
            'en0': [
                { family: 'IPv4', internal: false, address: '10.0.0.1' },
                { family: 'IPv4', internal: false, address: '192.168.1.10' }
            ]
        });

        const ip = getLocalIP();
        expect(ip).toBe('192.168.1.10');
    });

    it('should fallback to 10.x.x.x if 192.168.x.x is not present', () => {
        os.networkInterfaces.mockReturnValue({
            'en0': [
                { family: 'IPv4', internal: false, address: '172.16.0.1' },
                { family: 'IPv4', internal: false, address: '10.0.0.1' }
            ]
        });

        const ip = getLocalIP();
        expect(ip).toBe('10.0.0.1');
    });

    it('should fallback to 172.16-31.x.x if others are not present', () => {
        os.networkInterfaces.mockReturnValue({
            'en0': [
                { family: 'IPv4', internal: false, address: '8.8.8.8' },
                { family: 'IPv4', internal: false, address: '172.20.10.2' }
            ]
        });

        const ip = getLocalIP();
        expect(ip).toBe('172.20.10.2');
    });

    it('should return any valid IPv4 if specific private ones are missing', () => {
        os.networkInterfaces.mockReturnValue({
            'en0': [
                { family: 'IPv4', internal: false, address: '203.0.113.1' }
            ]
        });

        const ip = getLocalIP();
        expect(ip).toBe('203.0.113.1');
    });

    it('should ignore IPv6 and internal loopbacks', () => {
        os.networkInterfaces.mockReturnValue({
            'lo0': [
                { family: 'IPv4', internal: true, address: '127.0.0.1' }
            ],
            'en0': [
                { family: 'IPv6', internal: false, address: 'fe80::1' },
                { family: 'IPv4', internal: false, address: '192.168.0.5' }
            ]
        });

        const ip = getLocalIP();
        expect(ip).toBe('192.168.0.5');
    });

    it('should return 127.0.0.1 when no valid candidates exist', () => {
        os.networkInterfaces.mockReturnValue({
            'lo0': [
                { family: 'IPv4', internal: true, address: '127.0.0.1' },
                { family: 'IPv6', internal: true, address: '::1' }
            ],
            'en0': [
                { family: 'IPv6', internal: false, address: 'fe80::1' }
            ]
        });

        const ip = getLocalIP();
        expect(ip).toBe('127.0.0.1');
    });
});
