import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const specPath = path.join(__dirname, '..', 'spec', 'etsy-openapi-3.0.0-2026-05-10.json');

function loadPinnedSpec(): any {
  return JSON.parse(fs.readFileSync(specPath, 'utf8'));
}

describe('pinned Etsy OpenAPI snapshot contracts', () => {
  const spec = loadPinnedSpec();

  it('pins the expected Etsy OpenAPI v3 snapshot metadata', () => {
    expect(spec.openapi).toBe('3.0.2');
    expect(spec.info).toEqual(expect.objectContaining({
      title: 'Etsy Open API v3',
      version: '3.0.0'
    }));
    expect(Object.keys(spec.paths ?? {})).toHaveLength(74);
  });

  it('keeps the x-api-key header requirement visible in the local contract', () => {
    const apiKeyScheme = spec.components.securitySchemes.api_key;

    expect(apiKeyScheme).toEqual(expect.objectContaining({
      type: 'apiKey',
      name: 'x-api-key',
      in: 'header'
    }));
    expect(apiKeyScheme.description).toContain('keystring:shared_secret');
    expect(spec.security).toContainEqual({ api_key: [] });

    const operations = [
      spec.paths['/v3/application/shops/{shop_id}/listings/{listing_id}'].patch,
      spec.paths['/v3/application/listings/{listing_id}/inventory'].put,
      spec.paths['/v3/application/shops/{shop_id}/listings/{listing_id}/personalization'].post
    ];

    for (const operation of operations) {
      expect(operation.security).toEqual(expect.arrayContaining([
        expect.objectContaining({ api_key: [] })
      ]));
    }
  });

  it('documents that listing updates are PATCH with form-url-encoded fields', () => {
    const listingPath = spec.paths['/v3/application/shops/{shop_id}/listings/{listing_id}'];
    expect(Object.keys(listingPath).sort()).toEqual(['patch']);

    const operation = listingPath.patch;
    const content = operation.requestBody.content;
    const schema = content['application/x-www-form-urlencoded'].schema;

    expect(operation.operationId).toBe('updateListing');
    expect(operation.description).toContain('PATCH method type');
    expect(content['application/json']).toBeUndefined();
    expect(schema.type).toBe('object');
    expect(schema.required).toBeUndefined();
    expect(schema.properties.title).toEqual(expect.objectContaining({ type: 'string' }));
    expect(schema.properties.description).toEqual(expect.objectContaining({ type: 'string' }));
    expect(schema.properties.state).toEqual(expect.objectContaining({
      type: 'string',
      enum: ['active', 'inactive']
    }));
    expect(schema.properties.is_personalizable.description).toContain('[DEPRECATED]');
    expect(schema.properties.personalization_instructions.description).toContain('[DEPRECATED]');
    expect(schema.properties.price).toBeUndefined();
    expect(schema.properties.quantity).toBeUndefined();
  });

  it('pins inventory price-update behavior to JSON inventory offerings', () => {
    const operation = spec.paths['/v3/application/listings/{listing_id}/inventory'].put;
    const schema = operation.requestBody.content['application/json'].schema;
    const products = schema.properties.products;
    const product = products.items;
    const offerings = product.properties.offerings;
    const offering = offerings.items;

    expect(operation.operationId).toBe('updateListingInventory');
    expect(operation.description).toContain('assign a float equal to amount divided by divisor');
    expect(schema.required).toEqual(['products']);
    expect(products).toEqual(expect.objectContaining({ type: 'array' }));
    expect(product.required).toContain('offerings');
    expect(offering.required).toEqual(expect.arrayContaining([
      'price',
      'quantity',
      'is_enabled',
      'readiness_state_id'
    ]));
    expect(offering.properties.price).toEqual(expect.objectContaining({
      type: 'number',
      format: 'float'
    }));
    expect(schema.properties.price_on_property.items.type).toBe('integer');
  });

  it('pins the multi-question personalization request shape', () => {
    const operation = spec.paths['/v3/application/shops/{shop_id}/listings/{listing_id}/personalization'].post;
    const supportsMultiple = operation.parameters.find(
      (parameter: { name?: string }) => parameter.name === 'supports_multiple_personalization_questions'
    );
    const schema = operation.requestBody.content['application/json'].schema;
    const questions = schema.properties.personalization_questions;
    const question = questions.items;

    expect(operation.operationId).toBe('updateListingPersonalization');
    expect(supportsMultiple).toEqual(expect.objectContaining({
      in: 'query',
      required: false,
      schema: expect.objectContaining({ type: 'boolean', nullable: true })
    }));
    expect(supportsMultiple.description).toContain('up to 5 personalization questions');
    expect(supportsMultiple.description).toContain('text_input');
    expect(schema.required).toEqual(['personalization_questions']);
    expect(questions.type).toBe('array');
    expect(question.required).toEqual(['question_text', 'question_type', 'required']);
    expect(question.properties.question_type.enum).toEqual([
      'text_input',
      'dropdown',
      'unlabeled_upload',
      'labeled_upload'
    ]);
    expect(question.properties.max_allowed_files).toEqual(expect.objectContaining({
      type: 'integer',
      nullable: true
    }));
    expect(question.properties.options.items.required).toEqual(['label']);
  });
});
