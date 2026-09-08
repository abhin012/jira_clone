"use client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";
import axiosInstance from "@/lib/Axiosinstance";
import { AlertCircle, Mail, Save, Camera, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import React, { useRef, useState } from "react";

const ALLOWED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const page = () => {
  const { user, updateUser, logout, selectedProject } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [group, setGroup] = useState(user?.group || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || "");
  const [avatarError, setAvatarError] = useState("");
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [avatarSaveMessage, setAvatarSaveMessage] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [verificationMethod, setVerificationMethod] = useState<"OTP" | "LINK">("OTP");
  const [emailChangeMessage, setEmailChangeMessage] = useState("");
  const [emailChangeError, setEmailChangeError] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [devLink, setDevLink] = useState("");
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [awaitingLink, setAwaitingLink] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [isConfirmingOtp, setIsConfirmingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(
    user?.emailNotificationsEnabled !== false,
  );
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState("");

  if (!user) {
    return <div className="p-6">User not found</div>;
  }

  const handleTogglePrefs = async (checked: boolean) => {
    setEmailNotificationsEnabled(checked);
    try {
      setIsSavingPrefs(true);
      const res = await axiosInstance.put(`/api/users/${user.id}/notification-preferences`, {
        emailNotificationsEnabled: checked,
      });
      updateUser(res.data);
      setPrefsMessage("Saved");
    } catch (err: any) {
      setEmailNotificationsEnabled(!checked);
      setPrefsMessage(err.response?.data?.message || "Failed to save preference");
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const isInfoDirty =
    name !== (user.name || "") ||
    phone !== (user.phone || "") ||
    group !== (user.group || "");

  const isAvatarDirty = avatarPreview !== (user.avatar || "");

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError("");
    setAvatarSaveMessage("");

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError("Unsupported format — use PNG, JPEG, GIF, or WEBP");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Image must be under 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveInfo = async () => {
    try {
      setIsSaving(true);
      setSaveMessage("");
      const res = await axiosInstance.put(`/api/users/${user.id}`, {
        name,
        group,
        phone,
        avatar: user.avatar,
      });
      updateUser(res.data);
      setSaveMessage("Saved!");
    } catch (error: any) {
      setSaveMessage(error.response?.data?.message || "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAvatar = async () => {
    try {
      setIsSavingAvatar(true);
      setAvatarSaveMessage("");
      const res = await axiosInstance.put(`/api/users/${user.id}`, {
        name: user.name,
        group: user.group,
        phone: user.phone,
        avatar: avatarPreview,
      });
      updateUser(res.data);
      setAvatarSaveMessage("Photo updated!");
    } catch (error: any) {
      setAvatarSaveMessage(error.response?.data?.message || "Failed to save photo");
    } finally {
      setIsSavingAvatar(false);
    }
  };

    const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailChangeError("");
    setEmailChangeMessage("");
    setDevOtp("");
    setDevLink("");

    try {
      setIsSubmittingEmail(true);
      const res = await axiosInstance.post(
        `/api/users/${user.id}/email-change-request`,
        { newEmail, currentPassword: emailPassword, method: verificationMethod },
      );
      setEmailChangeMessage(res.data.message);
      if (res.data.devOtp) setDevOtp(res.data.devOtp);
      if (res.data.devLink) setDevLink(res.data.devLink);

      if (verificationMethod === "OTP") {
        setAwaitingOtp(true);
      } else {
        setAwaitingLink(true);
      }
      setEmailPassword("");
    } catch (err: any) {
      setEmailChangeError(
        err.response?.data?.message || "Failed to request email change",
      );
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError("");

    try {
      setIsConfirmingOtp(true);
      const res = await axiosInstance.put(`/api/users/${user.id}/confirm-email`, {
        otp: otpInput,
      });
      updateUser(res.data);
      setAwaitingOtp(false);
      setOtpInput("");
      setNewEmail("");
      setDevOtp("");
      setEmailChangeMessage("Email updated successfully.");
    } catch (err: any) {
      setOtpError(err.response?.data?.message || "Failed to confirm code");
    } finally {
      setIsConfirmingOtp(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords don't match");
      return;
    }

    try {
      setIsSubmittingPassword(true);
      const res = await axiosInstance.put(`/api/users/${user.id}/password`, {
        currentPassword,
        newPassword,
      });
      setPasswordMessage(res.data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || "Failed to change password");
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleDeactivate = async () => {
    if (
      !confirm(
        "Deactivate your account? You won't be able to log in again afterward. This can't be undone from here.",
      )
    )
      return;

    try {
      await axiosInstance.put(`/api/users/${user.id}/deactivate`);
      alert("Your account has been deactivated.");
      logout();
      router.push("/login");
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to deactivate account");
    }
  };

  return (
    <div className="flex h-full flex-col p-6 overflow-auto bg-[#F4F5F7]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#172B4D] mb-2">
          Profile Settings
        </h1>
        <p className="text-[#5E6C84]">
          Manage your personal information and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-[#172B4D]">About You</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="relative group mb-2"
                  title="Change profile picture"
                >
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatarPreview || "/placeholder.svg"} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-5 w-5 text-white" />
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                {avatarError && (
                  <p className="text-xs text-red-600 mb-1">{avatarError}</p>
                )}
                {avatarSaveMessage && (
                  <p className="text-xs text-[#0052CC] mb-1">{avatarSaveMessage}</p>
                )}
                {isAvatarDirty && (
                  <Button
                    size="sm"
                    onClick={handleSaveAvatar}
                    disabled={isSavingAvatar}
                    className="mb-2 bg-[#0052CC] text-white hover:bg-[#0747A6]"
                  >
                    {isSavingAvatar ? "Saving..." : "Save Photo"}
                  </Button>
                )}
                <h2 className="text-xl font-semibold text-[#172B4D]">
                  {user.name}
                </h2>
                {selectedProject && (
                  <Badge
                    className={`mt-2 ${
                      selectedProject.ownerId === user.id
                        ? "bg-red-100 text-red-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {selectedProject.ownerId === user.id ? "Admin" : "Member"} · {selectedProject.name}
                  </Badge>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-[#5E6C84]" />
                  <span className="text-[#172B4D]">{user.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[#5E6C84]">Group:</span>
                  <Badge variant="outline">{user?.group}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {}
        <div className="lg:col-span-2 space-y-6">
          {}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#172B4D]">
                Personal Information
              </CardTitle>
              <CardDescription>Update your name, contact info, and team</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {saveMessage && (
                  <div className="text-sm text-[#0052CC]">{saveMessage}</div>
                )}
                <div>
                  <label className="text-sm font-semibold text-[#172B4D] mb-1 block">
                    Full Name
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="focus-visible:ring-[#0052CC]"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-[#172B4D] mb-1 block">
                    Phone
                  </label>
                  <Input
                    type="tel"
                    placeholder="e.g. +1 555 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="focus-visible:ring-[#0052CC]"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-[#172B4D] mb-1 block">
                    Department / Group
                  </label>
                  <Input
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    className="focus-visible:ring-[#0052CC]"
                  />
                </div>
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSaveInfo}
                    disabled={isSaving || !isInfoDirty}
                    className="bg-[#0052CC] text-white hover:bg-[#0747A6] disabled:opacity-50"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

                    {}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#172B4D]">Notification Preferences</CardTitle>
              <CardDescription>Control which notifications also go to your email</CardDescription>
            </CardHeader>
            <CardContent>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-[#172B4D]">
                  Email me for task assignments, status changes, sprint updates, and reminders
                </span>
                <input
                  type="checkbox"
                  checked={emailNotificationsEnabled}
                  disabled={isSavingPrefs}
                  onChange={(e) => handleTogglePrefs(e.target.checked)}
                  className="h-5 w-5 shrink-0"
                />
              </label>
              {prefsMessage && (
                <p className="text-xs text-[#0052CC] mt-2">{prefsMessage}</p>
              )}
            </CardContent>
          </Card>

          {}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#172B4D]">Email Address</CardTitle>
              <CardDescription>
                Changing your email requires a 6-digit verification code
              </CardDescription>
            </CardHeader>
            <CardContent>
              {emailChangeError && (
                <div className="mb-4 flex gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{emailChangeError}</span>
                </div>
              )}
              {emailChangeMessage && (
                <div className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-700 space-y-1">
                  <p>{emailChangeMessage}</p>
                  {devOtp && (
                    <p className="font-mono font-bold tracking-widest text-base">
                      {devOtp}
                    </p>
                  )}
                </div>
              )}

                            {!awaitingOtp && !awaitingLink ? (
                <form onSubmit={handleRequestEmailChange} className="space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-[#172B4D] mb-1 block">
                      New Email
                    </label>
                    <Input
                      type="email"
                      placeholder="new@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                      className="focus-visible:ring-[#0052CC]"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#172B4D] mb-1 block">
                      Current Password
                    </label>
                    <Input
                      type="password"
                      placeholder="Confirm it's you"
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                      required
                      className="focus-visible:ring-[#0052CC]"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#172B4D] mb-1 block">
                      Verification method
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="verificationMethod"
                          checked={verificationMethod === "OTP"}
                          onChange={() => setVerificationMethod("OTP")}
                        />
                        6-digit code
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="radio"
                          name="verificationMethod"
                          checked={verificationMethod === "LINK"}
                          onChange={() => setVerificationMethod("LINK")}
                        />
                        Confirmation link
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={isSubmittingEmail}
                      className="bg-[#0052CC] text-white hover:bg-[#0747A6]"
                    >
                      {isSubmittingEmail
                        ? "Sending..."
                        : verificationMethod === "OTP"
                          ? "Send Verification Code"
                          : "Send Verification Link"}
                    </Button>
                  </div>
                </form>
              ) : awaitingLink ? (
                <div className="space-y-4">
                  <p className="text-sm text-[#5E6C84]">
                    Check your email and click the link to finish confirming your
                    new address. This screen doesn't need to stay open.
                  </p>
                  {devLink && (
                    <Link
                      href={devLink}
                      className="text-sm font-semibold text-[#0052CC] underline break-all"
                    >
                      {devLink}
                    </Link>
                  )}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setAwaitingLink(false);
                        setDevLink("");
                      }}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleConfirmOtp} className="space-y-4">
                  {otpError && (
                    <div className="flex gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{otpError}</span>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-semibold text-[#172B4D] mb-1 block">
                      Enter 6-digit code
                    </label>
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      required
                      className="focus-visible:ring-[#0052CC] font-mono tracking-widest"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setAwaitingOtp(false);
                        setOtpInput("");
                        setOtpError("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isConfirmingOtp}
                      className="bg-[#0052CC] text-white hover:bg-[#0747A6]"
                    >
                      {isConfirmingOtp ? "Confirming..." : "Confirm Email Change"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#172B4D]">Password</CardTitle>
              <CardDescription>
                At least 8 characters, with uppercase, lowercase, a number, and a symbol
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                {passwordError && (
                  <div className="flex gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{passwordError}</span>
                  </div>
                )}
                {passwordMessage && (
                  <div className="text-sm text-[#0052CC]">{passwordMessage}</div>
                )}
                <div>
                  <label className="text-sm font-semibold text-[#172B4D] mb-1 block">
                    Current Password
                  </label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="focus-visible:ring-[#0052CC]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-[#172B4D] mb-1 block">
                      New Password
                    </label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="focus-visible:ring-[#0052CC]"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#172B4D] mb-1 block">
                      Confirm New Password
                    </label>
                    <Input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      className="focus-visible:ring-[#0052CC]"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={isSubmittingPassword}
                    className="bg-[#0052CC] text-white hover:bg-[#0747A6]"
                  >
                    {isSubmittingPassword ? "Updating..." : "Update Password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {}
          <Card>
            <CardHeader>
              <CardTitle className="text-[#172B4D]">Activity</CardTitle>
              <CardDescription>
                Your account activity information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#5E6C84]">Account Created</span>
                  <span className="text-[#172B4D] font-semibold">
                    {new Date(user?.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Deactivating your account will prevent you from logging in.
                Your projects, issues, comments, and time logs are preserved
                for auditing — nothing is deleted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={handleDeactivate}
              >
                Deactivate Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default page;