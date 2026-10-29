import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { AlertTriangle, Eye, EyeOff, Trash2 } from "lucide-react";
import api from "@/lib/axios.ts";
import { useAuth } from "@/contexts/AuthContext";

/** Typed by Google/Apple accounts, which have no password to re-enter; must match the API. */
const DELETION_PHRASE = "DELETE";

export default function DeleteAccount() {
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  // Google/Apple accounts have no password; they confirm by typing the phrase.
  const [hasPassword, setHasPassword] = useState(true);
  const [phrase, setPhrase] = useState("");

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setPhrase("");
    setShowPassword(false);
    setError("");
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
      return;
    }
    api
      .get("/user/profile")
      .then((res) => setHasPassword(res.data?.data?.user?.hasPassword !== false))
      .catch(() => setHasPassword(true));
  };

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (hasPassword && (!email.trim() || !password)) {
      setError("Please enter both your email and password to confirm.");
      return;
    }
    if (!hasPassword && phrase.trim().toUpperCase() !== DELETION_PHRASE) {
      setError(`Please type ${DELETION_PHRASE} to confirm.`);
      return;
    }

    setLoading(true);
    try {
      await api.delete("/user/account", {
        data: hasPassword
          ? { email: email.trim(), password }
          : { confirmation: DELETION_PHRASE },
      });

      setIsOpen(false);
      // Clears stored credentials and redirects to the home page
      logout();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "Failed to delete account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          className="rounded-full px-6 py-2.5 h-auto font-semibold shadow-md hover:shadow-lg transition-all duration-300"
        >
          <Trash2 className="w-4 h-4" />
          Delete Account
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-2">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <DialogTitle className="text-xl font-bold text-gray-900">
            Delete your account?
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            This action cannot be undone. Your profile, plans and all tracked
            progress will be permanently removed from our servers.{" "}
            {hasPassword
              ? "Confirm with your email and password to continue."
              : `You signed up with Google or Apple, so type ${DELETION_PHRASE} to confirm.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={deleteAccount} className="space-y-4 mt-2">
          {hasPassword ? (
            <>
          <div className="space-y-2">
            <Label htmlFor="delete-email" className="text-gray-700">
              Email
            </Label>
            <Input
              id="delete-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-password" className="text-gray-700">
              Password
            </Label>
            <div className="relative">
              <Input
                id="delete-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="delete-phrase" className="text-gray-700">
                Type {DELETION_PHRASE} to confirm
              </Label>
              <Input
                id="delete-phrase"
                autoComplete="off"
                autoCapitalize="characters"
                placeholder={DELETION_PHRASE}
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                className="h-11"
                disabled={loading}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="rounded-full"
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete my account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
