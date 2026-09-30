export type VideoStatus = 'processing' | 'completed' | 'failed';
export type AspectRatio = '16:9' | '9:16' | '1:1';
export type Plan = 'free' | 'pro' | 'studio';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  plan: Plan;
  credits: number;
  created_at: string;
}

export interface Video {
  id: string;
  user_id: string;
  title: string;
  prompt: string;
  style: string;
  status: VideoStatus;
  thumbnail_url: string;
  video_url: string;
  duration: number;
  aspect_ratio: AspectRatio;
  is_public: boolean;
  likes_count: number;
  views_count: number;
  model: string;
  created_at: string;
}

export interface VideoWithCreator extends Video {
  profiles?: Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url'>;
}

export interface GenerationParams {
  prompt: string;
  style: string;
  duration: number;
  aspect_ratio: AspectRatio;
  model: string;
  is_public: boolean;
}

export const VIDEO_STYLES = [
  { id: 'cinematic', label: 'Cinematic', icon: '🎬' },
  { id: 'cyberpunk', label: 'Cyberpunk', icon: '🌆' },
  { id: 'realistic', label: 'Realistic', icon: '📷' },
  { id: 'anime', label: 'Anime', icon: '🎨' },
  { id: '3d-render', label: '3D Render', icon: '🧊' },
  { id: 'abstract', label: 'Abstract', icon: '🌀' },
  { id: 'surreal', label: 'Surreal', icon: '💭' },
  { id: 'vintage', label: 'Vintage', icon: '📽️' },
] as const;

export const ASPECT_RATIOS: { id: AspectRatio; label: string; w: number; h: number }[] = [
  { id: '16:9', label: 'Landscape', w: 16, h: 9 },
  { id: '9:16', label: 'Portrait', w: 9, h: 16 },
  { id: '1:1', label: 'Square', w: 1, h: 1 },
];

export const AI_MODELS = [
  { id: 'neura-motion-v1', label: 'NeuraMotion v1', desc: 'Fast, balanced quality', speed: 'fast' },
  { id: 'neura-motion-v2', label: 'NeuraMotion v2', desc: 'Higher fidelity, slower', speed: 'slow' },
  { id: 'diffusion-cine', label: 'DiffusionCine', desc: 'Cinematic detail, slowest', speed: 'slowest' },
] as const;

export const TRENDING_PROMPTS = [
  'A futuristic city at sunset with flying cars and holographic billboards',
  'A serene Japanese garden with cherry blossoms falling in slow motion',
  'An astronaut floating in space with Earth reflecting in their visor',
  'A dragon made of fire soaring over a medieval castle at night',
  'Underwater coral city with bioluminescent creatures swimming around',
  'A time-lapse of a flower blooming into a galaxy of stars',
  'A samurai standing in a rain-soaked bamboo forest, cinematic',
  'Neon-lit Tokyo street at night with reflections in puddles',
];
