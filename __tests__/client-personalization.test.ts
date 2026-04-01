/**
 * EtsyClient Personalization tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupClientMocks, MockClientContext, createMockResponse, create204Response } from './helpers/client-test-setup';

describe('EtsyClient Personalization', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = setupClientMocks();
  });

  describe('getListingPersonalizations', () => {
    it('should get personalizations for a listing', async () => {
      const mockPersonalization = {
        personalization_questions: [
          {
            question_id: 1,
            question_type: 'text_input',
            question_text: 'What name should be engraved?',
            instructions: 'Enter up to 20 characters',
            required: true,
            max_allowed_characters: 20,
            max_allowed_files: null,
            options: null
          }
        ]
      };

      ctx.mockFetch.mockResolvedValue(createMockResponse(mockPersonalization));

      const result = await ctx.client.getListingPersonalizations('123');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/listings/123/personalization',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
            'x-api-key': 'test-api-key:test-shared-secret'
          })
        })
      );
      expect(result).toEqual(mockPersonalization);
    });
  });

  describe('updateListingPersonalization', () => {
    it('should send JSON body with personalization_questions array', async () => {
      const mockResponse = {
        personalization_questions: [
          {
            question_id: 1,
            question_type: 'text_input',
            question_text: 'Custom Text',
            instructions: 'Enter text',
            required: true,
            max_allowed_characters: 50,
            max_allowed_files: null,
            options: null
          }
        ]
      };

      ctx.mockFetch.mockResolvedValue(createMockResponse(mockResponse));

      const result = await ctx.client.updateListingPersonalization('shop-123', 'listing-456', {
        personalization_questions: [
          {
            question_type: 'text_input',
            question_text: 'Custom Text',
            instructions: 'Enter text',
            required: true,
            max_allowed_characters: 50
          }
        ]
      });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/shop-123/listings/listing-456/personalization',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );

      // Verify JSON body structure
      const body = JSON.parse(ctx.mockFetch.mock.calls[0]![1].body);
      expect(body).toEqual({
        personalization_questions: [
          {
            question_type: 'text_input',
            question_text: 'Custom Text',
            instructions: 'Enter text',
            required: true,
            max_allowed_characters: 50
          }
        ]
      });
      expect(result).toEqual(mockResponse);
    });

    it('should support dropdown questions with options', async () => {
      const mockResponse = {
        personalization_questions: [
          {
            question_id: 2,
            question_type: 'dropdown',
            question_text: 'Choose a color',
            instructions: null,
            required: true,
            max_allowed_characters: null,
            max_allowed_files: null,
            options: [
              { option_id: 1, label: 'Red' },
              { option_id: 2, label: 'Blue' }
            ]
          }
        ]
      };

      ctx.mockFetch.mockResolvedValue(createMockResponse(mockResponse));

      const result = await ctx.client.updateListingPersonalization('shop-123', 'listing-456', {
        personalization_questions: [
          {
            question_type: 'dropdown',
            question_text: 'Choose a color',
            required: true,
            options: [
              { label: 'Red' },
              { label: 'Blue' }
            ]
          }
        ]
      });

      const body = JSON.parse(ctx.mockFetch.mock.calls[0]![1].body);
      expect(body.personalization_questions[0].options).toEqual([
        { label: 'Red' },
        { label: 'Blue' }
      ]);
      expect(result.personalization_questions[0]!.question_type).toBe('dropdown');
    });

    it('should append query param when supports_multiple_personalization_questions is true', async () => {
      ctx.mockFetch.mockResolvedValue(createMockResponse({ personalization_questions: [] }));

      await ctx.client.updateListingPersonalization('shop-123', 'listing-456', {
        personalization_questions: [
          { question_type: 'text_input', question_text: 'Q1', required: true },
          { question_type: 'text_input', question_text: 'Q2', required: false }
        ],
        supports_multiple_personalization_questions: true
      });

      const url = ctx.mockFetch.mock.calls[0]![0];
      expect(url).toContain('?supports_multiple_personalization_questions=true');

      // Verify the query param is NOT in the JSON body
      const body = JSON.parse(ctx.mockFetch.mock.calls[0]![1].body);
      expect(body).not.toHaveProperty('supports_multiple_personalization_questions');
      expect(body.personalization_questions).toHaveLength(2);
    });

    it('should support updating existing questions by including question_id', async () => {
      ctx.mockFetch.mockResolvedValue(createMockResponse({ personalization_questions: [] }));

      await ctx.client.updateListingPersonalization('shop-123', 'listing-456', {
        personalization_questions: [
          {
            question_id: 42,
            question_type: 'text_input',
            question_text: 'Updated question',
            required: true
          }
        ]
      });

      const body = JSON.parse(ctx.mockFetch.mock.calls[0]![1].body);
      expect(body.personalization_questions[0].question_id).toBe(42);
    });
  });

  describe('deleteListingPersonalization', () => {
    it('should delete personalization for a listing', async () => {
      ctx.mockFetch.mockResolvedValue(create204Response());

      await ctx.client.deleteListingPersonalization('shop-123', 'listing-456');

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/shop-123/listings/listing-456/personalization',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });
});
