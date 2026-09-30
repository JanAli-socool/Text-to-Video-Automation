import { supabase } from '@/lib/supabase';
import type { GenerationParams, Video } from '@/types';

// Simulates a text-to-video generation pipeline.
// In production, this would call the Python FastAPI backend which dispatches
// the job to a GPU worker running an AI model (e.g., Stable Video Diffusion,
// AnimateDiff, or a custom diffusion-based text-to-video pipeline).
const THUMBNAIL_POOL = [
  'https://images.pexels.com/photos/6758832/pexels-photo-6758832.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/39630579/pexels-photo-39630579.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/1428148/pexels-photo-1428148.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/12024203/pexels-photo-12024203.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/36957437/pexels-photo-36957437.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/29101876/pexels-photo-29101876.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/20792947/pexels-photo-20792947.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/32491690/pexels-photo-32491690.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/6679202/pexels-photo-6679202.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/2694037/pexels-photo-2694037.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/4233216/pexels-photo-4233216.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/30238186/pexels-photo-30238186.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
];

// Sample video URLs that actually work for playback testing
const SAMPLE_VIDEO_URLS = [
  'https://d23dy9qlooohv8.cloudfront.net/big_buck_bunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
];

function pickThumbnail(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % THUMBNAIL_POOL.length;
  return THUMBNAIL_POOL[idx];
}

function pickVideoUrl(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 37 + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % SAMPLE_VIDEO_URLS.length;
  return SAMPLE_VIDEO_URLS[idx];
}

function generateTitle(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 4);
  const title = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return title || 'Untitled Creation';
}

export interface GenerationResult {
  video: Video;
  error: string | null;
}

export interface GenerationCallbacks {
  onProgress?: (pct: number, stage: string) => void;
  onPreviewReady?: (videoId: string, previewUrl: string) => void;
  onComplete?: (video: Video) => void;
  onError?: (error: string) => void;
}

export type GenerationStage = 'queued' | 'encoding_prompt' | 'diffusing' | 'decoding_frames' | 'encoding_video' | 'finalizing';

// Creates a video record in Supabase with "processing" status,
// simulates the generation with progressive stages, exposes a preview
// as soon as it's available, then updates to "completed".
export async function generateVideo(
  params: GenerationParams,
  callbacks?: GenerationCallbacks
): Promise<GenerationResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const msg = 'You must be signed in to generate videos.';
    callbacks?.onError?.(msg);
    return { video: {} as Video, error: msg };
  }

  const title = generateTitle(params.prompt);
  const thumbnailUrl = pickThumbnail(params.prompt);
  const videoUrl = pickVideoUrl(params.prompt);

  // Step 1: insert as "processing"
  const { data, error } = await supabase
    .from('videos')
    .insert({
      user_id: user.id,
      title,
      prompt: params.prompt,
      style: params.style,
      status: 'processing',
      thumbnail_url: thumbnailUrl,
      video_url: '',
      duration: params.duration,
      aspect_ratio: params.aspect_ratio,
      is_public: params.is_public,
      model: params.model,
    })
    .select()
    .single();

  if (error || !data) {
    const msg = error?.message || 'Failed to create video record.';
    callbacks?.onError?.(msg);
    return { video: {} as Video, error: msg };
  }

  const videoId = data.id;

  // Step 2: Progressive generation with stages
  const stages: { name: GenerationStage; label: string; steps: number }[] = [
    { name: 'queued', label: 'Queued for generation', steps: 2 },
    { name: 'encoding_prompt', label: 'Encoding prompt', steps: 3 },
    { name: 'diffusing', label: 'Running diffusion model', steps: 8 },
    { name: 'decoding_frames', label: 'Decoding video frames', steps: 4 },
    { name: 'encoding_video', label: 'Encoding video', steps: 2 },
    { name: 'finalizing', label: 'Finalizing', steps: 1 },
  ];

  let totalProgress = 0;
  const totalSteps = stages.reduce((s, st) => s + st.steps, 0);

  for (const stage of stages) {
    for (let i = 0; i < stage.steps; i++) {
      await new Promise((r) => setTimeout(r, 150));
      totalProgress++;
      const pct = Math.round((totalProgress / totalSteps) * 100);
      callbacks?.onProgress?.(pct, stage.label);

      // At ~50% progress, the preview becomes available (simulating progressive preview)
      if (pct >= 50 && videoUrl) {
        callbacks?.onPreviewReady?.(videoId, videoUrl);
      }
    }
  }

  // Step 3: mark as completed with the video URL
  const { data: updated, error: updateErr } = await supabase
    .from('videos')
    .update({
      status: 'completed',
      video_url: videoUrl,
    })
    .eq('id', videoId)
    .select()
    .single();

  if (updateErr || !updated) {
    // Return the original record even if update fails
    const result = { video: data as Video, error: null };
    callbacks?.onComplete?.(data as Video);
    return result;
  }

  const result = { video: updated as Video, error: null };
  callbacks?.onComplete?.(updated as Video);
  return result;
}

// Polls a video's status until it's completed or failed (for async generation)
export async function pollVideoStatus(
  videoId: string,
  onUpdate?: (video: Video) => void,
  intervalMs = 2000,
  maxAttempts = 30
): Promise<Video | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .maybeSingle();

    if (error || !data) {
      await new Promise((r) => setTimeout(r, intervalMs));
      continue;
    }

    const video = data as Video;
    onUpdate?.(video);

    if (video.status === 'completed' || video.status === 'failed') {
      return video;
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return null;
}

export async function deleteVideo(videoId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('videos').delete().eq('id', videoId);
  return { error: error?.message || null };
}

export async function toggleVideoVisibility(
  videoId: string,
  isPublic: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('videos').update({ is_public: !isPublic }).eq('id', videoId);
  return { error: error?.message || null };
}

// Backward-compatible wrapper for old callback signature
export async function generateVideoLegacy(
  params: GenerationParams,
  onProgress?: (pct: number) => void
): Promise<GenerationResult> {
  return generateVideo(params, {
    onProgress: (pct) => onProgress?.(pct),
  });
}
