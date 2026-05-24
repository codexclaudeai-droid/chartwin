type BrowserFileMetadata = {
  name: string;
  type: string;
  size: number;
};

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
