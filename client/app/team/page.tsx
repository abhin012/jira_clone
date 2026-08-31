"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/AuthContext";
import axiosInstance from "@/lib/Axiosinstance";
import { AlertCircle, Mail, Trash2, UserPlus } from "lucide-react";
import React, { useEffect, useState } from "react";

const page = () => {
  const { selectedProject, setSelectedProject } = useAuth();
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", group: "" });
  const [addError, setAddError] = useState("");
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);
  const [addedExisting, setAddedExisting] = useState<any>(null);
  const [invited, setInvited] = useState<{ name: string; email: string } | null>(null);
  const fetchMembers = async () => {
    if (!selectedProject?.id) return;
    try {
      setLoading(true);
      const res = await axiosInstance.get(
        `/api/projects/${selectedProject?.id}`,
      );
      setTeamMembers(res.data.members || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchMembers();
  }, [selectedProject]);

  const openAddMemberModal = () => {
    setForm({ name: "", email: "", group: "" });
    setAddError("");
    setCreatedCreds(null);
    setAddedExisting(null);
    setInvited(null);
    setIsAddOpen(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setAddError("");
  };

  const handleAddmember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    if (!form.name.trim() || !form.email.trim()) {
      setAddError("Name and email are required");
      return;
    }

    try {
      setLoading(true);

      // Check if this person already has an account.
      let existingUser = null;
      try {
        const lookupRes = await axiosInstance.get("/api/users/by-email", {
          params: { email: form.email },
        });
        existingUser = lookupRes.data;
      } catch {
        // No account found — fall through to creating a new one.
      }

     if (existingUser) {
        if ((selectedProject.memberIds || []).includes(existingUser.id)) {
          setAddError("This person is already a member of this project");
          return;
        }

        const updatedmemberids = Array.from(
          new Set([...(selectedProject.memberIds || []), existingUser.id]),
        );
        await axiosInstance.put(`/api/projects/${selectedProject.id}`, {
          name: selectedProject.name,
          description: selectedProject.description,
          memberIds: updatedmemberids,
        });
        setSelectedProject({ ...selectedProject, memberIds: updatedmemberids });
        await fetchMembers();
        setAddedExisting(existingUser);
      } else {
        const avatar = `https://i.pravatar.cc/150?u=${form.email}`;

        const res = await axiosInstance.post("/api/users/invite", {
          name: form.name,
          email: form.email,
          group: form.group || "General",
          avatar: avatar,
        });
        const newuser = res.data;
        const updatedmemberids = Array.from(
          new Set([...(selectedProject.memberIds || []), newuser.id]),
        );
        await axiosInstance.put(`/api/projects/${selectedProject.id}`, {
          name: selectedProject.name,
          description: selectedProject.description,
          memberIds: updatedmemberids,
        });
        setSelectedProject({ ...selectedProject, memberIds: updatedmemberids });
        await fetchMembers();
        setInvited({ name: form.name, email: form.email });
      }
    } catch (error: any) {
      setAddError(error.response?.data?.message || "Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (userid: string, name: string) => {
    if (!selectedProject) return;
    if (!confirm(`Remove ${name} from project?`)) return;
    try {
      setLoading(true);
      const updatedmemberids = selectedProject?.memberIds?.filter(
        (id: string) => id !== userid,
      );
      await axiosInstance.put(`/api/projects/${selectedProject.id}`, {
        name: selectedProject.name,
        description: selectedProject.description,
        memberIds: updatedmemberids,
      });
      setSelectedProject({ ...selectedProject, memberIds: updatedmemberids });
      await fetchMembers();
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };
  const groupMap = new Map<string, any[]>();
  teamMembers.forEach((member: any) => {
    if (!groupMap.has(member.group)) {
      groupMap.set(member.group, []);
    }
    groupMap.get(member.group)?.push(member);
  });
  const groups = Array.from(groupMap.keys());
  const filteredMembers = selectedGroup
    ? teamMembers.filter((member: any) => member.group === selectedGroup)
    : teamMembers;
  return (
    <div className="p-8 h-full flex flex-col bg-[#F4F5F7] relative">
      {/* Loader */}
      {loading && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-50">
          <p className="text-sm text-[#6B778C]">Updating team…</p>
        </div>
      )}

      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#172B4D]">Team Management</h1>
          <p className="text-[#5E6C84] text-sm mt-1">
            {teamMembers.length} team members
          </p>
        </div>
        <Button
          className="bg-[#0052CC] text-white hover:bg-[#0747A6]"
          onClick={openAddMemberModal}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Add Member
        </Button>
      </header>

      {/* Group Filter */}
      <div className="mb-6 flex gap-2">
        <Button
          variant={selectedGroup === null ? "default" : "outline"}
          onClick={() => setSelectedGroup(null)}
          className={selectedGroup === null ? "bg-[#0052CC] text-white" : ""}
        >
          All Members
        </Button>
        {groups.map((group) => (
          <Button
            key={group}
            variant={selectedGroup === group ? "default" : "outline"}
            onClick={() => setSelectedGroup(group)}
            className={selectedGroup === group ? "bg-[#0052CC] text-white" : ""}
          >
            {group}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 rounded-lg border bg-white overflow-y-auto">
        <Table>
          <TableHeader className="bg-[#F4F5F7] sticky top-0">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Group</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredMembers.length > 0 ? (
              filteredMembers.map((member: any) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar} />
                        <AvatarFallback>{member.name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="font-semibold">{member.name}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {member.email}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      className={
                        member.id === selectedProject?.ownerId
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                      }
                    >
                      {member.id === selectedProject?.ownerId ? "Admin" : "Member"}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className="bg-[#EBECF0]">
                      {member.group}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500"
                      onClick={() => handleDeleteMember(member.id, member.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  No members found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Member Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createdCreds ? "Member added" : "Add team member"}
            </DialogTitle>
          </DialogHeader>

          {addedExisting ? (
            <div className="space-y-4">
              <p className="text-sm text-[#5E6C84]">
                {addedExisting.name} already has an account and has been added
                to this project directly.
              </p>
              <div className="flex justify-end">
                <Button
                  className="bg-[#0052CC] text-white hover:bg-[#0747A6]"
                  onClick={() => setIsAddOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : invited ? (
            <div className="space-y-4">
              <p className="text-sm text-[#5E6C84]">
                {invited.name} has been added to this project. Tell them to
                go to the login page and enter <strong>{invited.email}</strong> —
                they'll be prompted to create their own password.
              </p>
              <div className="flex justify-end">
                <Button
                  className="bg-[#0052CC] text-white hover:bg-[#0747A6]"
                  onClick={() => setIsAddOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAddmember} className="space-y-4">
              {addError && (
                <div className="flex gap-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{addError}</span>
                </div>
              )}
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  name="name"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  name="email"
                  placeholder="jane@example.com"
                  value={form.email}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Group</Label>
                <Input
                  name="group"
                  placeholder="group"
                  value={form.group}
                  onChange={handleFormChange}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#0052CC] text-white hover:bg-[#0747A6]"
                  disabled={loading}
                >
                  {loading ? "Adding..." : "Add Member"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default page;