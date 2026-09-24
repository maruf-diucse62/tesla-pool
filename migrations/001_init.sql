CREATE TABLE users (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('passenger','driver')));
CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY, driver_id INT UNIQUE NOT NULL REFERENCES users(id),
  name TEXT NOT NULL, capacity INT NOT NULL CHECK (capacity > 0), is_online BOOLEAN NOT NULL DEFAULT false);
CREATE TABLE zones (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, pos_km NUMERIC NOT NULL);
CREATE TABLE pools (
  id SERIAL PRIMARY KEY, vehicle_id INT NOT NULL REFERENCES vehicles(id),
  status TEXT NOT NULL CHECK (status IN ('ACCEPTED','DRIVER_ARRIVED','STARTED','COMPLETED','CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());
-- a Tesla can only have ONE live pool at a time
CREATE UNIQUE INDEX one_live_pool_per_vehicle ON pools(vehicle_id) WHERE status IN ('ACCEPTED','DRIVER_ARRIVED','STARTED');
CREATE TABLE ride_requests (
  id SERIAL PRIMARY KEY, passenger_id INT NOT NULL REFERENCES users(id),
  pickup_zone_id INT NOT NULL REFERENCES zones(id), dest_zone_id INT NOT NULL REFERENCES zones(id),
  seats INT NOT NULL CHECK (seats BETWEEN 1 AND 3),
  status TEXT NOT NULL CHECK (status IN ('REQUESTED','MATCHED','DRIVER_ARRIVED','STARTED','COMPLETED','CANCELLED')),
  pool_id INT REFERENCES pools(id), fare_paisa INT CHECK (fare_paisa >= 0),
  payment_method TEXT NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH','TESLAPAY')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), CHECK (pickup_zone_id <> dest_zone_id));
CREATE INDEX ON ride_requests(passenger_id); CREATE INDEX ON ride_requests(status); CREATE INDEX ON ride_requests(pool_id);
CREATE TABLE ride_events (
  id SERIAL PRIMARY KEY, request_id INT NOT NULL REFERENCES ride_requests(id), pool_id INT REFERENCES pools(id),
  from_status TEXT, to_status TEXT NOT NULL, actor_id INT REFERENCES users(id), at TIMESTAMPTZ NOT NULL DEFAULT now());
