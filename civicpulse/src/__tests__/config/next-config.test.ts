/**
 * Next.js Configuration Tests
 * 
 * These tests verify that the Next.js configuration properly handles
 * native modules like better-sqlite3. This is critical for preventing
 * the bundling issues that caused the database connection failures.
 * 
 * Issue Background:
 * - better-sqlite3 is a native Node.js module with compiled bindings
 * - Next.js bundlers (especially Turbopack) can incorrectly bundle these
 * - When bundled, the native .node bindings cannot be found
 * - This caused the API to return empty results
 * 
 * Solution:
 * - serverExternalPackages: ['better-sqlite3'] tells Next.js to exclude it
 * - webpack externals configuration provides fallback for webpack bundler
 */

import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'next.config.ts');
const PACKAGE_JSON_PATH = path.join(__dirname, '..', '..', '..', 'package.json');

describe('Next.js Configuration', () => {
  let configContent: string;
  let packageJson: { dependencies: Record<string, string>; scripts: Record<string, string> };

  beforeAll(() => {
    configContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
    packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'));
  });

  describe('Native Module Configuration', () => {
    it('should include serverExternalPackages for better-sqlite3', () => {
      expect(configContent).toContain('serverExternalPackages');
      expect(configContent).toContain("'better-sqlite3'");
    });

    it('should have webpack externals configuration', () => {
      expect(configContent).toContain('webpack:');
      expect(configContent).toContain('externals');
    });

    it('should check for server-side configuration', () => {
      expect(configContent).toContain('isServer');
    });
  });

  describe('Package Dependencies', () => {
    it('should have better-sqlite3 as a dependency', () => {
      expect(packageJson.dependencies).toHaveProperty('better-sqlite3');
    });

    it('should have next as a dependency', () => {
      expect(packageJson.dependencies).toHaveProperty('next');
    });
  });

  describe('Development Scripts', () => {
    it('should have dev script without turbopack by default', () => {
      // The default dev script should not use turbopack due to native module issues
      const devScript = packageJson.scripts.dev;
      expect(devScript).toBe('next dev');
      expect(devScript).not.toContain('--turbopack');
    });

    it('should have optional turbopack script available', () => {
      // Turbopack should still be available as an option
      expect(packageJson.scripts['dev:turbo']).toContain('--turbopack');
    });
  });
});

describe('Config File Structure', () => {
  it('next.config.ts should exist', () => {
    expect(fs.existsSync(CONFIG_PATH)).toBe(true);
  });

  it('package.json should exist', () => {
    expect(fs.existsSync(PACKAGE_JSON_PATH)).toBe(true);
  });

  it('next.config.ts should be valid TypeScript syntax', () => {
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
    
    // Basic structure checks
    expect(configContent).toContain('import type { NextConfig }');
    expect(configContent).toContain('const nextConfig: NextConfig');
    expect(configContent).toContain('export default nextConfig');
  });

  it('should have standalone output configuration', () => {
    const configContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
    expect(configContent).toContain("output: 'standalone'");
  });
});

describe('Native Module Bindings', () => {
  it('better-sqlite3 should have compiled bindings in node_modules', () => {
    const bindingsPath = path.join(
      __dirname, '..', '..', '..', 
      'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'
    );
    
    // This test verifies the native bindings exist after npm install
    expect(fs.existsSync(bindingsPath)).toBe(true);
  });

  it('better-sqlite3 should be loadable', () => {
    // This is the core test - can we actually load the module?
    expect(() => {
      require('better-sqlite3');
    }).not.toThrow();
  });

  it('better-sqlite3 should be able to create database', () => {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    
    expect(db.open).toBe(true);
    
    db.close();
  });
});

