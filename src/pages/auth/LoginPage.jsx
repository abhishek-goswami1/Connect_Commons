import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import illustrationImg from "@/assets/Illustration_image/login_pageImage.jpg";

export default function LoginPage() {
  const { login, user, profile, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Already logged in — redirect to the correct dashboard based on role
  if (!authLoading && user && profile) {
    return <Navigate to={role === "admin" ? "/admin" : "/user"} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsSubmitting(true);
    const { error: loginError } = await login(email.trim(), password);
    setIsSubmitting(false);

    if (loginError) {
      if (
        loginError.message?.toLowerCase().includes("invalid login credentials") ||
        loginError.message?.toLowerCase().includes("invalid email or password")
      ) {
        setError("Incorrect email or password. Please try again.");
      } else if (loginError.message?.toLowerCase().includes("email not confirmed")) {
        setError("Your email is not confirmed. Please contact your administrator.");
      } else if (loginError.message?.toLowerCase().includes("too many requests")) {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError("Unable to sign in. Please check your credentials.");
      }
      return;
    }

    // Role-based routing is handled by onAuthStateChange → profile fetch
    // We navigate to a neutral point; the route guards redirect to the right place.
    // After login, AuthContext will set role, then the route guard redirects.
    navigate("/admin", { replace: true }); // AdminRoute redirects users → /user automatically
  }

  return (
    <div className="flex h-[100vh] w-full bg-white">

      {/* ── LEFT PANEL — Login Form ── */}
      <div className="flex w-full flex-col justify-center px-8 py-12 sm:px-12 lg:w-1/2 xl:px-20">
        <div className="mx-auto w-full max-w-md">

          {/* Heading */}
          <div className="mb-10">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
              Welcome back!
            </h1>
            <p className="mt-3 text-sm text-gray-500 leading-relaxed">
              Sign in to access your Connect Commons workspace.<br />
              Manage assignments, track submissions, and more.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              role="alert"
              className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Email */}
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              disabled={isSubmitting}
              className="w-full rounded-full border border-gray-300 bg-white px-5 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"
            />

            {/* Password */}
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                disabled={isSubmitting}
                className="w-full rounded-full border border-gray-300 bg-white px-5 py-3.5 pr-12 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-gray-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/30 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Login"
              )}
            </button>

          </form>

          {/* Divider */}
          <div className="my-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">Access is by invitation only</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* No public sign-up — as per PRD */}
          <p className="mt-8 text-center text-sm text-gray-400">
            Don't have an account?{" "}
            <span
              className="font-medium text-gray-400 cursor-not-allowed select-none"
              title="Accounts are created by an administrator"
            >
              Contact your admin
            </span>
          </p>

        </div>
      </div>

      {/* ── RIGHT PANEL — Static Illustration ── */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden rounded-l-3xl bg-[#f0f4ee]">
        <img
          src={illustrationImg}
          alt="Connect Commons illustration"
          className="h-full w-full object-cover object-center"
        />

        {/* Caption overlay at the bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#f0f4ee]/95 via-[#f0f4ee]/60 to-transparent px-10 pb-10 pt-16 text-center">
          <p className="text-base text-gray-600 leading-snug">
            Make your work easier and organized with{" "}
            <span className="font-bold text-gray-800">Connect Commons</span>
          </p>
        </div>
      </div>

    </div>
  );
}
