"use client";

import { useState, useMemo, useCallback, memo } from "react";
import { FileText, Download, History, MoreVertical, Grid3x3, List, Upload, Bot, Edit, ChevronLeft, ChevronRight } from "lucide-react";
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
import Link from "next/link";
import type { DrawingWithDetails } from "@/lib/db/schema";

type ViewMode = "grid" | "list";

// Memoized badge components for performance
const UploadMethodBadge = memo(({ method, planId }: { method?: string; planId: string }) => {
  if (!method) return null;
  
  return method === 'ai' ? (
    <Badge variant="default" className="gap-1" data-testid={`badge-upload-method-${planId}`}>
      <Bot className="h-3 w-3" />
      <span>AI</span>
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1" data-testid={`badge-upload-method-${planId}`}>
      <Edit className="h-3 w-3" />
      <span>يدوي</span>
    </Badge>
  );
});
UploadMethodBadge.displayName = "UploadMethodBadge";

const RevisionCountBadge = memo(({ count, planId }: { count?: number; planId: string }) => {
  if (!count || count <= 1) return null;
  
  return (
    <Badge variant="outline" className="gap-1" data-testid={`badge-revision-count-${planId}`}>
      <History className="h-3 w-3" />
      <span>{count} إصدارات</span>
    </Badge>
  );
});
RevisionCountBadge.displayName = "RevisionCountBadge";

export default function PlansManagement() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [buildingFilter, setBuildingFilter] = useState<string>("all");
  const [floorFilter, setFloorFilter] = useState<string>("all");
  const [disciplineFilter, setDisciplineFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: paginatedData, isLoading } = useQuery<{
    drawings: DrawingWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['/api/drawings', currentPage],
    queryFn: async () => {
      const res = await fetch(`/api/drawings?page=${currentPage}&limit=30`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch drawings");
      return await res.json();
    },
  });

  const plans = paginatedData?.drawings || [];

  // Memoized utility functions for performance
  const getStatusColor = useCallback((status: string) => {
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
  }, []);

  const getRelativeTime = useCallback((dateInput: string | Date) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  }, []);

  const getStatusLabel = useCallback((status: string) => {
    switch (status) {
      case "approved": return "Approved";
      case "under_review": return "Under Review";
      case "draft": return "Draft";
      case "rejected": return "Rejected";
      case "superseded": return "Superseded";
      default: return "Unknown";
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
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
        <div className="flex-1 overflow-y-auto p-6 bg-background/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-[4/3] w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

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
        {!plans || plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No plans found</h2>
            <p className="text-muted-foreground mb-4">Upload your first construction plan to get started.</p>
            <Link href="/ingest-plans">
              <Button className="gap-2" data-testid="button-upload-plans-empty">
                <Upload className="h-4 w-4" />
                <span>Upload Plans</span>
              </Button>
            </Link>
          </div>
        ) : viewMode === "grid" ? (
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
                    {plan.latestRevision?.thumbnailUrl ? (
                      <img
                        src={plan.latestRevision.thumbnailUrl}
                        alt={plan.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
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
                    {plan.latestRevision?.uploadedAt 
                      ? `Last updated: ${getRelativeTime(plan.latestRevision.uploadedAt)}`
                      : "No revisions yet"}
                  </p>
                  
                  {/* Badges Section */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <UploadMethodBadge 
                      method={plan.latestRevision?.uploadMethod} 
                      planId={plan.id} 
                    />
                    <RevisionCountBadge 
                      count={plan.revisionCount} 
                      planId={plan.id} 
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
                    {plan.latestRevision?.status && (
                      <Badge className={getStatusColor(plan.latestRevision.status)}>
                        {getStatusLabel(plan.latestRevision.status)}
                      </Badge>
                    )}
                    {plan.latestRevision?.revisionNo && (
                      <span className="text-sm font-semibold text-foreground/80">
                        Version {plan.latestRevision.revisionNo}
                      </span>
                    )}
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
                    {plan.latestRevision?.thumbnailUrl ? (
                      <img
                        src={plan.latestRevision.thumbnailUrl}
                        alt={plan.title}
                        className="w-full h-full object-cover rounded"
                        loading="lazy"
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
                      {plan.discipline.name} • {plan.floor?.name || "No floor"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-wrap">
                  {/* Badges Section */}
                  <div className="flex items-center gap-2">
                    <UploadMethodBadge 
                      method={plan.latestRevision?.uploadMethod} 
                      planId={plan.id} 
                    />
                    <RevisionCountBadge 
                      count={plan.revisionCount} 
                      planId={plan.id} 
                    />
                  </div>
                  
                  {plan.latestRevision?.status && (
                    <div className="text-center">
                      <Badge className={getStatusColor(plan.latestRevision.status)}>
                        {getStatusLabel(plan.latestRevision.status)}
                      </Badge>
                    </div>
                  )}
                  
                  {plan.latestRevision?.revisionNo && (
                    <div className="text-sm text-foreground/80 w-24 text-center">
                      Version {plan.latestRevision.revisionNo}
                    </div>
                  )}
                  
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

        {/* Pagination Controls */}
        {paginatedData && paginatedData.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="flex items-center gap-1">
              {/* Always show first page */}
              {paginatedData.totalPages > 5 && currentPage > 3 && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(1)}
                    data-testid="button-page-1"
                  >
                    1
                  </Button>
                  <span className="px-2">...</span>
                </>
              )}
              
              {/* Show pages around current page */}
              {Array.from({ length: paginatedData.totalPages }, (_, i) => i + 1)
                .filter(pageNum => {
                  // Show pages near current page
                  if (paginatedData.totalPages <= 5) return true;
                  if (pageNum === 1 || pageNum === paginatedData.totalPages) return false;
                  return Math.abs(pageNum - currentPage) <= 1;
                })
                .map(pageNum => (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="icon"
                    onClick={() => setCurrentPage(pageNum)}
                    data-testid={`button-page-${pageNum}`}
                  >
                    {pageNum}
                  </Button>
                ))}
              
              {/* Always show last page */}
              {paginatedData.totalPages > 5 && currentPage < paginatedData.totalPages - 2 && (
                <>
                  <span className="px-2">...</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentPage(paginatedData.totalPages)}
                    data-testid={`button-page-${paginatedData.totalPages}`}
                  >
                    {paginatedData.totalPages}
                  </Button>
                </>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(p => Math.min(paginatedData.totalPages, p + 1))}
              disabled={currentPage === paginatedData.totalPages}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            
            <div className="ml-4 text-sm text-muted-foreground">
              Page {currentPage} of {paginatedData.totalPages} • {paginatedData.total} total plans
            </div>
          </div>
        )}
      </div>
    </div>
  );
}