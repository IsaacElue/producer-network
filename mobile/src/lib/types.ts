export type UserRole = 'producer' | 'vocalist' | 'engineer' | 'other';

export const USER_ROLES: UserRole[] = ['producer', 'vocalist', 'engineer', 'other'];

export const ROLE_LABELS: Record<UserRole, string> = {
  producer: 'Producer',
  vocalist: 'Vocalist',
  engineer: 'Engineer',
  other: 'Other',
};

export type Profile = {
  id: string;
  display_name: string;
  role: UserRole | null;
  looking_for: UserRole[];
  bio: string;
  location: string | null;
  avatar_url: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  soundcloud_url: string | null;
  youtube_url: string | null;
  // The user's own Spotify artist page (optional), distinct from sound_references.
  spotify_artist_id: string | null;
  spotify_artist_name: string | null;
  spotify_artist_image_url: string | null;
  spotify_artist_url: string | null;
  spotify_artist_genres: string[];
  spotify_artist_albums: SpotifyAlbum[];
  onboarded: boolean;
  created_at: string;
};

export type SpotifyAlbum = {
  id: string;
  name: string;
  imageUrl: string | null;
  releaseDate: string | null;
  type: string;
};

export type SpotifyArtistDetail = {
  spotifyId: string;
  name: string;
  imageUrl: string | null;
  url: string | null;
  genres: string[];
  albums: SpotifyAlbum[];
};

export type TagOption = {
  id: string;
  label: string;
  kind: 'genre' | 'subgenre';
  parent_id: string | null;
  sort_order: number;
};

export type SoundReference = {
  id: string;
  profile_id: string;
  ref_type: 'artist' | 'track';
  spotify_id: string;
  name: string;
  artist_name: string | null;
  artist_spotify_id: string | null;
  image_url: string | null;
  genres: string[];
  created_at: string;
};

export type SpotifySearchResult = {
  refType: 'artist' | 'track';
  spotifyId: string;
  name: string;
  imageUrl: string | null;
  genres?: string[];
  artistName?: string | null;
  artistSpotifyId?: string | null;
};

export type FeedItem = {
  profile_id: string;
  score: number;
  shared_artist_names: string[];
  shared_track_names: string[];
  similar_artist_names: string[];
  shared_tag_labels: string[];
  role_match: 'mutual' | 'one_way' | 'none';
};

export type MatchRow = {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
};

export type MessageRow = {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};
