import { useState } from "react";
import { FileText, Download, History, MoreVertical, Grid3x3, List, Upload, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

type ViewMode = "grid" | "list";

interface Plan {
  id: string;
  sheetNo: string;
  title: string;
  discipline: {
    code: string;
    name: string;
  };
  floor: {
    code: string;
    name: string;
  };
  latestRevision: {
    revisionNo: string;
    status: string;
    uploadedAt: string;
    fileUrl: string;
  };
  thumbnailUrl?: string;
}

export default function PlansManagement() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [buildingFilter, setBuildingFilter] = useState<string>("all");
  const [floorFilter, setFloorFilter] = useState<string>("all");
  const [disciplineFilter, setDisciplineFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Mock data for now - will be replaced with API call
  const mockPlans: Plan[] = [
    {
      id: "1",
      sheetNo: "A-101",
      title: "Architectural - Floor 02 - Tower A",
      discipline: { code: "ARCH", name: "Architectural" },
      floor: { code: "02", name: "Floor 02" },
      latestRevision: {
        revisionNo: "3",
        status: "approved",
        uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        fileUrl: "#",
      },
      thumbnailUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuClkpxrlywCUB6FBFEpz1MqmUVNsaboO4lQx_daxG5RrVolhPaqKLc_1J3XzZcB9iSKMFSSOldOPQxZvgPKdFjc0-nJQBUa3aeoCD12S1uRft2fh59pBU-YiPmMdPdJdiMdRJjQzebBz4CsQDDxBNLK2i2iaSUbhoAjtgDTjg73Uvbut66h6QqemaISlluWiRUy2DTes7feeGkY0VE4QHA4TOXmuEHcrZiY8V26ujQANak4A_aOpFmjn_Z7W7r97w8jUOoFwCZmOOI",
    },
    // Add more mock data as needed
  ];

  const plans = mockPlans;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "under_review":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "draft":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Page Header */}
      <div className="px-6 py-4 border-b border-border bg-card">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground">
              Construction Plans
            </h1>
            <p className="text-muted-foreground text-base font-normal leading-normal">
              Manage, upload, and view different construction plans for KSA projects.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/ingest-plans">
              <Button className="gap-2" data-testid="button-upload-plans">
                <Upload className="h-4 w-4" />
                <span>Upload Plans</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between gap-4">
          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto">
            <Select value={buildingFilter} onValueChange={setBuildingFilter}>
              <SelectTrigger className="w-32" data-testid="select-building">
                <SelectValue placeholder="Building" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Buildings</SelectItem>
                <SelectItem value="tower-a">Tower A</SelectItem>
                <SelectItem value="tower-b">Tower B</SelectItem>
              </SelectContent>
            </Select>

            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="w-28" data-testid="select-floor">
                <SelectValue placeholder="Floor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Floors</SelectItem>
                <SelectItem value="g">Ground</SelectItem>
                <SelectItem value="01">Floor 01</SelectItem>
                <SelectItem value="02">Floor 02</SelectItem>
              </SelectContent>
            </Select>

            <Select value={disciplineFilter} onValueChange={setDisciplineFilter}>
              <SelectTrigger className="w-32" data-testid="select-discipline">
                <SelectValue placeholder="Discipline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Disciplines</SelectItem>
                <SelectItem value="arch">Architectural</SelectItem>
                <SelectItem value="str">Structural</SelectItem>
                <SelectItem value="mep">MEP</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-28" data-testid="select-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* View Toggle */}
          <div className="flex h-10 items-center justify-center rounded-lg bg-muted p-1 w-40">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex h-full grow items-center justify-center overflow-hidden rounded-md px-2 text-sm font-medium leading-normal ${
                viewMode === "grid"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground"
              }`}
              data-testid="button-view-grid"
            >
              <Grid3x3 className="h-4 w-4 mr-2" />
              <span>Grid</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex h-full grow items-center justify-center overflow-hidden rounded-md px-2 text-sm font-medium leading-normal ${
                viewMode === "list"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground"
              }`}
              data-testid="button-view-list"
            >
              <List className="h-4 w-4 mr-2" />
              <span>List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Plans Grid/List */}
      <div className="flex-1 overflow-y-auto p-6 bg-background/30">
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className="overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col border"
                data-testid={`card-plan-${plan.id}`}
              >
                {/* Thumbnail */}
                <Link href={`/sheets/${plan.id}`}>
                  <div className="aspect-[4/3] bg-muted flex items-center justify-center cursor-pointer hover-elevate">
                    {plan.thumbnailUrl ? (
                      <img
                        src={plan.thumbnailUrl}
                        alt={plan.title}
                        className="w-full h-full object-cover"
                        data-testid={`img-plan-${plan.id}`}
                      />
                    ) : (
                      <FileText className="h-16 w-16 text-muted-foreground" />
                    )}
                  </div>
                </Link>

                {/* Content */}
                <div className="p-4 flex flex-col flex-grow">
                  <h3 className="font-bold text-foreground" data-testid={`text-plan-title-${plan.id}`}>
                    {plan.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Last updated: {getRelativeTime(plan.latestRevision.uploadedAt)}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <Badge className={getStatusColor(plan.latestRevision.status)}>
                      {plan.latestRevision.status === "approved" ? "Approved" : 
                       plan.latestRevision.status === "under_review" ? "Under Review" : 
                       plan.latestRevision.status === "draft" ? "Draft" : "Unknown"}
                    </Badge>
                    <span className="text-sm font-semibold text-foreground/80">
                      Version {plan.latestRevision.revisionNo}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 border-t border-border flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-primary"
                    data-testid={`button-download-${plan.id}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-primary"
                    data-testid={`button-history-${plan.id}`}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary"
                        data-testid={`button-more-${plan.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>Edit Metadata</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className="p-4 flex items-center justify-between hover:shadow-md transition-shadow"
                data-testid={`row-plan-${plan.id}`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-16 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
                    {plan.thumbnailUrl ? (
                      <img
                        src={plan.thumbnailUrl}
                        alt={plan.title}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/sheets/${plan.id}`}>
                      <h3 className="font-bold text-foreground hover:text-primary cursor-pointer">
                        {plan.sheetNo} - {plan.title}
                      </h3>
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {plan.discipline.name} • {plan.floor.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <Badge className={getStatusColor(plan.latestRevision.status)}>
                      {plan.latestRevision.status === "approved" ? "Approved" : 
                       plan.latestRevision.status === "under_review" ? "Under Review" : "Draft"}
                    </Badge>
                  </div>
                  <div className="text-sm text-foreground/80 w-24 text-center">
                    Version {plan.latestRevision.revisionNo}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <History className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
