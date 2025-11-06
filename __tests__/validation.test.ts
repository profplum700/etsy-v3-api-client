/**
 * Tests for Data Validation (Phase 2)
 */

import {
  Validator,
  field,
  CreateListingSchema,
  UpdateListingSchema,
  UpdateShopSchema,
  ValidationException,
  validateOrThrow,
  validate,
  createValidator,
  combineValidators
} from '../src/validation';
import type { CreateDraftListingParams, UpdateListingParams } from '../src/types';

describe('Data Validation', () => {
  describe('FieldValidator', () => {
    it('should validate required fields', () => {
      const validator = new Validator()
        .rule(field('name').required());

      const result1 = validator.validate({ name: 'test' });
      expect(result1.valid).toBe(true);

      const result2 = validator.validate({});
      expect(result2.valid).toBe(false);
      expect(result2.errors[0].field).toBe('name');
    });

    it('should validate string length', () => {
      const validator = new Validator()
        .rule(field('title').string({ min: 5, max: 10 }));

      const result1 = validator.validate({ title: 'hello' });
      expect(result1.valid).toBe(true);

      const result2 = validator.validate({ title: 'hi' });
      expect(result2.valid).toBe(false);

      const result3 = validator.validate({ title: 'hello world!' });
      expect(result3.valid).toBe(false);
    });

    it('should validate string pattern', () => {
      const validator = new Validator()
        .rule(field('email').string({ pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }));

      const result1 = validator.validate({ email: 'test@example.com' });
      expect(result1.valid).toBe(true);

      const result2 = validator.validate({ email: 'invalid-email' });
      expect(result2.valid).toBe(false);
    });

    it('should validate numbers', () => {
      const validator = new Validator()
        .rule(field('price').number({ min: 0, max: 1000, positive: true }));

      const result1 = validator.validate({ price: 50 });
      expect(result1.valid).toBe(true);

      const result2 = validator.validate({ price: -10 });
      expect(result2.valid).toBe(false);

      const result3 = validator.validate({ price: 1500 });
      expect(result3.valid).toBe(false);
    });

    it('should validate integers', () => {
      const validator = new Validator()
        .rule(field('quantity').number({ integer: true }));

      const result1 = validator.validate({ quantity: 10 });
      expect(result1.valid).toBe(true);

      const result2 = validator.validate({ quantity: 10.5 });
      expect(result2.valid).toBe(false);
    });

    it('should validate enum values', () => {
      const validator = new Validator()
        .rule(field('status').enum(['active', 'inactive', 'draft']));

      const result1 = validator.validate({ status: 'active' });
      expect(result1.valid).toBe(true);

      const result2 = validator.validate({ status: 'invalid' });
      expect(result2.valid).toBe(false);
    });

    it('should validate arrays', () => {
      const validator = new Validator()
        .rule(field('tags').array({ min: 1, max: 5 }));

      const result1 = validator.validate({ tags: ['tag1', 'tag2'] });
      expect(result1.valid).toBe(true);

      const result2 = validator.validate({ tags: [] });
      expect(result2.valid).toBe(false);

      const result3 = validator.validate({ tags: ['1', '2', '3', '4', '5', '6'] });
      expect(result3.valid).toBe(false);
    });

    it('should validate array items', () => {
      const validator = new Validator()
        .rule(field('numbers').array({
          itemValidator: (item) => typeof item === 'number'
        }));

      const result1 = validator.validate({ numbers: [1, 2, 3] });
      expect(result1.valid).toBe(true);

      const result2 = validator.validate({ numbers: [1, 'two', 3] });
      expect(result2.valid).toBe(false);
    });

    it('should skip validation for undefined optional fields', () => {
      const validator = new Validator()
        .rule(field('optional').string({ max: 10 }));

      const result = validator.validate({});
      expect(result.valid).toBe(true);
    });
  });

  describe('Built-in Schemas', () => {
    describe('CreateListingSchema', () => {
      it('should validate valid listing creation params', () => {
        const params: CreateDraftListingParams = {
          quantity: 5,
          title: 'Test Product',
          description: 'A great product',
          price: 29.99,
          who_made: 'i_did',
          when_made: 'made_to_order',
          taxonomy_id: 123
        };

        const result = CreateListingSchema.validate(params);
        expect(result.valid).toBe(true);
      });

      it('should reject listing with missing required fields', () => {
        const params = {
          title: 'Test Product'
        } as any;

        const result = CreateListingSchema.validate(params);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject listing with invalid price', () => {
        const params: CreateDraftListingParams = {
          quantity: 5,
          title: 'Test Product',
          price: 0.10, // Too low
          who_made: 'i_did',
          when_made: 'made_to_order',
          taxonomy_id: 123
        };

        const result = CreateListingSchema.validate(params);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'price')).toBe(true);
      });

      it('should reject listing with too long title', () => {
        const params: CreateDraftListingParams = {
          quantity: 5,
          title: 'x'.repeat(141), // Too long
          price: 29.99,
          who_made: 'i_did',
          when_made: 'made_to_order',
          taxonomy_id: 123
        };

        const result = CreateListingSchema.validate(params);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'title')).toBe(true);
      });

      it('should reject listing with invalid quantity', () => {
        const params: CreateDraftListingParams = {
          quantity: 0, // Invalid
          title: 'Test Product',
          price: 29.99,
          who_made: 'i_did',
          when_made: 'made_to_order',
          taxonomy_id: 123
        };

        const result = CreateListingSchema.validate(params);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.field === 'quantity')).toBe(true);
      });
    });

    describe('UpdateListingSchema', () => {
      it('should validate valid listing update params', () => {
        const params: UpdateListingParams = {
          title: 'Updated Title',
          price: 39.99
        };

        const result = UpdateListingSchema.validate(params);
        expect(result.valid).toBe(true);
      });

      it('should reject invalid title length', () => {
        const params: UpdateListingParams = {
          title: 'x'.repeat(141)
        };

        const result = UpdateListingSchema.validate(params);
        expect(result.valid).toBe(false);
      });

      it('should reject too many tags', () => {
        const params: UpdateListingParams = {
          tags: Array.from({ length: 14 }, (_, i) => `tag${i}`)
        };

        const result = UpdateListingSchema.validate(params);
        expect(result.valid).toBe(false);
      });

      it('should accept partial updates', () => {
        const params: UpdateListingParams = {
          price: 49.99
        };

        const result = UpdateListingSchema.validate(params);
        expect(result.valid).toBe(true);
      });
    });

    describe('UpdateShopSchema', () => {
      it('should validate valid shop update params', () => {
        const params = {
          title: 'My Shop',
          announcement: 'Welcome to my shop!'
        };

        const result = UpdateShopSchema.validate(params);
        expect(result.valid).toBe(true);
      });

      it('should reject invalid title length', () => {
        const params = {
          title: 'x'.repeat(56)
        };

        const result = UpdateShopSchema.validate(params);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('ValidationException', () => {
    it('should throw ValidationException with validateOrThrow', () => {
      const validator = new Validator()
        .rule(field('name').required());

      expect(() => {
        validateOrThrow({}, validator);
      }).toThrow(ValidationException);
    });

    it('should include error details in exception', () => {
      const validator = new Validator()
        .rule(field('name').required());

      try {
        validateOrThrow({}, validator);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect((error as ValidationException).errors).toHaveLength(1);
        expect((error as ValidationException).errors[0].field).toBe('name');
      }
    });
  });

  describe('Utility Functions', () => {
    it('should create validator with createValidator', () => {
      const validator = createValidator()
        .rule(field('name').required());

      expect(validator).toBeInstanceOf(Validator);

      const result = validator.validate({ name: 'test' });
      expect(result.valid).toBe(true);
    });

    it('should combine multiple validators', () => {
      const validator1 = new Validator()
        .rule(field('name').required());

      const validator2 = new Validator()
        .rule(field('age').number({ min: 0 }));

      const combined = combineValidators(validator1, validator2);

      const result1 = combined.validate({ name: 'test', age: 25 });
      expect(result1.valid).toBe(true);

      const result2 = combined.validate({ age: 25 });
      expect(result2.valid).toBe(false);

      const result3 = combined.validate({ name: 'test', age: -5 });
      expect(result3.valid).toBe(false);
    });

    it('should validate without throwing using validate function', () => {
      const validator = new Validator()
        .rule(field('name').required());

      const result = validate({}, validator);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('Complex Validation Scenarios', () => {
    it('should validate multiple rules on same field', () => {
      const validator = new Validator()
        .rule(field('username').required())
        .rule(field('username').string({ min: 3, max: 20 }));

      const result1 = validator.validate({ username: 'test' });
      expect(result1.valid).toBe(true);

      const result2 = validator.validate({});
      expect(result2.valid).toBe(false);

      const result3 = validator.validate({ username: 'ab' });
      expect(result3.valid).toBe(false);
    });

    it('should collect all validation errors', () => {
      const validator = new Validator()
        .rule(field('name').required())
        .rule(field('email').required())
        .rule(field('age').required());

      const result = validator.validate({});
      expect(result.errors).toHaveLength(3);
    });
  });
});
