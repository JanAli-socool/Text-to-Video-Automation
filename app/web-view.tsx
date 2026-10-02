import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react-native';
import { COLORS } from '@/lib/colors';
import { supabase } from '@/lib/supabase';
import type { Video } from '@/types';

/** First-class, read-only web presentation for a generated video. The HTML is
 * intentionally data-driven so it shares the same library record and never
 * starts a second generation job. */
export default function WebViewScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    if (!id) { setLoading(false); return; }
    setLoading(true); setFailed(false);
    const { data, error } = await supabase.from('videos').select('*').eq('id', id).maybeSingle();
    if (error || !data) setFailed(true); else setVideo(data as Video);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const html = video?.video_url ? `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><style>
    *{box-sizing:border-box}body{margin:0;background:#09090b;color:#f8fafc;font-family:Arial,sans-serif}main{max-width:960px;margin:auto;padding:20px}video{width:100%;max-height:72vh;background:#000;border-radius:16px}h1{font-size:clamp(22px,4vw,38px);margin:18px 0 8px}p{color:#a1a1aa;line-height:1.55}.pill{display:inline-block;color:#5eead4;background:#134e4a;padding:6px 10px;border-radius:999px;font-size:12px}
  </style></head><body><main><span class="pill">AI VIDEO · ${video.status === 'completed' ? 'FINAL' : 'PREVIEW'}</span><h1>${escapeHtml(video.title)}</h1><video controls playsinline preload="metadata" poster="${video.thumbnail_url}" src="${video.video_url}"></video><p>${escapeHtml(video.prompt)}</p></main></body></html>` : null;

  return <View style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}><ArrowLeft size={21} color={COLORS.neutral[0]} /></TouchableOpacity>
      <Text style={styles.headerTitle}>Web View</Text>
      <ExternalLink size={18} color={COLORS.neutral[500]} />
    </View>
    {loading ? <View style={styles.center}><ActivityIndicator color={COLORS.primary[400]} /><Text style={styles.muted}>Loading web experience…</Text></View>
      : failed ? <View style={styles.center}><Text style={styles.title}>This experience is unavailable</Text><Text style={styles.muted}>We couldn’t load the library item.</Text><TouchableOpacity style={styles.retry} onPress={load}><RefreshCw size={16} color={COLORS.neutral[950]} /><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View>
      : !video ? <View style={styles.center}><Text style={styles.title}>No content selected</Text><Text style={styles.muted}>Return to the library and choose a video.</Text></View>
      : video.video_url ? <WebView source={{ html: html! }} style={styles.webview} startInLoadingState renderLoading={() => <View style={styles.center}><ActivityIndicator color={COLORS.primary[400]} /></View>} />
      : <View style={styles.center}><Text style={styles.title}>Preview is still processing</Text><Text style={styles.muted}>The Web View will be available when a playable preview is published.</Text></View>}
  </View>;
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] || c)); }
const styles = StyleSheet.create({ container:{flex:1,backgroundColor:COLORS.neutral[950]}, header:{height:64,flexDirection:'row',alignItems:'center',gap:14,paddingHorizontal:16,borderBottomWidth:1,borderBottomColor:COLORS.neutral[800]}, iconButton:{width:38,height:38,borderRadius:19,backgroundColor:COLORS.neutral[900],alignItems:'center',justifyContent:'center'}, headerTitle:{flex:1,color:COLORS.neutral[0],fontFamily:'Inter-SemiBold',fontSize:16}, webview:{flex:1,backgroundColor:COLORS.neutral[950]}, center:{flex:1,alignItems:'center',justifyContent:'center',padding:30,gap:12},title:{color:COLORS.neutral[0],fontFamily:'Inter-SemiBold',fontSize:18,textAlign:'center'},muted:{color:COLORS.neutral[400],fontFamily:'Inter-Regular',fontSize:14,textAlign:'center'},retry:{flexDirection:'row',gap:8,alignItems:'center',backgroundColor:COLORS.primary[400],paddingHorizontal:16,paddingVertical:11,borderRadius:10},retryText:{color:COLORS.neutral[950],fontFamily:'Inter-SemiBold'} });
