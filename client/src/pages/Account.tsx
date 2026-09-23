import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/axios.js";
import { useAuthStore } from "../store/useAuthStore.js";
import { Button, Field, Notice, PageTitle, message } from "../components/ui.js";
export function AccountPage({
  mode,
}: {
  mode:
    | "login"
    | "register"
    | "forgot-password"
    | "reset-password"
    | "verify-email";
}) {
  const [params] = useSearchParams();
  const [role, setRole] = useState(
    params.get("role") === "ORGANIZER" ? "ORGANIZER" : "USER",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const titles = {
    login: "Welcome back.",
    register: "Your next chapter starts here.",
    "forgot-password": "Let’s get you back in.",
    "reset-password": "Choose a new password.",
    "verify-email": "Confirm your email.",
  };
  return (
    <div className="account-layout">
      <div className="account-story">
        <span className="eyebrow">More than a ticket</span>
        <h2>
          A moment.
          <br />A connection.
          <br />
          <em>A memory.</em>
        </h2>
        <p>Your place in the crowd is waiting.</p>
      </div>
      <div className="account-form">
        <PageTitle eyebrow="Eventra account" title={titles[mode]} />
        {error && <Notice error>{error}</Notice>}
        {success && <Notice>{success}</Notice>}
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const fields = Object.fromEntries(new FormData(e.currentTarget));
            setBusy(true);
            setError("");
            try {
              const payload = {
                ...fields,
                ...(mode === "register" ? { role } : {}),
                ...(params.get("token") ? { token: params.get("token") } : {}),
              };
              const response = await api.post(`/auth/${mode}`, payload);
              if (response.data.data?.token) {
                const { user, token } = response.data.data;
                setAuth(user, token);
                const next = params.get("next");
                if (
                  next?.startsWith("/") &&
                  !next.startsWith("//") &&
                  !next.includes("\\")
                ) {
                  navigate(next);
                  return;
                }
                navigate(
                  user.role === "ADMIN"
                    ? "/admin"
                    : user.role === "ORGANIZER"
                      ? "/organizer/profile"
                      : "/dashboard",
                );
              } else setSuccess(response.data.message);
            } catch (err) {
              setError(message(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === "register" && (
            <>
              <div className="tabs">
                <Button
                  type="button"
                  variant={role === "USER" ? "primary" : "secondary"}
                  onClick={() => setRole("USER")}
                >
                  Attendee
                </Button>
                <Button
                  type="button"
                  variant={role === "ORGANIZER" ? "primary" : "secondary"}
                  onClick={() => setRole("ORGANIZER")}
                >
                  Organizer
                </Button>
              </div>
              <Field label="Full name">
                <input
                  name="name"
                  required
                  maxLength={100}
                  autoComplete="name"
                />
              </Field>
              {role === "ORGANIZER" && (
                <Field label="Organization name">
                  <input name="organizationName" required maxLength={150} />
                </Field>
              )}
              <Field label="Phone">
                <input name="phone" type="tel" autoComplete="tel" />
              </Field>
            </>
          )}
          {["login", "register", "forgot-password"].includes(mode) && (
            <Field label="Email address">
              <input name="email" type="email" required autoComplete="email" />
            </Field>
          )}
          {["login", "register", "reset-password"].includes(mode) && (
            <Field
              label="Password"
              hint={
                mode === "login"
                  ? undefined
                  : "At least 10 characters, with uppercase, lowercase and a number."
              }
            >
              <input
                name="password"
                type="password"
                minLength={mode === "login" ? 1 : 10}
                maxLength={72}
                required
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </Field>
          )}
          {mode === "verify-email" && (
            <p>
              Confirm the email address associated with your Eventra account.
            </p>
          )}
          <Button busy={busy}>
            {mode === "login"
              ? "Sign in"
              : mode === "register"
                ? "Create account"
                : mode === "verify-email"
                  ? "Verify email"
                  : mode === "forgot-password"
                    ? "Send reset link"
                    : "Reset password"}
          </Button>
        </form>
        <div className="account-links">
          {mode === "login" ? (
            <>
              <Link to="/forgot-password">Forgot password?</Link>
              <Link to="/register">Create an account</Link>
            </>
          ) : (
            <Link to="/login">Back to sign in</Link>
          )}
        </div>
      </div>
    </div>
  );
}
