---
"@rafters/kelex": patch
---

Warnings now identify a field by its full path rather than its leaf name. A field nested four levels down reported as `Field "name"` with no branch; tuple elements reported as `Field "0"` and `Field "1"` with nothing tying them to their tuple; a record value reported as `Field "value"`; and two same-named fields in different branches produced byte-identical warnings.

Paths follow Standard Schema's `PathSegment[]` convention — `bag[0].quality`, `identity.origin.discipline.name`, `coords[0]` — so a warning can be matched against a `~standard` issue path. A record's value position uses a wildcard (`stats.*`), since its real key is not known until validation.

Top-level fields still render as a bare name, and the number of warnings produced is unchanged. Only their content moved. The record-key warning gained a location it never had — it previously named no field at all.
