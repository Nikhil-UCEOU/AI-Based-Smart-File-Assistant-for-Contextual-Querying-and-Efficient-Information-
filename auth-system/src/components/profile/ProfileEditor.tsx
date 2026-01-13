import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { profileService, ProfileUpdateRequest } from '../../services/profileService';
import ProfilePictureUpload from './ProfilePictureUpload';
import ColorfulInput from '../ui/ColorfulInput';

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const EditorContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
`;

const EditorCard = styled.div`
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  animation: ${fadeInUp} 0.6s ease-out;
`;

const EditorHeader = styled.div`
  text-align: center;
  margin-bottom: 40px;
`;

const EditorTitle = styled.h2`
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const EditorSubtitle = styled.p`
  color: #6b7280;
  font-size: 1rem;
  margin: 0;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 40px;
  margin-bottom: 40px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 30px;
  }
`;

const FormSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const PictureSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const SectionTitle = styled.h3`
  font-size: 1.25rem;
  font-weight: 700;
  color: #374151;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 100px;
  padding: 12px 16px;
  border: 2px solid rgba(79, 172, 254, 0.2);
  border-radius: 12px;
  font-size: 1rem;
  font-family: inherit;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: #4facfe;
    box-shadow: 0 0 0 3px rgba(79, 172, 254, 0.1);
    background: rgba(255, 255, 255, 0.95);
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
`;

const SaveButton = styled.button<{ loading?: boolean }>`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  color: white;
  padding: 12px 32px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 140px;
  justify-content: center;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const CancelButton = styled.button`
  background: rgba(107, 114, 128, 0.1);
  border: 2px solid rgba(107, 114, 128, 0.3);
  color: #374151;
  padding: 12px 32px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(107, 114, 128, 0.2);
    transform: translateY(-2px);
  }
`;

const ResetButton = styled.button`
  background: rgba(239, 68, 68, 0.1);
  border: 2px solid rgba(239, 68, 68, 0.3);
  color: #dc2626;
  padding: 12px 32px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(239, 68, 68, 0.2);
    transform: translateY(-2px);
  }
`;

const ErrorMessage = styled.div`
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.875rem;
  margin-bottom: 20px;
`;

const SuccessMessage = styled.div`
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.875rem;
  margin-bottom: 20px;
`;

interface ProfileEditorProps {
  user: any; // Will match the User type from auth context
  onSave: (updates: ProfileUpdateRequest) => Promise<void>;
  onCancel: () => void;
  onPictureUpload: (file: File) => Promise<string>;
  onPictureRemove: () => Promise<void>;
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({
  user,
  onSave,
  onCancel,
  onPictureUpload,
  onPictureRemove
}) => {
  const [formData, setFormData] = useState<ProfileUpdateRequest>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    displayName: user?.displayName || '',
    bio: user?.bio || '',
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Check if form data has changed from original user data
    const hasFormChanges = 
      formData.firstName !== (user?.firstName || '') ||
      formData.lastName !== (user?.lastName || '') ||
      formData.email !== (user?.email || '') ||
      formData.displayName !== (user?.displayName || '') ||
      formData.bio !== (user?.bio || '');
    
    setHasChanges(hasFormChanges);
  }, [formData, user]);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleInputChange = (field: keyof ProfileUpdateRequest, value: string) => {
    clearMessages();
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    // Validate form data
    const validation = profileService.validateProfileData(formData);
    if (!validation.isValid) {
      setError(validation.errors.join(', '));
      return;
    }

    setLoading(true);

    try {
      // Only send changed fields
      const updates: ProfileUpdateRequest = {};
      
      if (formData.firstName !== (user?.firstName || '')) {
        updates.firstName = formData.firstName;
      }
      if (formData.lastName !== (user?.lastName || '')) {
        updates.lastName = formData.lastName;
      }
      if (formData.email !== (user?.email || '')) {
        updates.email = formData.email;
      }
      if (formData.displayName !== (user?.displayName || '')) {
        updates.displayName = formData.displayName;
      }
      if (formData.bio !== (user?.bio || '')) {
        updates.bio = formData.bio;
      }

      if (Object.keys(updates).length === 0) {
        setError('No changes to save');
        return;
      }

      await onSave(updates);
      setSuccess('Profile updated successfully!');
      setHasChanges(false);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);

    } catch (error: any) {
      setError(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      displayName: user?.displayName || '',
      bio: user?.bio || '',
    });
    clearMessages();
  };

  return (
    <EditorContainer>
      <EditorCard>
        <EditorHeader>
          <EditorTitle>✏️ Edit Profile</EditorTitle>
          <EditorSubtitle>
            Update your personal information and profile picture
          </EditorSubtitle>
        </EditorHeader>

        {error && <ErrorMessage>{error}</ErrorMessage>}
        {success && <SuccessMessage>{success}</SuccessMessage>}

        <form onSubmit={handleSubmit}>
          <FormGrid>
            <FormSection>
              <SectionTitle>📝 Personal Information</SectionTitle>
              
              <FormRow>
                <ColorfulInput
                  label="First Name"
                  type="text"
                  value={formData.firstName || ''}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  placeholder="Enter your first name"
                  required
                />
                
                <ColorfulInput
                  label="Last Name"
                  type="text"
                  value={formData.lastName || ''}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  placeholder="Enter your last name"
                  required
                />
              </FormRow>

              <ColorfulInput
                label="Email Address"
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="Enter your email address"
                required
              />

              <ColorfulInput
                label="Display Name (Optional)"
                type="text"
                value={formData.displayName || ''}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                placeholder="How others will see your name"
              />

              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600', 
                  color: '#374151' 
                }}>
                  Bio (Optional)
                </label>
                <TextArea
                  value={formData.bio || ''}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="Tell us a bit about yourself..."
                  maxLength={500}
                />
                <div style={{ 
                  textAlign: 'right', 
                  fontSize: '0.75rem', 
                  color: '#9ca3af', 
                  marginTop: '4px' 
                }}>
                  {(formData.bio || '').length}/500 characters
                </div>
              </div>
            </FormSection>

            <PictureSection>
              <SectionTitle>📷 Profile Picture</SectionTitle>
              <ProfilePictureUpload
                currentPicture={user?.profilePictureUrl}
                onUpload={onPictureUpload}
                onRemove={onPictureRemove}
              />
            </PictureSection>
          </FormGrid>

          <ActionButtons>
            <SaveButton type="submit" disabled={loading || !hasChanges} loading={loading}>
              {loading ? '⏳ Saving...' : '💾 Save Changes'}
            </SaveButton>
            
            <CancelButton type="button" onClick={onCancel}>
              ❌ Cancel
            </CancelButton>
            
            <ResetButton type="button" onClick={handleReset}>
              🔄 Reset
            </ResetButton>
          </ActionButtons>
        </form>
      </EditorCard>
    </EditorContainer>
  );
};

export default ProfileEditor;