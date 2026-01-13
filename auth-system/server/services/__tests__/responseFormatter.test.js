const responseFormatter = require('../responseFormatter');

describe('ResponseFormatter', () => {
  const mockContextBlocks = [
    {
      source: 'contract.pdf',
      chunkIndex: 1,
      score: 0.95,
      text: 'This is a sample contract clause about payment terms.',
      fileType: 'PDF',
      metadata: { date: '2024-01-15' }
    },
    {
      source: 'policy.docx',
      chunkIndex: 2,
      score: 0.87,
      text: 'Company policy states that all employees must follow guidelines.',
      fileType: 'DOCX',
      metadata: { uploadDate: '2024-01-20' }
    }
  ];

  test('should format legal response with all required sections', () => {
    const aiResponse = 'Based on the documents, payment terms are clearly defined.';
    const result = responseFormatter.formatLegalResponse(aiResponse, mockContextBlocks);
    
    expect(result).toContain('RELEVANT LEGAL PROVISIONS:');
    expect(result).toContain('LEGAL SUMMARY:');
    expect(result).toContain('CITATIONS & SOURCES:');
    expect(result).toContain('⚖️ Legal Disclaimer:');
  });

  test('should format citations with Resource: filename format', () => {
    const citations = responseFormatter.formatCitations(mockContextBlocks);
    
    expect(citations).toContain('Resource: contract.pdf');
    expect(citations).toContain('Resource: policy.docx');
    expect(citations).toContain('Chunk 1');
    expect(citations).toContain('Chunk 2');
  });

  test('should handle date extraction correctly', () => {
    const citations = responseFormatter.formatCitations(mockContextBlocks);
    
    expect(citations).toContain('2024-01-15');
    expect(citations).toContain('2024-01-20');
  });

  test('should validate response structure', () => {
    const validResponse = `RELEVANT LEGAL PROVISIONS:
Test provision

LEGAL SUMMARY:
Test summary

CITATIONS & SOURCES:
Test citation

⚖️ Legal Disclaimer: This information is for research purposes only. I am not a licensed attorney, and this does not constitute legal advice.`;

    const validation = responseFormatter.validateResponseStructure(validResponse);
    expect(validation.isValid).toBe(true);
    expect(validation.hasProvisions).toBe(true);
    expect(validation.hasSummary).toBe(true);
    expect(validation.hasCitations).toBe(true);
    expect(validation.hasDisclaimer).toBe(true);
  });

  test('should format error responses professionally', () => {
    const errorResponse = responseFormatter.formatErrorResponse(
      'No documents found',
      'Please upload relevant documents'
    );
    
    expect(errorResponse).toContain('RELEVANT LEGAL PROVISIONS:');
    expect(errorResponse).toContain('No documents found');
    expect(errorResponse).toContain('Please upload relevant documents');
    expect(errorResponse).toContain('⚖️ Legal Disclaimer:');
  });
});