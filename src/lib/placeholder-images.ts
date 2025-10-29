import data from './placeholder-images.json';

export type ImagePlaceholder = {
  id: string;
  description: string;
  imageUrl: string;
  imageHint: string;
  // Add properties from Firestore images to make types compatible
  originalName?: string;
  directUrl?: string;
  userId?: string;
  likeCount: number; // Make this required
};

// Map over the raw data to add the default likeCount
export const PlaceHolderImages: ImagePlaceholder[] = data.placeholderImages.map(img => ({
  ...img,
  likeCount: 0,
}));
