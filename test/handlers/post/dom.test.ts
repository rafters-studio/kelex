// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";
import { renderForm } from "../../../src/engine";
import { conformance } from "../../../src/conformance";
import { introspect } from "../../../src/introspection";
import { htmlRenderer, pathToId } from "../../../src/renderers/html";
import { postHandler } from "../../../src/handlers/post";

const OPTS = { formName: "F", schemaImportPath: "./f", schemaExportName: "s" };
const asSchema = (s: unknown) => s as Parameters<typeof introspect>[0];

/** Render + wire a schema, mount it, and execute the runtime script (innerHTML
 * does not run scripts, so each <script> is replaced with a fresh one). */
function mount(schema: unknown, action = "/submit"): HTMLFormElement {
  const wired = renderForm(
    introspect(asSchema(z.object(schema as never)), OPTS),
    htmlRenderer,
    postHandler,
  );
  document.body.innerHTML = wired;
  const form = document.body.querySelector("form") as HTMLFormElement;
  form.setAttribute("action", action);
  // innerHTML does not execute scripts; run the (marker-based) runtime directly.
  document.body.querySelectorAll("script").forEach((s) => {
    const code = s.textContent ?? "";
    s.remove();
    new Function(code)();
  });
  return form;
}

/** A fetch stub returning the given ~standard issues; captures the request body. */
function stubFetch(issues: unknown[] = []) {
  const fetchMock = vi.fn(() =>
    Promise.resolve({ json: () => Promise.resolve({ issues }) } as Response),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const submit = (form: HTMLFormElement) =>
  form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));

describe("postHandler -- async POST, native client validation, routing (#227)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("wire returns the form wrapped in place with a submit script (T -> T)", () => {
    const wired = renderForm(
      introspect(asSchema(z.object({ name: z.string() })), OPTS),
      htmlRenderer,
      postHandler,
    );
    expect(wired.startsWith("<form")).toBe(true);
    expect(wired).toContain("<script>");
    expect(wired).toContain("addEventListener");
  });

  it("collects values by name and POSTs JSON to the form action", async () => {
    const form = mount({ name: z.string(), age: z.number() });
    const fetchMock = stubFetch();
    (form.querySelector('[name="name"]') as HTMLInputElement).value = "Ada";
    (form.querySelector('[name="age"]') as HTMLInputElement).value = "42";
    submit(form);
    await flush();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/submit");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ name: "Ada", age: "42" });
  });

  it("routes a server ~standard issue to its control's error slot by path", async () => {
    const form = mount({ name: z.string() });
    stubFetch([{ message: "Too short", path: ["name"] }]);
    (form.querySelector('[name="name"]') as HTMLInputElement).value = "x";
    submit(form);
    await flush();
    const slot = form.querySelector('[data-error-for="name"]') as HTMLElement;
    expect(slot.textContent).toBe("Too short");
    expect(form.querySelector('[name="name"]')?.getAttribute("aria-invalid")).toBe("true");
  });

  it("adds/removes array rows and routes an array-row issue to the * template slot", async () => {
    const form = mount({ tags: z.array(z.object({ label: z.string() })) });
    const add = form.querySelector("[data-add-row]") as HTMLButtonElement;
    add.click();
    add.click();
    const rows = form.querySelectorAll("[data-row-instance]");
    expect(rows.length).toBe(2);
    const inputs = form.querySelectorAll('[name="tags.0.label"], [name="tags.1.label"]');
    expect(inputs.length).toBe(2);
    // Drift guard: the runtime's inlined pathToId must match kelex's -- a
    // re-indexed row id equals pathToId of its concrete path, and its
    // aria-describedby points at the matching error slot id.
    const row0 = form.querySelector('[name="tags.0.label"]') as HTMLInputElement;
    expect(row0.id).toBe(pathToId("tags.0.label"));
    expect(row0.getAttribute("aria-describedby")).toBe(`${pathToId("tags.0.label")}-error`);
    expect(
      form.querySelector(`#${CSS.escape(`${pathToId("tags.0.label")}-error`)}`),
    ).not.toBeNull();
    (form.querySelector('[name="tags.0.label"]') as HTMLInputElement).value = "a";
    (form.querySelector('[name="tags.1.label"]') as HTMLInputElement).value = "b";

    const fetchMock = stubFetch([{ message: "Required", path: ["tags", 1, "label"] }]);
    submit(form);
    await flush();
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body).toEqual({ tags: [{ label: "a" }, { label: "b" }] });
    // The concrete row-1 slot (tags.1.label) receives the issue.
    const slot = form.querySelector('[data-error-for="tags.1.label"]') as HTMLElement;
    expect(slot.textContent).toBe("Required");
  });

  it("compacts array gaps after a remove -- no null hole in the POSTed array", async () => {
    const form = mount({ tags: z.array(z.object({ label: z.string() })) });
    const add = form.querySelector("[data-add-row]") as HTMLButtonElement;
    add.click();
    add.click();
    add.click();
    (form.querySelector('[name="tags.0.label"]') as HTMLInputElement).value = "a";
    (form.querySelector('[name="tags.1.label"]') as HTMLInputElement).value = "b";
    (form.querySelector('[name="tags.2.label"]') as HTMLInputElement).value = "c";
    // Remove the middle row (index 1).
    (form.querySelectorAll("[data-remove-row]")[1] as HTMLButtonElement).click();
    const fetchMock = stubFetch();
    submit(form);
    await flush();
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body).toEqual({ tags: [{ label: "a" }, { label: "c" }] }); // no hole
  });

  it("disables inactive union variant panels so they neither submit nor block validation", async () => {
    const form = mount({
      shape: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("circle"), radius: z.number() }),
        z.object({ kind: z.literal("rect"), w: z.number() }),
      ]),
    });
    const selector = form.querySelector("[data-variant-of]") as HTMLSelectElement;
    selector.value = "circle";
    selector.dispatchEvent(new Event("change", { bubbles: true }));
    const radius = form.querySelector('[name="shape.radius"]') as HTMLInputElement;
    const w = form.querySelector('[name="shape.w"]') as HTMLInputElement;
    expect(radius.disabled).toBe(false);
    expect(w.disabled).toBe(true); // inactive panel -> disabled -> excluded from FormData

    radius.value = "5";
    const fetchMock = stubFetch();
    submit(form);
    await flush();
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.shape).not.toHaveProperty("w"); // the disabled panel did not submit
  });

  it("sends an unbound issue to the form-level sink, never dropping it", async () => {
    const form = mount({ name: z.string() });
    stubFetch([{ message: "Form is invalid", path: [] }]);
    (form.querySelector('[name="name"]') as HTMLInputElement).value = "x";
    submit(form);
    await flush();
    const sink = form.querySelector("[data-form-error]") as HTMLElement;
    expect(sink.textContent).toBe("Form is invalid");
  });

  it("passes conformance paired with the default HTML renderer (the baseline)", async () => {
    const names = (s: string) => [...s.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    const report = await conformance(htmlRenderer, postHandler, { names, fuzzCount: 30 });
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(true);
  });
});
