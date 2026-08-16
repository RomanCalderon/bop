create table if not exists "user" (
  id text primary key,
  name text not null,
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists "session" (
  id text primary key,
  expires_at timestamptz not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  user_id text not null references "user"(id) on delete cascade
);

create table if not exists "account" (
  id text primary key,
  account_id text not null,
  provider_id text not null,
  user_id text not null references "user"(id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists "verification" (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists allowed_emails (
  id text primary key,
  email text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists allowed_emails_email_uidx on allowed_emails (email);

create table if not exists cities (
  id text primary key,
  name text not null,
  center_lat double precision,
  center_lng double precision
);
create unique index if not exists cities_name_uidx on cities (lower(name));

create table if not exists areas (
  id text primary key,
  city_id text not null references cities(id) on delete cascade,
  name text not null
);
create unique index if not exists areas_city_name_uidx on areas (city_id, lower(name));

create table if not exists places (
  id text primary key,
  place_id text not null,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  formatted_address text not null,
  city_id text not null references cities(id),
  area_id text references areas(id),
  type text,
  extra_tags text[] not null default '{}',
  notes text not null default '',
  rating double precision,
  google_maps_url text not null default '',
  photo_name text,
  author_attributions jsonb not null default '[]',
  seed_feature_cid text
);
create unique index if not exists places_place_id_city_id_uidx on places (place_id, city_id);
create unique index if not exists places_seed_feature_cid_uidx on places (seed_feature_cid) where seed_feature_cid is not null;

create table if not exists user_preferences (
  user_id text primary key references "user"(id) on delete cascade,
  last_city_id text references cities(id)
);
