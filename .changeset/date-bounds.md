---
"@rafters/kelex": patch
---

Fix `z.date()` bounds putting a Date into a number-typed constraint. `z.date().min(new Date(...))` assigned the Date to `constraints.min`, which is typed `number` — so the composite JSON carried a string where the contract said number, aimed straight at a Rust reader deserializing it as a float, and the writer dropped the bound entirely on round-trip. Date bounds now live in dedicated `minDate`/`maxDate` ISO-string slots; numeric `min`/`max` stay strictly numeric, and the writer re-emits `.min(new Date(...))`.
