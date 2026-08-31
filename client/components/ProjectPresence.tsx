"use client";

import React, { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { getUserById } from "@/lib/userCache";
import { useAuth } from "@/lib/AuthContext";

const ProjectPresence = () => {
  const { user, activeProjectUserIds } = useAuth();
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchUsers = async () => {
      const others = activeProjectUserIds.filter((id) => id !== user?.id);
      const results = await Promise.all(others.map((id) => getUserById(id)));
      if (!cancelled) {
        setUsers(results.filter(Boolean));
      }
    };

    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [activeProjectUserIds, user?.id]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-1" title={`${users.length} other viewer(s) online`}>
      <div className="flex -space-x-2">
        {users.slice(0, 4).map((u: any) => (
          <Avatar key={u.id} className="h-5 w-5 border-2 border-white ring-1 ring-green-500">
            <AvatarImage src={u.avatar} />
            <AvatarFallback className="text-[8px]">{u.name?.[0]}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      {users.length > 4 && (
        <span className="text-[10px] text-[#5E6C84]">+{users.length - 4}</span>
      )}
    </div>
  );
};

export default ProjectPresence;