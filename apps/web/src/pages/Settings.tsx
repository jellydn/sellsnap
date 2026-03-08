import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  slug: string;
  avatarUrl: string | null;
}

export function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed to fetch profile" }));
          throw new Error(err.error || "Failed to fetch profile");
        }
        return res.json();
      })
      .then((data) => {
        setProfile(data);
        setName(data.name);
        setSlug(data.slug);
        setAvatarPreview(data.avatarUrl);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("slug", slug);
      if (avatar) {
        formData.append("avatar", avatar);
      }

      const response = await fetch("/api/profile", {
        method: "PUT",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed to update profile" }));
        throw new Error(err.error || "Failed to update profile");
      }

      const updated = await response.json();
      setProfile(updated);
      setSuccess("Profile updated successfully!");
      setAvatarPreview(updated.avatarUrl);
      setAvatar(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-red-500">{error}</p>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 text-white bg-gray-600 rounded hover:bg-gray-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600">{error}</div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-green-600">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="avatar" className="block text-sm font-medium mb-1">
            Avatar
          </label>
          <div className="flex items-center gap-4">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-500">
                  {name?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <input
              id="avatar"
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-md"
          />
        </div>

        <div>
          <label htmlFor="slug" className="block text-sm font-medium mb-1">
            Slug (public profile URL)
          </label>
          <div className="flex items-center">
            <span className="px-3 py-2 bg-gray-100 border border-r-0 rounded-l-md text-gray-500">
              /
            </span>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className="flex-1 px-3 py-2 border rounded-r-md"
            />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Your profile will be at: {window.location.origin}/creator/{slug}
          </p>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={profile?.email || ""}
            disabled
            className="w-full px-3 py-2 border rounded-md bg-gray-50"
          />
          <p className="mt-1 text-sm text-gray-500">Email cannot be changed.</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
