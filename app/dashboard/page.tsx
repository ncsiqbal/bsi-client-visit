
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  full_name: string;
  role: string;
  area: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [errorMessage, setErrorMessage] = useState("Memeriksa sesi login...");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, role, area")
        .eq("id", user.id)
        .single();

      if (!active) return;

      if (error) {
        setErrorMessage(
          `Login terdeteksi, tetapi profil belum dapat dibaca: ${error.message}`,
        );
        return;
      }

      setProfile(data);
      setErrorMessage("");
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <section className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-blue-700">
          BIO SARANA INDONESIA
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Dashboard BSI
        </h1>

        {profile ? (
          <div className="mt-6 space-y-3">
            <p>Nama: {profile.full_name}</p>
            <p>Role: {profile.role}</p>
            <p>Area: {profile.area ?? "-"}</p>
            <p className="text-sm text-green-700">
              Profil berhasil dibaca.
            </p>
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-600">
            {errorMessage}
          </p>
        )}

        <button
          onClick={handleLogout}
          className="mt-8 rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-700"
        >
          Keluar
        </button>
      </section>
    </main>
  );
}
