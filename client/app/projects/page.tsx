"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/lib/AuthContext";
import axiosInstance from "@/lib/Axiosinstance";
import { Calendar, Plus, Users } from "lucide-react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

const page = () => {
  const router = useRouter();
  const { user, setSelectedProject } = useAuth();
  const [project, setProject] = useState([]);
  const [issuesbyproject, setissuesbyproject] = useState<any>({});
  const [loading, setloading] = useState(false);
  const fetchproject = async () => {
    try {
      setloading(true);
      const res = await axiosInstance.get("api/projects");
      const userproject = res.data?.filter(
        (p: any) => p.ownerId === user?.id || p.memberIds?.includes(user?.id),
      );
      setProject(userproject);
    } catch (error) {
      console.error(error);
    } finally {
      setloading(false);
    }
  };
  const fetchissuesforproject = async (projectid: string) => {
    try {
      const res = await axiosInstance.get(`api/issues/project/${projectid}`);
      setissuesbyproject((prev: any) => ({
        ...prev,
        [projectid]: res.data,
      }));
    } catch (error) {
      console.error(error);
    }
  };
  useEffect(() => {
    if (!user) return;
    fetchproject();
  }, [user]);
  useEffect(() => {
    project.forEach((project: any) => {
      fetchissuesforproject(project.id);
    });
  }, [project]);
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#6B778C]">
        Loading projects…
      </div>
    );
  }
  const redirectproject = () => {
    router.push("/create-project");
  };
  return (
    <div className="flex h-full flex-col p-6 overflow-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#172B4D] mb-2">Projects</h1>
        <p className="text-[#5E6C84]">Manage and view all your projects</p>
      </div>

      <Button
        className="mb-6 bg-[#0052CC] text-white hover:bg-[#0747A6] w-fit"
        onClick={redirectproject}
      >
        <Plus className="h-4 w-4 mr-2" />
        Create Project
      </Button>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {project.map((project: any) => {
          const projectIssues = issuesbyproject[project.id] || [];

          return (
            <Card
              key={project.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-[#172B4D] flex items-center gap-2">
                      {project.name}
                      {project.ownerId === user?.id && (
                        <span className="text-[10px] font-bold text-[#0052CC] bg-[#DEEBFF] px-1.5 py-0.5 rounded">
                          PM
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>Key: {project.key}</CardDescription>
                  </div>
                  <Badge variant="outline">{project.key}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm text-[#5E6C84]">
                    {project.description || "No description"}
                  </p>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2 text-[#5E6C84]">
                      <Users className="h-4 w-4" />
                      <span>{project.memberIds?.length || 0} members</span>
                    </div>
                    <div className="flex items-center gap-2 text-[#5E6C84]">
                      <span>{projectIssues.length} issues</span>
                    </div>
                  </div>

                  {}

                  <Link href={`/`} onClick={() => setSelectedProject(project)}>
                    <Button
                      variant="outline"
                      className="w-full mt-4 text-[#0052CC] border-[#0052CC] hover:bg-[#DEEBFF] bg-transparent"
                    >
                      View Board
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {project.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full">
          <p className="text-[#5E6C84] mb-4">No projects yet</p>
          <Button
            className="bg-[#0052CC] text-white hover:bg-[#0747A6]"
            onClick={redirectproject}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create your first project
          </Button>
        </div>
      )}
    </div>
  );
};

export default page;
