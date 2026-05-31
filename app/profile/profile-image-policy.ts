type BrowserFileMetadata = {
  name: string;
  type: string;
  size: number;
};

export const PROFILE_IMAGE_UPLOAD_MAX_BYTES = 300_000;
export const PROFILE_IMAGE_CANVAS_MAX_SIZE = 512;
export const PROFILE_IMAGE_WEBP_MIME_TYPE = 'image/webp';
export const PROFILE_IMAGE_WEBP_QUALITIES = [0.88, 0.82, 0.76, 0.7, 0.64] as const;

export type ProfileImagePolicyPayload = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
};

export function createProfileImagePolicyPayload(file: BrowserFileMetadata): ProfileImagePolicyPayload {
  return {
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  };
}

export function getProfileImageWebpFilename(filename: string): string {
  const trimmedFilename = filename.trim();
  if (!trimmedFilename) return 'profile-image.webp';

  const slashIndex = Math.max(trimmedFilename.lastIndexOf('/'), trimmedFilename.lastIndexOf('\\'));
  const basename = trimmedFilename.slice(slashIndex + 1);
  const dotIndex = basename.lastIndexOf('.');
  const stem = dotIndex > 0 ? basename.slice(0, dotIndex) : basename;
  return `${stem || 'profile-image'}.webp`;
}
