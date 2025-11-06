/**
 * Data Validation Module
 * Provides validation for Etsy API requests and responses
 * Zero dependencies - uses native JavaScript validation
 * Optional: Users can integrate with Zod or other validation libraries
 */

import { CreateDraftListingParams, UpdateListingParams } from './types';

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationSchema<T = any> {
  validate(data: T): ValidationResult;
}

export interface ValidatorFunction<T = any> {
  (data: T): ValidationResult;
}

// ============================================================================
// Base Validator Class
// ============================================================================

/**
 * Base validator class for building validation schemas
 */
export class Validator<T = any> implements ValidationSchema<T> {
  private validators: Array<(data: T) => ValidationError | null> = [];

  /**
   * Add a validation rule
   */
  rule(validator: (data: T) => ValidationError | null): this {
    this.validators.push(validator);
    return this;
  }

  /**
   * Validate data against all rules
   */
  validate(data: T): ValidationResult {
    const errors: ValidationError[] = [];

    for (const validator of this.validators) {
      const error = validator(data);
      if (error) {
        errors.push(error);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// ============================================================================
// Field Validators
// ============================================================================

/**
 * Field validator builder
 */
export class FieldValidator {
  private field: string;

  constructor(field: string) {
    this.field = field;
  }

  /**
   * Check if field is required
   */
  required(message?: string): (data: any) => ValidationError | null {
    return (data: any) => {
      const value = data[this.field];
      if (value === undefined || value === null || value === '') {
        return {
          field: this.field,
          message: message || `${this.field} is required`,
          value
        };
      }
      return null;
    };
  }

  /**
   * Check if string field meets length requirements
   */
  string(options: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    message?: string;
  }): (data: any) => ValidationError | null {
    return (data: any) => {
      const value = data[this.field];
      if (value === undefined || value === null) return null;

      if (typeof value !== 'string') {
        return {
          field: this.field,
          message: options.message || `${this.field} must be a string`,
          value
        };
      }

      if (options.min !== undefined && value.length < options.min) {
        return {
          field: this.field,
          message: options.message || `${this.field} must be at least ${options.min} characters`,
          value
        };
      }

      if (options.max !== undefined && value.length > options.max) {
        return {
          field: this.field,
          message: options.message || `${this.field} must be at most ${options.max} characters`,
          value
        };
      }

      if (options.pattern && !options.pattern.test(value)) {
        return {
          field: this.field,
          message: options.message || `${this.field} has invalid format`,
          value
        };
      }

      return null;
    };
  }

  /**
   * Check if number field meets requirements
   */
  number(options: {
    min?: number;
    max?: number;
    integer?: boolean;
    positive?: boolean;
    message?: string;
  }): (data: any) => ValidationError | null {
    return (data: any) => {
      const value = data[this.field];
      if (value === undefined || value === null) return null;

      if (typeof value !== 'number' || isNaN(value)) {
        return {
          field: this.field,
          message: options.message || `${this.field} must be a number`,
          value
        };
      }

      if (options.integer && !Number.isInteger(value)) {
        return {
          field: this.field,
          message: options.message || `${this.field} must be an integer`,
          value
        };
      }

      if (options.positive && value <= 0) {
        return {
          field: this.field,
          message: options.message || `${this.field} must be positive`,
          value
        };
      }

      if (options.min !== undefined && value < options.min) {
        return {
          field: this.field,
          message: options.message || `${this.field} must be at least ${options.min}`,
          value
        };
      }

      if (options.max !== undefined && value > options.max) {
        return {
          field: this.field,
          message: options.message || `${this.field} must be at most ${options.max}`,
          value
        };
      }

      return null;
    };
  }

  /**
   * Check if field is one of allowed values
   */
  enum<T>(allowedValues: T[], message?: string): (data: any) => ValidationError | null {
    return (data: any) => {
      const value = data[this.field];
      if (value === undefined || value === null) return null;

      if (!allowedValues.includes(value)) {
        return {
          field: this.field,
          message: message || `${this.field} must be one of: ${allowedValues.join(', ')}`,
          value
        };
      }

      return null;
    };
  }

  /**
   * Check if field is an array
   */
  array(options: {
    min?: number;
    max?: number;
    itemValidator?: (item: any) => boolean;
    message?: string;
  }): (data: any) => ValidationError | null {
    return (data: any) => {
      const value = data[this.field];
      if (value === undefined || value === null) return null;

      if (!Array.isArray(value)) {
        return {
          field: this.field,
          message: options.message || `${this.field} must be an array`,
          value
        };
      }

      if (options.min !== undefined && value.length < options.min) {
        return {
          field: this.field,
          message: options.message || `${this.field} must have at least ${options.min} items`,
          value
        };
      }

      if (options.max !== undefined && value.length > options.max) {
        return {
          field: this.field,
          message: options.message || `${this.field} must have at most ${options.max} items`,
          value
        };
      }

      if (options.itemValidator) {
        for (let i = 0; i < value.length; i++) {
          if (!options.itemValidator(value[i])) {
            return {
              field: this.field,
              message: options.message || `${this.field}[${i}] has invalid value`,
              value: value[i]
            };
          }
        }
      }

      return null;
    };
  }
}

/**
 * Create a field validator
 */
export function field(fieldName: string): FieldValidator {
  return new FieldValidator(fieldName);
}

// ============================================================================
// Built-in Validation Schemas
// ============================================================================

/**
 * Listing creation validation schema
 */
export const CreateListingSchema = new Validator<CreateDraftListingParams>()
  .rule(field('quantity').required())
  .rule(field('quantity').number({ min: 1, integer: true, message: 'quantity must be a positive integer' }))
  .rule(field('title').required())
  .rule(field('title').string({ min: 1, max: 140, message: 'title must be 1-140 characters' }))
  .rule(field('description').string({ max: 65535, message: 'description must be less than 65535 characters' }))
  .rule(field('price').required())
  .rule(field('price').number({ min: 0.2, max: 50000, message: 'price must be between 0.20 and 50000.00' }))
  .rule(field('who_made').enum(['i_did', 'someone_else', 'collective'], 'who_made must be one of: i_did, someone_else, collective'))
  .rule(field('when_made').enum([
    'made_to_order',
    '2020_2024',
    '2010_2019',
    '2005_2009',
    '2000_2004',
    '1990s',
    '1980s',
    '1970s',
    '1960s',
    '1950s',
    '1940s',
    '1930s',
    '1920s',
    '1910s',
    '1900s',
    '1800s',
    '1700s',
    'before_1700'
  ]))
  .rule(field('taxonomy_id').required())
  .rule(field('taxonomy_id').number({ integer: true, positive: true, message: 'taxonomy_id must be a positive integer' }));

/**
 * Listing update validation schema
 */
export const UpdateListingSchema = new Validator<UpdateListingParams>()
  .rule((data) => {
    if (data.title !== undefined) {
      return field('title').string({ min: 1, max: 140, message: 'title must be 1-140 characters' })(data);
    }
    return null;
  })
  .rule((data) => {
    if (data.description !== undefined) {
      return field('description').string({ max: 65535, message: 'description must be less than 65535 characters' })(data);
    }
    return null;
  })
  .rule((data) => {
    if (data.tags !== undefined) {
      return field('tags').array({ max: 13, message: 'tags must have at most 13 items' })(data);
    }
    return null;
  })
  .rule((data) => {
    if (data.materials !== undefined) {
      return field('materials').array({ max: 13, message: 'materials must have at most 13 items' })(data);
    }
    return null;
  });

/**
 * Shop update validation schema
 */
export const UpdateShopSchema = new Validator()
  .rule((data) => {
    if (data.title !== undefined) {
      return field('title').string({ min: 1, max: 55, message: 'shop title must be 1-55 characters' })(data);
    }
    return null;
  })
  .rule((data) => {
    if (data.announcement !== undefined) {
      return field('announcement').string({ max: 5000, message: 'announcement must be less than 5000 characters' })(data);
    }
    return null;
  });

// ============================================================================
// Validation Options for Client Methods
// ============================================================================

export interface ValidationOptions {
  /**
   * Enable request validation before sending to API
   * @default false
   */
  validate?: boolean;

  /**
   * Custom validation schema to use
   */
  validateSchema?: ValidationSchema;

  /**
   * Throw error on validation failure
   * @default true
   */
  throwOnValidationError?: boolean;

  /**
   * Validate API response structure
   * @default false
   */
  validateResponse?: boolean;
}

/**
 * Validation error class
 */
export class ValidationException extends Error {
  public errors: ValidationError[];

  constructor(message: string, errors: ValidationError[]) {
    super(message);
    this.name = 'ValidationException';
    this.errors = errors;
  }
}

/**
 * Validate data and throw if invalid
 */
export function validateOrThrow<T>(
  data: T,
  schema: ValidationSchema<T>,
  errorMessage: string = 'Validation failed'
): void {
  const result = schema.validate(data);
  if (!result.valid) {
    throw new ValidationException(errorMessage, result.errors);
  }
}

/**
 * Validate data and return result
 */
export function validate<T>(data: T, schema: ValidationSchema<T>): ValidationResult {
  return schema.validate(data);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a custom validator
 */
export function createValidator<T>(): Validator<T> {
  return new Validator<T>();
}

/**
 * Combine multiple validators
 */
export function combineValidators<T>(...validators: ValidationSchema<T>[]): ValidationSchema<T> {
  return {
    validate(data: T): ValidationResult {
      const allErrors: ValidationError[] = [];

      for (const validator of validators) {
        const result = validator.validate(data);
        if (!result.valid) {
          allErrors.push(...result.errors);
        }
      }

      return {
        valid: allErrors.length === 0,
        errors: allErrors
      };
    }
  };
}
