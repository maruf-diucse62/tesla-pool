# Dhaka Tesla Pool — Share a seat. Split the fare. Survive Dhaka traffic.
Cast: **Jashim** (driver) + **Bullet** (3 seats); passengers **Nusrat, Rafiq, Shirin**. All passwords: `password123` (`nusrat@teslapool.bd`, …).

## Run
```bash
cp .env.example .env
docker compose up --build      # Web on http://localhost:3000, API on http://localhost:4000/health ; migrations + seed run automatically
DATABASE_URL=postgres://tesla:tesla@localhost:5432/teslapool npm test   # (expose db port first; test WIPES that DB)
```

## Architecture
```mermaid
flowchart LR
  B[Browser] --> F[Next.js frontend] --> A[Node/Express REST API] --> D[(PostgreSQL)]
```
## ERD
```mermaid
erDiagram
  users ||--o| vehicles : drives
  vehicles ||--o{ pools : carries
  pools ||--o{ ride_requests : contains
  users ||--o{ ride_requests : books
  zones ||--o{ ride_requests : "pickup/dest"
  ride_requests ||--o{ ride_events : audit
```
Tables: **users** (role passenger/driver) · **vehicles** (capacity, is_online) · **zones** (predefined areas) · **pools** (one trip of one Tesla) · **ride_requests** (one passenger's booking; also = pool membership via `pool_id`) · **ride_events** (audit: every status change, who, when).

## Lifecycle
`REQUESTED → MATCHED → DRIVER_ARRIVED → STARTED → COMPLETED`, plus `CANCELLED` (only from REQUESTED/MATCHED). Driver actions move the *whole pool* forward and every member's status with it. Skipping steps → 409.

## Matching rule (my assumption)
Zones sit on one imaginary corridor, `pos_km` km from Banani. Two requests can share a Tesla if **same pickup zone** and **destinations ≤ 2 km apart**. Nusrat (Banani→Mohakhali, 2 km) and Rafiq (Banani→Gulshan 1, 3 km) → gap 1 km → they match. Shirin to Uttara would not.

## Fare (test by hand)
`fare = (৳40 + ৳15 × km) × seats − 20% pool discount` (discount only if 2+ passengers share). Money is **integer paisa** — no float rounding bugs.
- Nusrat: 4000 + 2×1500 = 7000 → −1400 = **5600 paisa (৳56)**
- Rafiq: 4000 + 3×1500 = 8500 → −1700 = **6800 paisa (৳68)**
Estimate shows "alone" and "shared" prices; the final fare is locked at trip start. Payment: CASH or simulated TESLAPAY (just a label).

## Concurrency (Bullet's last seat)
Every seat claim runs in one DB transaction that first does `SELECT … FROM vehicles … FOR UPDATE` on Bullet's row. Nusrat and Shirin queue up; the second sees the seat is gone and gets **409** (stays REQUESTED/waiting). A partial unique index also guarantees one live pool per Tesla. At scale: shard by area/vehicle, use a matching service with a queue per zone, idempotency keys.

## Key choices (what / alternatives / why / switch when)
- **PostgreSQL** (vs MySQL, SQLite): row locks + partial indexes + constraints fit capacity/consistency. Switch: never for MVP.
- **Raw SQL with `pg`** (vs Prisma): the locking SQL is the interesting part and stays visible. Switch to an ORM as tables grow.
- **Express + REST** (vs NestJS, GraphQL): few simple resources; least magic.
- **JWT + bcrypt**: stateless login. Switch to sessions/refresh tokens for revocation.
- **Rules in `src/pool.js`, routes in `src/app.js`**: easy to test and explain.

## API
`POST /auth/signup|login` · `GET /zones` · `GET /rides/estimate` · `POST /rides` · `GET /rides` · `GET /rides/:id` · `POST /rides/:id/cancel` · `POST /driver/online` · `GET /driver/requests` · `POST /driver/requests/:id/accept` · `GET /driver/pool` · `POST /driver/pool/arrive|start|complete` · `GET /driver/history`

## Known limitations / next
No payment logic; no rate limiting; one active ride per passenger; simple corridor geography.

## AI Usage
Tools: Claude, along with ChatGPT and Perplexity, were used at different
stages of this project. The problem brief itself — the Dhaka Tesla Pool
scenario, the cast (Jashim, Bullet, Nusrat, Rafiq, Shirin), and the
requirements — is RoBenDevs' assignment PRD, not something I invented.
What's mine is the specific engineering response to that brief: the
database schema, the exact fare formula and numbers, the matching rule
(same pickup zone, destinations within 2km), and the concurrency
(row-lock) approach for seat claims — the brief explicitly leaves these
as design decisions for the candidate to make.

Used Perplexity to research how to structure a simple, testable fare
model (base + distance charge − pool discount, and why storing money as
integer paisa avoids float rounding issues) before settling on the exact
numbers used here. Also used Perplexity to research best practices for
structuring a multi-service Docker Compose setup (API + Postgres,
healthchecks, migration/seed ordering on startup). Used Claude, ChatGPT
and Perplexity together while working through deployment — comparing
free-tier options for Render (API), Neon (Postgres), and Vercel
(frontend), and troubleshooting configuration issues (environment
variables, CORS between the Vercel frontend and Render API, the Neon
connection string). Claude was additionally used to build out the git
branch/commit history, verify the app end-to-end (ran the full test
suite against a real Postgres, built the frontend), and redesign the
UI's visual identity.

Accepted: Claude's suggestion to split the git history into feature
branches by dependency order (schema → fare → auth → pooling → routes →
tests → docker → frontend) instead of one large commit.

Rejected/changed: Claude's first pass at centering the page used
`margin: 0 auto` on the main content and footer separately. Running it
locally, they drifted out of alignment — the card sat right of center
and the footer text ran off the left edge. I caught this from a
screenshot and had it changed to a flexbox-based centering approach on
`body` instead.
## Demo
[Video walkthrough](https://www.loom.com/share/cfe657cb2c134df6a27526d657b70833) · [Live deployment](https://tesla-pool.vercel.app/)
