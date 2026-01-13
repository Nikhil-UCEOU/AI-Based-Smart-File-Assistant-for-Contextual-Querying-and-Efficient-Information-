import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import AnimatedBackground from '../components/ui/AnimatedBackground';
import ColorfulCard from '../components/ui/ColorfulCard';
import { PrimaryButton, SecondaryButton } from '../components/ui/Button';
import ColorfulInput from '../components/ui/ColorfulInput';
import { documentService, SearchResult, Document } from '../services/documentService';

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const PageContainer = styled.div`
  min-height: 100vh;
  padding: 40px 20px;
  position: relative;
`;

const PageContent = styled.div`
  max-width: 1000px;
  margin: 0 auto;
  position: relative;
  z-index: 10;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 40px;
  animation: ${fadeInUp} 1s ease-out;
`;

const PageTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const PageSubtitle = styled.p`
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.1rem;
  font-weight: 500;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
`;

const SearchSection = styled(ColorfulCard)`
  animation: ${fadeInUp} 1s ease-out 0.2s both;
  margin-bottom: 30px;
`;

const SearchForm = styled.form`
  display: flex;
  gap: 15px;
  align-items: flex-end;
  margin-bottom: 20px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const SearchInputWrapper = styled.div`
  flex: 1;
`;

const SearchButton = styled(PrimaryButton)<{ isSearching: boolean }>`
  min-width: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  ${props => props.isSearching && `
    pointer-events: none;
    opacity: 0.8;
  `}
`;

const SearchIcon = styled.div<{ isSearching: boolean }>`
  font-size: 1.2rem;
  animation: ${props => props.isSearching ? spin : 'none'} 1s linear infinite;
`;

const ResultsSection = styled(ColorfulCard)`
  animation: ${fadeInUp} 1s ease-out 0.4s both;
`;

const ResultsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const ResultItem = styled.div`
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
  }
`;

const ResultHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
  gap: 15px;
`;

const ResultInfo = styled.div`
  flex: 1;
`;

const ResultTitle = styled.h3`
  color: rgba(255, 255, 255, 0.95);
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ResultMeta = styled.div`
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.9rem;
  margin-bottom: 10px;
`;

const ScoreIndicator = styled.div<{ score: number }>`
  background: ${props => {
    if (props.score > 0.8) return 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
    if (props.score > 0.6) return 'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)';
    return 'linear-gradient(135deg, #6c757d 0%, #495057 100%)';
  }};
  color: white;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  min-width: 80px;
  text-align: center;
`;

const ChunkInfo = styled.div`
  background: rgba(79, 172, 254, 0.1);
  border: 1px solid rgba(79, 172, 254, 0.3);
  border-radius: 8px;
  padding: 10px 15px;
  margin: 10px 0;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.8);
`;

const ChunkList = styled.div`
  margin: 15px 0;
`;

const ChunkItem = styled.div`
  background: rgba(0, 0, 0, 0.2);
  border-left: 4px solid #4facfe;
  padding: 12px 15px;
  margin: 8px 0;
  border-radius: 0 8px 8px 0;
`;

const ChunkScore = styled.span<{ score: number }>`
  background: ${props => {
    if (props.score > 0.8) return '#28a745';
    if (props.score > 0.6) return '#ffc107';
    return '#6c757d';
  }};
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-right: 10px;
`;

const ChunkText = styled.div`
  color: rgba(255, 255, 255, 0.95);
  font-size: 0.9rem;
  line-height: 1.4;
  margin-top: 8px;
`;

const ResultActions = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 15px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.7);
`;

const EmptyIcon = styled.div`
  font-size: 4rem;
  margin-bottom: 20px;
`;

const EmptyText = styled.p`
  font-size: 1.1rem;
  font-weight: 500;
`;

const BackButton = styled(SecondaryButton)`
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 20;
`;

const DocumentSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userDocuments, setUserDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [documentSearchTerm, setDocumentSearchTerm] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);

  // Handle URL query parameters for direct search
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const urlQuery = urlParams.get('q');
    
    if (urlQuery && urlQuery.trim()) {
      setQuery(urlQuery.trim());
      // Automatically perform search if query is provided in URL
      performSearch(urlQuery.trim());
    }
  }, [location.search]);

  // Load user documents on component mount
  useEffect(() => {
    loadUserDocuments();
  }, []);

  // Filter documents based on search term
  useEffect(() => {
    if (documentSearchTerm.trim()) {
      const filtered = userDocuments.filter(doc => 
        doc.originalName.toLowerCase().includes(documentSearchTerm.toLowerCase()) ||
        doc.fileType.toLowerCase().includes(documentSearchTerm.toLowerCase())
      );
      setFilteredDocuments(filtered);
    } else {
      setFilteredDocuments(userDocuments);
    }
  }, [documentSearchTerm, userDocuments]);

  const loadUserDocuments = async () => {
    try {
      setIsLoadingDocuments(true);
      const response = await documentService.getUserDocuments();
      
      if (response && response.documents) {
        setUserDocuments(response.documents);
        setFilteredDocuments(response.documents);
      } else {
        setUserDocuments([]);
        setFilteredDocuments([]);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
      setError('Failed to load documents. Please try refreshing the page.');
      setUserDocuments([]);
      setFilteredDocuments([]);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    setIsSearching(true);
    setError(null);
    
    try {
      // First, try AI-powered content search
      let aiResults: SearchResult[] = [];
      try {
        const response = await documentService.searchDocuments(searchQuery.trim(), 10);
        aiResults = response.results || [];
      } catch (aiError) {
        console.warn('AI search failed, falling back to filename search:', aiError);
      }

      // Also search by filename in user documents as fallback/supplement
      const filenameMatches = userDocuments.filter(doc => 
        doc.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.fileType.toLowerCase().includes(searchQuery.toLowerCase())
      );

      // Convert filename matches to search result format
      const filenameResults: SearchResult[] = filenameMatches.map(doc => ({
        fileName: doc.originalName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        uploadDate: doc.createdAt,
        maxScore: 0.9, // High score for exact filename matches
        avgScore: 0.9,
        totalChunks: 1,
        topChunks: [{
          score: 0.9,
          chunkIndex: 0,
          textPreview: `Document: ${doc.originalName} (${doc.fileType})`,
          fullText: `Document: ${doc.originalName}`,
          wordCount: doc.originalName.split(' ').length
        }],
        document: doc
      }));

      // Combine results, prioritizing AI results but including filename matches
      const combinedResults: SearchResult[] = [...aiResults];
      
      // Add filename matches that aren't already in AI results
      filenameResults.forEach(filenameResult => {
        const alreadyExists = aiResults.some(aiResult => 
          aiResult.fileName === filenameResult.fileName
        );
        if (!alreadyExists) {
          combinedResults.push(filenameResult);
        }
      });

      setSearchResults(combinedResults);
      setHasSearched(true);
    } catch (error: any) {
      setError(error.message || 'Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [userDocuments]);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await performSearch(query);
  }, [query, performSearch]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf': return '📄';
      case 'docx': return '📝';
      case 'html': return '🌐';
      case 'txt': return '📃';
      default: return '📄';
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await documentService.deleteDocument(documentId);
      await loadUserDocuments(); // Reload documents after deletion
    } catch (error: any) {
      setError(error.message || 'Failed to delete document');
    }
  };

  const handleDocumentPreview = async (document: Document) => {
    try {
      const content = await documentService.getDocumentContent(document.id);
      setSelectedDocument({ ...document, extractedText: content.content });
    } catch (error) {
      setError('Failed to load document content');
    }
  };

  return (
    <PageContainer>
      <AnimatedBackground />
      <BackButton onClick={() => navigate('/dashboard')}>
        ← Back to Dashboard
      </BackButton>
      
      <PageContent>
        <Header>
          <PageTitle>🔍 Search Documents</PageTitle>
          <PageSubtitle>
            Find information across all your uploaded documents using AI-powered search
          </PageSubtitle>
        </Header>

        <SearchSection
          title="Search Your Documents"
          variant="primary"
          titleColor="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
        >
          <SearchForm onSubmit={handleSearch}>
            <SearchInputWrapper>
              <ColorfulInput
                label="What are you looking for?"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g., project requirements, budget analysis, meeting notes..."
                disabled={isSearching}
              />
            </SearchInputWrapper>
            <SearchButton 
              type="submit" 
              isSearching={isSearching}
              disabled={isSearching || !query.trim()}
            >
              <SearchIcon isSearching={isSearching}>
                {isSearching ? '⏳' : '🔍'}
              </SearchIcon>
              {isSearching ? 'Searching...' : 'Search'}
            </SearchButton>
          </SearchForm>

          {error && (
            <div style={{ 
              color: '#dc3545', 
              background: 'rgba(220, 53, 69, 0.1)', 
              padding: '12px 16px', 
              borderRadius: '8px',
              border: '1px solid rgba(220, 53, 69, 0.3)',
              marginTop: '15px'
            }}>
              {error}
            </div>
          )}
        </SearchSection>

        {hasSearched && (
          <ResultsSection
            title={`Search Results (${searchResults.length} documents found)`}
            variant="success"
            titleColor="linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
          >
            {searchResults.length > 0 ? (
              <ResultsList>
                {searchResults.map((result, index) => (
                  <ResultItem key={index}>
                    <ResultHeader>
                      <ResultInfo>
                        <ResultTitle>
                          {getFileIcon(result.fileType)}
                          {result.fileName}
                        </ResultTitle>
                        <ResultMeta>
                          {result.fileType} • {formatFileSize(result.fileSize)} • 
                          Uploaded {formatDate(result.uploadDate)}
                        </ResultMeta>
                      </ResultInfo>
                      <ScoreIndicator score={result.maxScore}>
                        {Math.round(result.maxScore * 100)}% match
                      </ScoreIndicator>
                    </ResultHeader>
                    
                    <ChunkInfo>
                      📊 Found {result.totalChunks} relevant sections • 
                      Average relevance: {Math.round(result.avgScore * 100)}%
                      {result.maxScore >= 0.9 && result.totalChunks === 1 ? ' • 📝 Filename match' : ' • 🤖 AI content search'}
                    </ChunkInfo>

                    <ChunkList>
                      {result.topChunks.map((chunk, chunkIndex) => (
                        <ChunkItem key={chunkIndex}>
                          <div>
                            <ChunkScore score={chunk.score}>
                              {Math.round(chunk.score * 100)}%
                            </ChunkScore>
                            Section {chunk.chunkIndex} • {chunk.wordCount} words
                          </div>
                          <ChunkText>
                            {chunk.textPreview}
                            {chunk.textPreview.length >= 200 && '...'}
                          </ChunkText>
                        </ChunkItem>
                      ))}
                    </ChunkList>

                    <ResultActions>
                      {result.document && (
                        <PrimaryButton 
                          variant="secondary"
                          onClick={() => navigate(`/documents/${result.document!.id}`)}
                        >
                          View Full Document
                        </PrimaryButton>
                      )}
                    </ResultActions>
                  </ResultItem>
                ))}
              </ResultsList>
            ) : (
              <EmptyState>
                <EmptyIcon>🔍</EmptyIcon>
                <EmptyText>
                  No documents found matching "{query}". Try different keywords or upload more documents.
                </EmptyText>
              </EmptyState>
            )}
          </ResultsSection>
        )}

        {!hasSearched && (
          <ResultsSection
            title="Getting Started"
            variant="warning"
            titleColor="linear-gradient(135deg, #ff6b6b 0%, #ffa726 100%)"
          >
            <EmptyState>
              <EmptyIcon>💡</EmptyIcon>
              <EmptyText>
                Enter a search query above to find information across all your uploaded documents.
                Our AI will analyze the content and return the most relevant results.
              </EmptyText>
            </EmptyState>
          </ResultsSection>
        )}

        {/* Your Documents Section */}
        <ResultsSection
          title={`📚 Your Documents (${filteredDocuments.length})`}
          variant="success"
          titleColor="linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
        >
          {/* Document Search */}
          <SearchForm onSubmit={(e) => e.preventDefault()}>
            <SearchInputWrapper>
              <ColorfulInput
                label="Search your documents by name"
                type="text"
                value={documentSearchTerm}
                onChange={(e) => setDocumentSearchTerm(e.target.value)}
                placeholder="Type document name to filter..."
              />
            </SearchInputWrapper>
          </SearchForm>

          {isLoadingDocuments ? (
            <EmptyState>
              <EmptyIcon>⏳</EmptyIcon>
              <EmptyText>Loading your documents...</EmptyText>
            </EmptyState>
          ) : filteredDocuments.length > 0 ? (
            <ResultsList>
              {filteredDocuments.map((doc) => (
                <ResultItem key={doc.id}>
                  <ResultHeader>
                    <ResultInfo>
                      <ResultTitle>
                        {getFileIcon(doc.fileType)}
                        {doc.originalName}
                      </ResultTitle>
                      <ResultMeta>
                        {doc.fileType} • {formatFileSize(doc.fileSize)} • 
                        Uploaded {formatDate(doc.createdAt)}
                        {doc.chunkCount > 0 && ` • ${doc.chunkCount} chunks`}
                      </ResultMeta>
                    </ResultInfo>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {doc.uploadStatus === 'completed' && (
                        <ScoreIndicator score={1}>
                          ✅ Ready
                        </ScoreIndicator>
                      )}
                      {doc.uploadStatus === 'processing' && (
                        <ScoreIndicator score={0.5}>
                          🔄 Processing
                        </ScoreIndicator>
                      )}
                    </div>
                  </ResultHeader>
                  
                  {doc.processingTime > 0 && (
                    <ChunkInfo>
                      ⏱️ Processing time: {doc.processingTime < 1000 ? `${doc.processingTime}ms` : `${(doc.processingTime / 1000).toFixed(2)}s`} • 
                      🤖 Model: {doc.embeddingModel || 'Default'} • 
                      📏 Chunk size: {doc.chunkSize || 1000}
                    </ChunkInfo>
                  )}

                  <ResultActions>
                    <PrimaryButton 
                      variant="secondary"
                      onClick={() => handleDocumentPreview(doc)}
                    >
                      👁️ Preview
                    </PrimaryButton>
                    <PrimaryButton 
                      variant="secondary"
                      onClick={() => navigate('/chat')}
                    >
                      💬 Chat
                    </PrimaryButton>
                    <SecondaryButton 
                      onClick={() => handleDeleteDocument(doc.id)}
                    >
                      🗑️ Delete
                    </SecondaryButton>
                  </ResultActions>
                </ResultItem>
              ))}
            </ResultsList>
          ) : (
            <EmptyState>
              <EmptyIcon>📄</EmptyIcon>
              <EmptyText>
                {documentSearchTerm 
                  ? `No documents found matching "${documentSearchTerm}"`
                  : userDocuments.length === 0 
                    ? 'No documents uploaded yet. Upload documents to start searching!'
                    : 'No documents to display.'
                }
              </EmptyText>
              {!documentSearchTerm && userDocuments.length === 0 && (
                <div style={{ marginTop: '20px' }}>
                  <PrimaryButton 
                    onClick={() => navigate('/upload')}
                  >
                    📤 Upload Documents
                  </PrimaryButton>
                </div>
              )}
            </EmptyState>
          )}
        </ResultsSection>

        {/* Document Preview Modal */}
        {selectedDocument && (
          <ResultsSection
            title="📄 Document Preview"
            variant="secondary"
            titleColor="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          >
            <ResultItem>
              <ResultHeader>
                <ResultInfo>
                  <ResultTitle>
                    {getFileIcon(selectedDocument.fileType)}
                    {selectedDocument.originalName}
                  </ResultTitle>
                  <ResultMeta>
                    {selectedDocument.fileType} • {formatFileSize(selectedDocument.fileSize)} • 
                    {selectedDocument.chunkCount > 0 && `${selectedDocument.chunkCount} chunks • `}
                    Uploaded {formatDate(selectedDocument.createdAt)}
                  </ResultMeta>
                </ResultInfo>
                <SecondaryButton onClick={() => setSelectedDocument(null)}>
                  ✕ Close
                </SecondaryButton>
              </ResultHeader>
              
              <ChunkList>
                <ChunkItem>
                  <ChunkText style={{ 
                    maxHeight: '400px', 
                    overflow: 'auto',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '15px',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    lineHeight: '1.5'
                  }}>
                    {selectedDocument.extractedText?.substring(0, 2000) || 'Loading content...'}
                    {selectedDocument.extractedText && selectedDocument.extractedText.length > 2000 && '...'}
                  </ChunkText>
                </ChunkItem>
              </ChunkList>
            </ResultItem>
          </ResultsSection>
        )}
      </PageContent>
    </PageContainer>
  );
};

export default DocumentSearchPage;