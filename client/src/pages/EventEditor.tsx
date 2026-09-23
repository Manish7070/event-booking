import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useData } from "../hooks/useData.js";
import { api } from "../api/axios.js";
import { queryClient } from "../api/queryClient.js";
import {
  Button,
  Field,
  Notice,
  PageTitle,
  Skeleton,
  date,
  message,
  money,
} from "../components/ui.js";
const initial = {
  title: "",
  shortDescription: "",
  description: "",
  category: "",
  venue: "",
  coverImage: "",
  images: [] as string[],
  startDate: "",
  endDate: "",
  timezone: "Asia/Kolkata",
  tickets: [
    {
      name: "General admission",
      price: 0,
      totalQuantity: 100,
      maxPerBooking: 6,
    },
  ],
  highlights: [] as string[],
  schedule: [] as any[],
  tags: [] as string[],
  accessibility: [] as string[],
  faq: [] as any[],
  ageRestriction: "All Ages",
  dressCode: "No dress code",
  termsAndConditions: "Present a valid individual ticket at entry.",
  cancellationPolicy:
    "Refund requests are accepted until 24 hours before the event.",
  visibility: "PUBLIC",
  eventType: "IN_PERSON",
  status: "DRAFT",
};
const steps = [
  "Basics",
  "Media",
  "Date & time",
  "Venue",
  "Ticket types",
  "Schedule & highlights",
  "Policies",
  "Review & submit",
];
export function EventEditor({ preview = false }: { preview?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<any>(initial);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedId, setSavedId] = useState(id);
  const [dirty, setDirty] = useState(false);
  const saving = useRef(false);
  const hydratedId = useRef<string | undefined>(undefined);
  const editRevision = useRef(0);
  const categories = useData("/categories");
  const venues = useData("/venues", { limit: 100 });
  const existing = useData(`/organizers/events/${id}`, {}, !!id);
  const draft = useData("/organizers/event-draft", {}, !id && !preview);
  const restoredDraft = useRef(false);
  const draftWrites = useRef<Promise<unknown>>(Promise.resolve());
  const [draftStatus, setDraftStatus] = useState("");
  useEffect(() => {
    if (id || restoredDraft.current || !draft.data) return;
    restoredDraft.current = true;
    if (draft.data.draft && !dirty) {
      setForm({ ...initial, ...draft.data.draft.form });
      setStep(draft.data.draft.step);
      setDraftStatus("Your unfinished event has been restored.");
    }
  }, [draft.data, id, dirty]);
  useEffect(() => {
    if (existing.data && hydratedId.current !== id) {
      hydratedId.current = id;
      setSavedId(id);
      const e = existing.data.event;
      const local = (v: string) => {
        const d = new Date(v);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
      };
      setForm({
        ...initial,
        ...e,
        startDate: local(e.startDate),
        endDate: local(e.endDate),
        tickets: existing.data.tickets,
      });
      setDirty(false);
    }
  }, [existing.data, id]);
  const update = (key: string, value: any) => {
    editRevision.current++;
    setForm((f: any) => ({ ...f, [key]: value }));
    setDirty(true);
  };
  const ready = !!(
    form.title &&
    form.shortDescription &&
    form.description.length >= 20 &&
    form.category &&
    form.venue &&
    form.coverImage &&
    form.startDate &&
    form.endDate
  );
  const save = async (status: string, exit = false) => {
    if (saving.current) return;
    saving.current = true;
    const revision = editRevision.current;
    setBusy(true);
    try {
      const payload = {
        ...form,
        status,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      };
      const result = savedId
        ? await api.put(`/events/${savedId}`, payload)
        : await api.post("/events", payload);
      setSavedId(result.data.data.event._id);
      if (!id) {
        await draftWrites.current.catch(() => undefined);
        await api.delete("/organizers/event-draft");
        await queryClient.invalidateQueries({
          queryKey: ["/organizers/event-draft"],
        });
      }
      if (editRevision.current === revision) setDirty(false);
      setNotice(
        status === "DRAFT" ? "Draft saved" : "Submitted for admin review",
      );
      await queryClient.invalidateQueries({ queryKey: ["/organizers/events"] });
      if (exit) navigate("/organizer/events");
    } catch (err) {
      setNotice(message(err));
    } finally {
      setBusy(false);
      saving.current = false;
    }
  };
  useEffect(() => {
    if (!dirty || preview || savedId) return;
    const timeout = setTimeout(() => {
      if (saving.current) return;
      setDraftStatus("Saving your progress…");
      draftWrites.current = draftWrites.current
        .catch(() => undefined)
        .then(() => api.put("/organizers/event-draft", { form, step }))
        .then(() =>
          setDraftStatus("Progress saved. You can return to this event later."),
        )
        .catch((err) =>
          setDraftStatus(`Draft could not be saved: ${message(err)}`),
        );
    }, 1200);
    return () => clearTimeout(timeout);
  }, [form, step, dirty, preview, savedId]);
  const next = () => {
    const valid =
      step === 0
        ? form.title &&
          form.shortDescription &&
          form.description.length >= 20 &&
          form.category
        : step === 1
          ? form.coverImage
          : step === 2
            ? form.startDate &&
              form.endDate &&
              new Date(form.endDate) > new Date(form.startDate)
            : step === 3
              ? form.venue
              : step === 4
                ? form.tickets.every(
                    (t: any) =>
                      t.name &&
                      t.price >= 0 &&
                      Number.isInteger(t.totalQuantity) &&
                      t.totalQuantity > 0,
                  )
                : true;
    if (!valid) {
      setNotice("Complete this step with valid details before continuing.");
      return;
    }
    setNotice("");
    setStep(step + 1);
  };
  if (id && existing.isLoading) return <Skeleton />;
  if (existing.error) return <Notice error>{message(existing.error)}</Notice>;
  const review = (
    <div className="event-preview">
      {form.coverImage && <img src={form.coverImage} alt={form.title} />}
      <span className="eyebrow">Event preview</span>
      <h2>{form.title}</h2>
      <p>{form.shortDescription}</p>
      <p>
        {date(form.startDate)} — {date(form.endDate)}
      </p>
      <p>{venues.data?.venues?.find((v: any) => v._id === form.venue)?.name}</p>
      <p className="preserve-lines">{form.description}</p>
      {form.tickets.map((t: any, i: number) => (
        <p key={i}>
          {t.name} · {money(t.price)} · {t.totalQuantity} tickets
        </p>
      ))}
      <h3>Policies</h3>
      <p>{form.cancellationPolicy}</p>
      <p>{form.termsAndConditions}</p>
    </div>
  );
  return (
    <>
      <PageTitle
        eyebrow={preview ? "Moderation preview" : "Event studio"}
        title={
          preview
            ? "Review the experience."
            : id
              ? "Refine your next event."
              : "Bring your idea to life."
        }
      />
      {notice && <Notice>{notice}</Notice>}
      {draftStatus && (
        <p className="draft-status" role="status">
          {draftStatus}
        </p>
      )}
      {preview ? (
        review
      ) : (
        <>
          <ol className="wizard-steps">
            {steps.map((s, i) => (
              <li key={s} className={step === i ? "active" : ""}>
                <button
                  onClick={() => (i <= step ? setStep(i) : undefined)}
                  disabled={i > step}
                >
                  <span>{i + 1}</span>
                  {s}
                </button>
              </li>
            ))}
          </ol>
          <div className="panel form-stack">
            {step === 0 && (
              <>
                <Field label="Event title">
                  <input
                    value={form.title}
                    onChange={(e) => update("title", e.target.value)}
                    maxLength={180}
                  />
                </Field>
                <Field label="Short description">
                  <input
                    value={form.shortDescription}
                    onChange={(e) => update("shortDescription", e.target.value)}
                    maxLength={300}
                  />
                </Field>
                <Field label="Full description">
                  <textarea
                    rows={7}
                    value={form.description}
                    onChange={(e) => update("description", e.target.value)}
                    minLength={20}
                  />
                </Field>
                <Field label="Category">
                  <select
                    value={form.category}
                    onChange={(e) => update("category", e.target.value)}
                  >
                    <option value="">Choose category</option>
                    {categories.data?.categories?.map((c: any) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Event format">
                  <select
                    value={form.eventType}
                    onChange={(e) => update("eventType", e.target.value)}
                  >
                    <option value="IN_PERSON">In person</option>
                    <option value="ONLINE">Online</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </Field>
                <Field label="Tags, comma separated">
                  <input
                    value={form.tags.join(", ")}
                    onChange={(e) =>
                      update(
                        "tags",
                        e.target.value.split(",").map((s) => s.trim()),
                      )
                    }
                  />
                </Field>
              </>
            )}
            {step === 1 && (
              <>
                <div className="cover-library">
                  <h3>Choose an editorial cover</h3>
                  <p>
                    Start with an Eventra illustration, or upload your own event
                    photography below.
                  </p>
                  <div>
                    {["night", "space", "play"].map((art) => (
                      <button
                        type="button"
                        key={art}
                        aria-label={`Use ${art} cover`}
                        aria-pressed={
                          form.coverImage === `/images/editorial-${art}.svg`
                        }
                        onClick={() =>
                          update("coverImage", `/images/editorial-${art}.svg`)
                        }
                      >
                        <img
                          src={`/images/editorial-${art}.svg`}
                          alt={`${art} illustration`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <Field
                  label="Upload cover image"
                  hint="JPEG, PNG or WebP. Maximum 5 MB."
                >
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      const body = new FormData();
                      body.append("image", file);
                      try {
                        const res = await api.post("/uploads/image", body, {
                          headers: { "Content-Type": "multipart/form-data" },
                        });
                        update("coverImage", res.data.data.url);
                      } catch (err) {
                        setNotice(message(err));
                      } finally {
                        setUploading(false);
                      }
                    }}
                  />
                </Field>
                {uploading && <Notice>Uploading image…</Notice>}
                <Field label="Or use a hosted image URL">
                  <input
                    type="url"
                    value={
                      form.coverImage.startsWith("/images/")
                        ? ""
                        : form.coverImage
                    }
                    onChange={(e) => update("coverImage", e.target.value)}
                  />
                </Field>
                {form.coverImage && (
                  <img
                    className="wide-image"
                    src={form.coverImage}
                    alt="Cover preview"
                  />
                )}
                <Field label="Gallery image URLs, one per line">
                  <textarea
                    value={form.images.join("\n")}
                    onChange={(e) =>
                      update(
                        "images",
                        e.target.value.split("\n").filter(Boolean),
                      )
                    }
                  />
                </Field>
              </>
            )}
            {step === 2 && (
              <>
                <Field label="Starts (your browser’s local time)">
                  <input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(e) => update("startDate", e.target.value)}
                  />
                </Field>
                <Field label="Ends">
                  <input
                    type="datetime-local"
                    value={form.endDate}
                    onChange={(e) => update("endDate", e.target.value)}
                  />
                </Field>
                <Field label="Event timezone">
                  <input
                    value={form.timezone}
                    onChange={(e) => update("timezone", e.target.value)}
                  />
                </Field>
              </>
            )}
            {step === 3 && (
              <>
                <Field label="Venue">
                  <select
                    value={form.venue}
                    onChange={(e) => update("venue", e.target.value)}
                  >
                    <option value="">Select venue</option>
                    {venues.data?.venues?.map((v: any) => (
                      <option key={v._id} value={v._id}>
                        {v.name} · {v.city}
                      </option>
                    ))}
                  </select>
                </Field>
                <p>Need another venue? Add it below, then select it.</p>
                <VenueCreate
                  onCreated={(venue) => {
                    update("venue", venue._id);
                    void queryClient.invalidateQueries({
                      queryKey: ["/venues"],
                    });
                  }}
                />
              </>
            )}
            {step === 4 && (
              <>
                {form.tickets.map((t: any, i: number) => (
                  <div className="tier-editor" key={i}>
                    {[
                      ["name", "Ticket name", "text"],
                      ["price", "Price (₹)", "number"],
                      ["totalQuantity", "Inventory", "number"],
                      ["maxPerBooking", "Maximum per customer", "number"],
                    ].map(([key, label, type]) => (
                      <Field key={key} label={label}>
                        <input
                          type={type}
                          min={key === "price" ? 0 : 1}
                          step={key === "price" ? "0.01" : 1}
                          value={t[key]}
                          onChange={(e) =>
                            update(
                              "tickets",
                              form.tickets.map((x: any, j: number) =>
                                j === i
                                  ? {
                                      ...x,
                                      [key]:
                                        type === "number"
                                          ? Number(e.target.value)
                                          : e.target.value,
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                      </Field>
                    ))}
                    <Button
                      variant="secondary"
                      disabled={form.tickets.length === 1}
                      onClick={() =>
                        update(
                          "tickets",
                          form.tickets.filter((_: any, j: number) => j !== i),
                        )
                      }
                    >
                      Remove tier
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={() =>
                    update("tickets", [
                      ...form.tickets,
                      {
                        name: "",
                        price: 0,
                        totalQuantity: 100,
                        maxPerBooking: 6,
                      },
                    ])
                  }
                >
                  Add ticket tier
                </Button>
              </>
            )}
            {step === 5 && (
              <>
                <Field label="Highlights, one per line">
                  <textarea
                    value={form.highlights.join("\n")}
                    onChange={(e) =>
                      update("highlights", e.target.value.split("\n"))
                    }
                  />
                </Field>
                {form.schedule.map((s: any, i: number) => (
                  <div className="input-action" key={i}>
                    <Field label="Time">
                      <input
                        value={s.time}
                        onChange={(e) =>
                          update(
                            "schedule",
                            form.schedule.map((x: any, j: number) =>
                              j === i ? { ...x, time: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field label="Activity">
                      <input
                        value={s.title}
                        onChange={(e) =>
                          update(
                            "schedule",
                            form.schedule.map((x: any, j: number) =>
                              j === i ? { ...x, title: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        update(
                          "schedule",
                          form.schedule.filter((_: any, j: number) => j !== i),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  onClick={() =>
                    update("schedule", [
                      ...form.schedule,
                      { time: "", title: "", description: "" },
                    ])
                  }
                >
                  Add schedule item
                </Button>
              </>
            )}
            {step === 6 && (
              <>
                {[
                  ["ageRestriction", "Age restriction"],
                  ["dressCode", "Dress code"],
                  ["cancellationPolicy", "Cancellation policy"],
                  ["termsAndConditions", "Terms and conditions"],
                ].map(([key, label]) => (
                  <Field key={key} label={label}>
                    <textarea
                      value={form[key]}
                      onChange={(e) => update(key, e.target.value)}
                    />
                  </Field>
                ))}
                <Field label="Accessibility facilities, one per line">
                  <textarea
                    value={form.accessibility.join("\n")}
                    onChange={(e) =>
                      update(
                        "accessibility",
                        e.target.value.split("\n").filter(Boolean),
                      )
                    }
                  />
                </Field>
              </>
            )}
            {step === 7 && review}
            <div className="wizard-actions">
              <Button
                variant="secondary"
                disabled={step === 0}
                onClick={() => setStep(step - 1)}
              >
                Back
              </Button>
              <Button
                variant="secondary"
                disabled={!!savedId && !ready}
                busy={busy}
                onClick={async () => {
                  if (ready) return save("DRAFT", true);
                  saving.current = true;
                  setBusy(true);
                  try {
                    await draftWrites.current.catch(() => undefined);
                    await api.put("/organizers/event-draft", { form, step });
                    await queryClient.invalidateQueries({
                      queryKey: ["/organizers/event-draft"],
                    });
                    navigate("/organizer/events");
                  } catch (err) {
                    setNotice(message(err));
                  } finally {
                    setBusy(false);
                    saving.current = false;
                  }
                }}
              >
                Save & exit
              </Button>
              {step < 7 ? (
                <Button onClick={next}>Continue →</Button>
              ) : (
                <Button
                  busy={busy}
                  onClick={() => save("PENDING_REVIEW", true)}
                >
                  Submit for review
                </Button>
              )}
            </div>
            <small>
              New-event progress saves automatically to your account. Use Save &
              exit to keep an unfinished event. Events require approval before
              publication.
            </small>
          </div>
        </>
      )}
    </>
  );
}
function VenueCreate({ onCreated }: { onCreated: (venue: any) => void }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(!open)}>
        {open ? "Close venue form" : "Add venue"}
      </Button>
      {open && (
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const values = Object.fromEntries(new FormData(e.currentTarget));
            try {
              const res = await api.post("/venues", {
                ...values,
                capacity: Number(values.capacity),
                amenities: [],
              });
              onCreated(res.data.data.venue);
              setOpen(false);
            } catch (err) {
              setNotice(message(err));
            }
          }}
        >
          {notice && <Notice error>{notice}</Notice>}
          {[
            ["name", "Venue name"],
            ["address", "Address"],
            ["city", "City"],
            ["state", "State"],
            ["capacity", "Capacity"],
            ["image", "Image URL"],
          ].map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                name={key}
                required
                type={
                  key === "capacity"
                    ? "number"
                    : key === "image"
                      ? "url"
                      : "text"
                }
              />
            </Field>
          ))}
          <Button>Create venue</Button>
        </form>
      )}
    </>
  );
}
