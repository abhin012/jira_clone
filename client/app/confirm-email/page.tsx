"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import axiosInstance from "@/lib/Axiosinstance";
import Link from "next/link";
import { FolderKanban, CheckCircle, XCircle } from "lucide-react";

const page = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");

  const hasConfirmed = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }

    if (hasConfirmed.current) return;
    hasConfirmed.current = true;

    const confirm = async () => {
      try {
        const res = await axiosInstance.get("/api/users/confirm-email-link", {
          params: { token },
        });
        setStatus("success");

        // If this browser has an active session for the SAME account whose
        // email just changed (the common case: the link is opened in a new
        // tab of the same browser the request came from), patch the stored
        // email directly rather than leaving that other tab showing the
        // stale one until a manual refresh or re-login. Writing to
        // localStorage here also fires a `storage` event in any OTHER open
        // tab of this origin — see AuthContext.tsx — so an already-open
        // profile tab picks this up live, without the user doing anything
        // there at all.
        try {
          const storedUser = localStorage.getItem("user");
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            if (parsed?.id === res.data.id) {
              localStorage.setItem(
                "user",
                JSON.stringify({ ...parsed, email: res.data.email }),
              );
              setMessage(
                "Your email has been updated. Any other open tab will pick this up automatically.",
              );
            } else {
              setMessage(
                "Email updated successfully. Please log in with your new email.",
              );
            }
          } else {
            setMessage(
              "Email updated successfully. Please log in with your new email.",
            );
          }
        } catch {
          setMessage(res.data.message);
        }
      } catch (err: any) {
        setStatus("error");
        setMessage(err.response?.data?.message || "Failed to confirm email");
      }
    };
    confirm();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F5F7] p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-[#0052CC] text-white">
            <FolderKanban className="h-8 w-8" />
          </div>
        </div>

        {status === "loading" && (
          <p className="text-[#5E6C84]">Confirming your email…</p>
        )}

        {status === "success" && (
          <div className="space-y-3">
            <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
            <p className="text-[#172B4D] font-semibold">{message}</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <XCircle className="h-10 w-10 text-red-600 mx-auto" />
            <p className="text-[#172B4D] font-semibold">{message}</p>
          </div>
        )}

        <Link
          href="/login"
          className="text-[#0052CC] hover:underline font-semibold block"
        >
          Go to login
        </Link>
      </div>
    </div>
  );
};

export default page;