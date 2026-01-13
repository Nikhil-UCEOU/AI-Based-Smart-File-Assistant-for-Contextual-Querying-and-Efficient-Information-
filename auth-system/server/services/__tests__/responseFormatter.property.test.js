const fc = require('fast-check');
const responseFormatter = require('../responseFormatter');

describe('ResponseFormatter Property Tests', () => {
  
  // Simplified generator for context blocks
  const contextBlockArb = fc.record({
    source: fc.constantFrom('contract.pdf', 'policy.docx', 'manual.html', 'readme.txt'),
    chunkIndex: fc.integer({ min: 0, max: 10 }),
    score: fc.float({ min: 0.5, max: 1 }),
    text: fc.constantFrom(
      'This is a sample contract clause about payment terms.',
      'Company policy states that all employees must follow guidelines.',
      'The manual describes the proper procedures for handling documents.',
      'This readme file contains important information about the system.'
    ),
    fileType: fc.constantFrom('PDF', 'DOCX', 'HTML', 'TXT'),
    metadata: fc.record({
      date: fc.option(fc.constantFrom('2024-01-15', '2024-02-20', '2024-03-10')),
      uploadDate: fc.option(fc.constantFrom('2024-01-15T10:00:00Z', '2024-02-20T14:30:00Z'))
    })
  });

  const contextBlocksArb = fc.array(contextBlockArb, { minLength: 1, maxLength: 5 });

  // Property 1: Response Structure Consistency
  test('Property 1: Response Structure Consistency - Feature: enhanced-chat-responses, Property 1: For any chat query that returns document results, the formatted response should contain all required sections', () => {
    fc.assert(fc.property(
      contextBlocksArb,
      fc.string({ minLength: 10, maxLength: 100 }),
      (contextBlocks, aiResponse) => {
        const formattedResponse = responseFormatter.formatLegalResponse(aiResponse, contextBlocks);
        
        // All responses with context should have required sections
        expect(formattedResponse).toContain('RELEVANT LEGAL PROVISIONS:');
        expect(formattedResponse).toContain('LEGAL SUMMARY:');
        expect(formattedResponse).toContain('CITATIONS & SOURCES:');
        expect(formattedResponse).toContain('⚖️ Legal Disclaimer:');
        
        const validation = responseFormatter.validateResponseStructure(formattedResponse);
        expect(validation.isValid).toBe(true);
      }
    ), { numRuns: 50 });
  });

  // Property 2: Citation Format Consistency
  test('Property 2: Citation Format Consistency - Feature: enhanced-chat-responses, Property 2: For any response that includes document sources, all citations should follow the format "Resource: [filename]"', () => {
    fc.assert(fc.property(
      contextBlocksArb,
      (contextBlocks) => {
        const citations = responseFormatter.formatCitations(contextBlocks);
        
        // Each context block should have a corresponding citation
        contextBlocks.forEach(block => {
          expect(citations).toContain(`Resource: ${block.source}`);
          expect(citations).toContain(`Chunk ${block.chunkIndex}`);
        });
        
        // All citations should follow the format
        const citationLines = citations.split('\n').filter(line => line.trim());
        citationLines.forEach(line => {
          expect(line).toMatch(/^- Resource: .+\..+ \| Chunk \d+ \| .+$/);
        });
      }
    ), { numRuns: 50 });
  });

  // Property 3: Legal Disclaimer Inclusion
  test('Property 3: Legal Disclaimer Inclusion - Feature: enhanced-chat-responses, Property 3: For any chat response, the legal disclaimer should be present', () => {
    fc.assert(fc.property(
      contextBlocksArb,
      fc.string({ minLength: 10, maxLength: 100 }),
      (contextBlocks, aiResponse) => {
        const formattedResponse = responseFormatter.formatLegalResponse(aiResponse, contextBlocks);
        
        expect(formattedResponse).toContain('⚖️ Legal Disclaimer:');
        expect(formattedResponse).toContain('This information is for research purposes only');
        expect(formattedResponse).toContain('I am not a licensed attorney');
      }
    ), { numRuns: 50 });
  });

  // Property 4: Section Header Formatting
  test('Property 4: Section Header Formatting - Feature: enhanced-chat-responses, Property 4: For any formatted response, all section headers should be in uppercase format', () => {
    fc.assert(fc.property(
      contextBlocksArb,
      fc.string({ minLength: 10, maxLength: 100 }),
      (contextBlocks, aiResponse) => {
        const formattedResponse = responseFormatter.formatLegalResponse(aiResponse, contextBlocks);
        
        // Check that headers are in uppercase
        expect(formattedResponse).toContain('RELEVANT LEGAL PROVISIONS:');
        expect(formattedResponse).toContain('LEGAL SUMMARY:');
        expect(formattedResponse).toContain('CITATIONS & SOURCES:');
        
        // Ensure no lowercase versions exist
        expect(formattedResponse).not.toContain('relevant legal provisions:');
        expect(formattedResponse).not.toContain('legal summary:');
        expect(formattedResponse).not.toContain('citations & sources:');
      }
    ), { numRuns: 50 });
  });

  // Property 5: Error Response Structure
  test('Property 5: Error Response Structure - Feature: enhanced-chat-responses, Property 5: For any system error, the response should maintain professional format structure', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 5, maxLength: 100 }),
      fc.option(fc.string({ minLength: 5, maxLength: 100 })),
      (errorMessage, suggestion) => {
        const errorResponse = responseFormatter.formatErrorResponse(errorMessage, suggestion);
        
        // Even error responses should maintain structure
        expect(errorResponse).toContain('RELEVANT LEGAL PROVISIONS:');
        expect(errorResponse).toContain('LEGAL SUMMARY:');
        expect(errorResponse).toContain('CITATIONS & SOURCES:');
        expect(errorResponse).toContain('⚖️ Legal Disclaimer:');
        
        // Should contain the error message
        expect(errorResponse).toContain(errorMessage);
        
        const validation = responseFormatter.validateResponseStructure(errorResponse);
        expect(validation.isValid).toBe(true);
      }
    ), { numRuns: 50 });
  });
});