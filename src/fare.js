// All money is INTEGER PAISA (100 paisa = 1 taka): no floating-point rounding surprises.
const BASE = 4000;            // ৳40 flat
const PER_KM = 1500;          // ৳15 per km
const POOL_DISCOUNT_PCT = 20; // everyone in a shared Tesla (2+ passengers) gets 20% off
// fare = (base + km*perKm) * seats - poolDiscount
function fare(km, seats, pooled) {
  const gross = (BASE + Math.round(km * PER_KM)) * seats;
  const discount = pooled ? Math.round((gross * POOL_DISCOUNT_PCT) / 100) : 0;
  return { gross, discount, total: gross - discount };
}
module.exports = { fare, BASE, PER_KM, POOL_DISCOUNT_PCT };
