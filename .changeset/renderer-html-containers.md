---
"@rafters/kelex": minor
---

Complete the default base-HTML renderer -- containers, form, buttons, and an
example stylesheet (#228). `object`/`tuple` render as `<fieldset><legend>`;
`array`/`record` as a repeater (a `<template>` row carrying the `*` path + inert
`data-add-row`/`data-remove-row` buttons); `union` as a switch (a
`data-variant-of` selector that stamps a discriminated union's discriminator +
`data-variant`/`data-when` panels); a recursive boundary as an inert marker. The
`form` composer now wraps a real `<form action>` (via the new
`createHtmlRenderer({ action })` factory; `htmlRenderer` stays the default
instance) with a submit button -- all interactivity is inert, owned by the post
handler (#227). With the leaf inventory the renderer passes the FULL floor and
full conformance. Ships `@rafters/kelex/form.css`, a classless example sheet.
