import { useState, useCallback } from 'react';
import { message } from 'antd';
import { useTranslations } from 'next-intl';

interface UploadedFileInfo {
  fileName: string;
  fileContent: string;
}

const useFileUpload = () => {
  const t = useTranslations('Chat');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.txt,.md,.docx,.doc';
    input.multiple = false;

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        message.warning(t('fileSizeLimit'));
        return;
      }

      setIsProcessing(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/files', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          message.error(errorData.error || t('fileProcessingError'));
          return;
        }

        const result = await response.json();
        setUploadedFiles(prev => [...prev, {
          fileName: result.fileName,
          fileContent: result.fileContent,
        }]);
        message.success(t('fileProcessed'));
      } catch (error) {
        console.error('File upload error:', error);
        message.error(t('fileProcessingError'));
      } finally {
        setIsProcessing(false);
      }
    };

    input.click();
  }, [t]);

  const removeFile = useCallback((index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setUploadedFiles([]);
  }, []);

  return { uploadedFiles, isProcessing, handleFileUpload, removeFile, clearFiles, setUploadedFiles };
};

export default useFileUpload;