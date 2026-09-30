# NeuraMotion API - Python Backend

AI video generation platform backend built with **FastAPI**, **Supabase** (Postgres), and **diffusion-based text-to-video** models.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    React Native App                  │
│                   (Expo / Expo Router)               │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS (JWT in Authorization)
                       ▼
┌─────────────────────────────────────────────────────┐
│                 FastAPI Application                   │
│                                                      │
│  ┌─────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Auth   │  │  Videos  │  │    Profiles       │  │
│  │ Routes  │  │  Routes  │  │     Routes        │  │
│  └────┬────┘  └────┬─────┘  └────────┬──────────┘  │
│       │            │                 │              │
│  ┌────▼────────────▼─────────────────▼──────────┐  │
│  │            JWT Auth Middleware                 │  │
│  │     (Bearer token → user identity)            │  │
│  └────────────────────┬─────────────────────────┘  │
│                       │                             │
│  ┌────────────────────▼─────────────────────────┐  │
│  │          Video Generation Engine              │  │
│  │                                               │  │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────────┐ │  │
│  │  │  CLIP   │→ │ Latent   │→ │    VAE      │ │  │
│  │  │ Encoder │  │ Diffusion│  │  Decoder    │ │  │
│  │  └─────────┘  └──────────┘  └──────┬──────┘ │  │
│  │                                     │        │  │
│  │  ┌──────────────────────────────────▼──────┐ │  │
│  │  │  Frame Interpolation + FFmpeg Encoder   │ │  │
│  │  └─────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────┐
│                    Supabase                          │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Auth    │  │ Postgres │  │   Storage        │  │
│  │ (GoTrue) │  │ (RLS on) │  │ (video files)    │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer            | Technology                                      |
|-----------------|--------------------------------------------------|
| Web Framework    | FastAPI 0.115                                    |
| Auth             | Supabase Auth (GoTrue) + backend JWT (python-jose)|
| Database         | Supabase Postgres with Row Level Security         |
| Video Generation | Stable Video Diffusion / AnimateDiff (diffusers)  |
| GPU Runtime      | PyTorch 2.4 + CUDA                               |
| Video Encoding   | FFmpeg (via imageio-ffmpeg)                      |
| Validation       | Pydantic 2.9                                     |

## Authentication Flow

The platform uses a dual-layer JWT approach:

1. **Supabase Auth (GoTrue)** — handles user signup/signin with email+password. Supabase issues its own session JWT.
2. **Backend JWT** — after Supabase auth, the FastAPI backend issues its own JWT signed with `JWT_SECRET`. This token is sent in the `Authorization: Bearer <token>` header for all API calls.
3. **RLS enforcement** — Supabase Row Level Security policies ensure users can only read/write their own data at the database level, even if the API is bypassed.

```
Client                    FastAPI                    Supabase
  │                         │                          │
  │── POST /auth/signin ──→ │                          │
  │                         │── auth.sign_in_pw ──→   │
  │                         │←── session ──────────   │
  │                         │── create JWT ──→        │
  │←── backend JWT ─────── │                          │
  │                         │                          │
  │── GET /videos (JWT) ──→ │                          │
  │                         │── decode JWT             │
  │                         │── select * from videos   │
  │                         │   (RLS filters rows) ──→ │
  │                         │←── filtered rows ──────  │
  │←── video list ─────────│                          │
```

## API Endpoints

### Auth
| Method | Path                        | Description              |
|--------|-----------------------------|--------------------------|
| POST   | `/api/v1/auth/signup`       | Create account + get JWT |
| POST   | `/api/v1/auth/signin`       | Sign in + get JWT        |
| GET    | `/api/v1/auth/me`           | Get current user         |
| POST   | `/api/v1/auth/signout`      | Sign out (client-side)   |

### Videos
| Method | Path                        | Description              |
|--------|-----------------------------|--------------------------|
| POST   | `/api/v1/videos`            | Generate a new video     |
| GET    | `/api/v1/videos`            | List public videos       |
| GET    | `/api/v1/videos/me`         | List current user videos |
| GET    | `/api/v1/videos/{id}`       | Get single video         |
| PATCH  | `/api/v1/videos/{id}`       | Update video metadata    |
| DELETE | `/api/v1/videos/{id}`       | Delete a video           |
| POST   | `/api/v1/videos/{id}/like`  | Like a video             |

### Profiles
| Method | Path                          | Description              |
|--------|-------------------------------|--------------------------|
| GET    | `/api/v1/profiles/{username}` | Get public profile       |
| PATCH  | `/api/v1/profiles/me`         | Update own profile       |

### Health
| Method | Path                    | Description          |
|--------|-------------------------|----------------------|
| GET    | `/api/v1/health`        | Health check         |

## Video Generation Pipeline

The `video_engine.py` module supports two modes:

### Mock Mode (default, no GPU)
- Simulates the generation pipeline with a configurable delay
- Returns a placeholder thumbnail from a curated image pool
- Perfect for development and testing

### GPU Mode (`ENABLE_GPU_GENERATION=true`)
- Loads a Stable Video Diffusion model via the `diffusers` library
- Pipeline: text prompt → CLIP encoding → latent diffusion (U-Net) → VAE decode → frame interpolation → FFmpeg MP4 encode
- Outputs are saved to disk and (in production) uploaded to CDN/S3

## Setup

### Prerequisites
- Python 3.11+
- For GPU mode: NVIDIA GPU with CUDA support

### Installation

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Supabase (shared with frontend)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRY_HOURS=24

# Video Generation
ENABLE_GPU_GENERATION=false
MOCK_GENERATION_DELAY=8
```

### Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at `http://localhost:8000/docs`

## Database Schema

### profiles
| Column      | Type     | Description                        |
|-------------|----------|------------------------------------|
| id          | uuid     | PK, references auth.users          |
| username    | text     | Unique username                    |
| full_name   | text     | Display name                       |
| avatar_url  | text     | Profile picture URL                |
| bio         | text     | User bio                           |
| plan        | text     | free / pro / studio                |
| credits     | int      | Generation credits (default: 10)   |
| created_at  | timestamptz | Creation timestamp              |

### videos
| Column        | Type     | Description                        |
|---------------|----------|------------------------------------|
| id            | uuid     | PK                                 |
| user_id       | uuid     | FK → profiles.id                   |
| title         | text     | Auto-generated from prompt         |
| prompt        | text     | The text prompt used               |
| style         | text     | cinematic / cyberpunk / realistic  |
| status        | text     | processing / completed / failed    |
| thumbnail_url | text     | Video thumbnail                    |
| video_url     | text     | Generated video URL                |
| duration      | int      | Length in seconds                  |
| aspect_ratio  | text     | 16:9 / 9:16 / 1:1                  |
| is_public     | boolean  | Public or private                  |
| likes_count   | int      | Total likes                        |
| views_count   | int      | Total views                        |
| model         | text     | AI model used                      |
| created_at    | timestamptz | Creation timestamp              |

### Row Level Security
- **profiles**: All authenticated users can SELECT; users can UPDATE only their own.
- **videos**: Users can SELECT public videos + their own private ones; INSERT/UPDATE/DELETE scoped to owner.
- A trigger auto-creates a profile row when a new auth user signs up.
