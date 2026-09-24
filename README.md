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
No payment logic; no rate limiting; one active ride per passenger; simple
corridor geography instead of real routing; no automated frontend tests;
API instances aren't yet stateless-scaled (fine for one MVP instance).

## Testing
`test/fare.test.js` is a pure unit test (no DB) checking the hand-calculated
fares above. `test/pool.test.js` is a single integration test against a real
Postgres that walks the whole story in one pass: Nusrat requests, Jashim
accepts (pool opens), Rafiq auto-joins the same Bullet, two more passengers
race for the last seat (exactly one gets **MATCHED**, the other stays
waiting), Shirin can't read or cancel Nusrat's ride (**404**), invalid trip
transitions are rejected (**409**), fares lock correctly at trip start, and
cancelling a started ride is rejected.

## Bonus: scaling to 1M passengers / 100k drivers
Not built for the MVP, but the direction: shard matching by geography (one
matching worker per zone/area, so no single process compares every open
request against every other); move the vehicle-row lock to a
Redis-backed distributed lock or a queue-per-zone so Postgres isn't the
contention point at scale; read replicas for history/estimate reads,
primary only for the transactional seat-claim path; cache the (mostly
static) zones table; push status updates over WebSockets/SSE instead of
3-second polling; idempotency keys on `/rides` and `/driver/requests/:id/accept`
so retried requests can't double-book; rate-limit per user; add
tracing/metrics around the lock-acquisition path specifically, since that's
where contention will show up first; blue-green deploys behind a load
balancer, stateless API instances so any of them can serve any request.

## AI Usage
Tools: Claude — scaffolding, the locking/concurrency approach for seat
claims, and this README. Accepted: the `SELECT ... FOR UPDATE` row-lock
pattern for the last-seat race.
**Rejected/changed — fill this in yourself before submitting**: this needs
to be a real example from your own process (e.g. a naming choice you
reverted, a discount percentage you changed, a suggestion you simplified).
A genuine one-line answer here is part of what the brief is scoring —
don't skip it or leave it generic.

## Screenshots
_Add 2–3 screenshots or a short GIF here once you've run it locally:
the login screen, an active ride card, and the driver's current pool._

## Video: <add your Loom link>   ·   Deployment: <add your deployment URL, or write "not deployed — see Docker instructions above" if you run out of time>
