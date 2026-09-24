const test = require('node:test'), assert = require('node:assert'), { fare } = require('../src/fare');
// Hand-check: Nusrat Banani->Mohakhali = 2 km. (4000 + 2*1500) = 7000; 20% off = 1400 -> 5600 paisa (৳56)
test('Nusrat pooled fare', () => assert.deepStrictEqual(fare(2, 1, true), { gross: 7000, discount: 1400, total: 5600 }));
// Rafiq Banani->Gulshan 1 = 3 km. (4000 + 4500) = 8500; 20% off = 1700 -> 6800 paisa (৳68)
test('Rafiq pooled fare', () => assert.deepStrictEqual(fare(3, 1, true), { gross: 8500, discount: 1700, total: 6800 }));
test('solo has no discount', () => assert.strictEqual(fare(2, 1, false).total, 7000));
