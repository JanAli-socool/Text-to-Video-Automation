# Video-Generation-Automation

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-yg1vb9bp)

## Supabase setup

The app expects Expo public environment variables. If they are missing, the app now opens safely in signed-out mode instead of crashing, but authentication and generation remain unavailable.

```bash
cp .env.example .env
# Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
npm run dev -- --clear
```

Restart Metro after changing `.env`; Expo injects `EXPO_PUBLIC_*` values when the bundle is built.
