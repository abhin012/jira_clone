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
        setMessage(res.data.message);
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