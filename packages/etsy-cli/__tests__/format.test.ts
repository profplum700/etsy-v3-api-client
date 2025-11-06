import {
  formatTable,
  formatJson,
  formatList,
  formatError,
  formatSuccess,
  formatInfo,
  formatWarning,
} from '../src/utils/format';

describe('format utilities', () => {
  describe('formatJson', () => {
    it('should format object as JSON', () => {
      const obj = { name: 'Test', value: 123 };
      const result = formatJson(obj);
      expect(result).toContain('"name"');
      expect(result).toContain('"Test"');
      expect(result).toContain('"value"');
      expect(result).toContain('123');
    });
  });

  describe('formatList', () => {
    it('should format array as bulleted list', () => {
      const items = ['Item 1', 'Item 2', 'Item 3'];
      const result = formatList(items);
      expect(result).toContain('• Item 1');
      expect(result).toContain('• Item 2');
      expect(result).toContain('• Item 3');
    });
  });

  describe('formatError', () => {
    it('should format error message', () => {
      const result = formatError('Something went wrong');
      expect(result).toContain('Error');
      expect(result).toContain('Something went wrong');
    });

    it('should format Error object', () => {
      const error = new Error('Test error');
      const result = formatError(error);
      expect(result).toContain('Error');
      expect(result).toContain('Test error');
    });
  });

  describe('formatSuccess', () => {
    it('should format success message', () => {
      const result = formatSuccess('Operation completed');
      expect(result).toContain('✓');
      expect(result).toContain('Operation completed');
    });
  });

  describe('formatInfo', () => {
    it('should format info message', () => {
      const result = formatInfo('Information message');
      expect(result).toContain('ℹ');
      expect(result).toContain('Information message');
    });
  });

  describe('formatWarning', () => {
    it('should format warning message', () => {
      const result = formatWarning('Warning message');
      expect(result).toContain('⚠');
      expect(result).toContain('Warning message');
    });
  });

  describe('formatTable', () => {
    it('should format data as table', () => {
      const headers = ['Name', 'Value'];
      const rows = [
        ['Item 1', '100'],
        ['Item 2', '200'],
      ];
      const result = formatTable(headers, rows);
      expect(result).toContain('Name');
      expect(result).toContain('Value');
      expect(result).toContain('Item 1');
      expect(result).toContain('100');
    });
  });
});
