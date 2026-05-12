export const getFileName = (filePath: string | null | undefined): string => {
  if (!filePath) return '';
  return filePath.replace(/\\/g, '/').split('/').pop() || '';
};
export const normalizePath = (path: string | null | undefined) => {
  if (!path) return '';
  let normalizedPath = path.replace(/\\/g, '/');
  if (normalizedPath.endsWith('/') && normalizedPath.length > 1) {
    normalizedPath = normalizedPath.slice(0, -1);
  }
  return normalizedPath;
};
export const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
export const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '--';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
export const formatDate = (isoString: string): string => {
  if (!isoString) return '--';
  try { return new Date(isoString).toLocaleDateString(); } catch { return '--'; }
};
export const getHomeDir = async (): Promise<string> => window.api.getHomeDir();
