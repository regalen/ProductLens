import { describe, it, expect } from 'vitest';
import { isPrivateUrl } from '../../server/utils/url.js';

describe('isPrivateUrl', () => {
  describe('should block private/loopback addresses', () => {
    it('blocks 127.0.0.1', () => {
      expect(isPrivateUrl('http://127.0.0.1')).toBe(true);
    });

    it('blocks localhost', () => {
      expect(isPrivateUrl('http://localhost')).toBe(true);
    });

    it('blocks 10.x.x.x (private range)', () => {
      expect(isPrivateUrl('http://10.0.0.1')).toBe(true);
    });

    it('blocks 192.168.x.x (private range)', () => {
      expect(isPrivateUrl('http://192.168.1.1')).toBe(true);
    });

    it('blocks 169.254.x.x (link-local)', () => {
      expect(isPrivateUrl('http://169.254.169.254')).toBe(true);
    });

    it('blocks IPv6 loopback [::1]', () => {
      expect(isPrivateUrl('http://[::1]')).toBe(true);
    });

    it('blocks 0.0.0.0', () => {
      expect(isPrivateUrl('http://0.0.0.0')).toBe(true);
    });
  });

  describe('should allow public addresses', () => {
    it('allows example.com', () => {
      expect(isPrivateUrl('http://example.com')).toBe(false);
    });

    it('allows images.unsplash.com', () => {
      expect(isPrivateUrl('https://images.unsplash.com')).toBe(false);
    });

    it('allows cdn.shopify.com', () => {
      expect(isPrivateUrl('https://cdn.shopify.com')).toBe(false);
    });
  });

  describe('should handle URLs with paths and ports', () => {
    it('blocks localhost with port and path', () => {
      expect(isPrivateUrl('http://localhost:3000/api')).toBe(true);
    });

    it('blocks 127.0.0.1 with port', () => {
      expect(isPrivateUrl('http://127.0.0.1:8080/health')).toBe(true);
    });

    it('allows public URL with path and port', () => {
      expect(isPrivateUrl('https://api.example.com:443/v1/images')).toBe(false);
    });
  });
});
