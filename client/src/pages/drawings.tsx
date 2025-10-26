import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Upload, Filter, Search, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadDrawingDialog } from "@/components/upload-drawing-dialog";
import { DrawingViewerDialog } from "@/components/drawing-viewer-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { DrawingWithDetails, Discipline, Floor } from "@shared/schema";
import { format } from "date-fns";

export default function Drawings() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [disciplineFilter, setDisciplineFilter] = useState<string>("all");
  const [floorFilter, setFloorFilter] = useState<string>("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [viewerDialogOpen, setViewerDialogOpen] = useState(false);

  const { data: drawings, isLoading: drawingsLoading } = useQuery<DrawingWithDetails[]>({
    queryKey: ["/api/drawings"],
  });

  const { data: disciplines } = useQuery<Discipline[]>({
    queryKey: ["/api/disciplines"],
  });

  const { data: floors } = useQuery<Floor[]>({
    queryKey: ["/api/floors"],
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      "under review": { variant: "default", label: "Under Review" },
      approved: { variant: "default", label: "Approved" },
      rejected: { variant: "destructive", label: "Rejected" },
      superseded: { variant: "secondary", label: "Superseded" },
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return (
      <Badge variant={config.variant} data-testid={`badge-status-${status}`}>
        {config.label}
      </Badge>
    );
  };

  const filteredDrawings = drawings?.filter((drawing) => {
    const matchesSearch = 
      (drawing.sheetNo || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (drawing.title || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === "all" || 
      drawing.latestRevision?.status === statusFilter;
    
    const matchesDiscipline = 
      disciplineFilter === "all" || 
      drawing.disciplineId === disciplineFilter;
    
    const matchesFloor = 
      floorFilter === "all" || 
      drawing.floorId === floorFilter;

    return matchesSearch && matchesStatus && matchesDiscipline && matchesFloor;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="heading-drawings">
              Engineering Drawings
            </h1>
          </div>
          <Button 
            onClick={() => setUploadDialogOpen(true)}
            data-testid="button-upload-drawing"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Drawing
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by number or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-drawings"
              />
            </div>
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="under review">Under Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="superseded">Superseded</SelectItem>
            </SelectContent>
          </Select>

          <Select value={disciplineFilter} onValueChange={setDisciplineFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-discipline-filter">
              <SelectValue placeholder="Discipline" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Disciplines</SelectItem>
              {disciplines?.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name || 'N/A'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={floorFilter} onValueChange={setFloorFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-floor-filter">
              <SelectValue placeholder="Floor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Floors</SelectItem>
              {floors?.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        {drawingsLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredDrawings && filteredDrawings.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Drawing Number</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Discipline</TableHead>
                <TableHead>Floor</TableHead>
                <TableHead>Revision</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrawings.map((drawing) => (
                <TableRow key={drawing.id} data-testid={`row-drawing-${drawing.id}`}>
                  <TableCell className="font-mono font-medium" data-testid={`text-number-${drawing.id}`}>
                    {(() => {
                      try {
                        const data = typeof drawing.data === 'string' ? JSON.parse(drawing.data || '{}') : drawing.data || {};
                        return data.sheetNo || drawing.name || 'N/A';
                      } catch {
                        return drawing.name || 'N/A';
                      }
                    })()}
                  </TableCell>
                  <TableCell data-testid={`text-title-${drawing.id}`}>
                    {drawing.name || 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" data-testid={`badge-discipline-${drawing.id}`}>
                      {drawing.discipline?.name || 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-floor-${drawing.id}`}>
                    {drawing.floor?.name || "N/A"}
                  </TableCell>
                  <TableCell className="font-mono" data-testid={`text-revision-${drawing.id}`}>
                    {(() => {
                      try {
                        const data = typeof drawing.data === 'string' ? JSON.parse(drawing.data || '{}') : drawing.data || {};
                        return data.revisionNo || drawing.latestRevision?.version || drawing.latestRevision?.revisionNo || "—";
                      } catch {
                        return drawing.latestRevision?.version || drawing.latestRevision?.revisionNo || "—";
                      }
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      try {
                        const data = typeof drawing.data === 'string' ? JSON.parse(drawing.data || '{}') : drawing.data || {};
                        const status = data.status || drawing.latestRevision?.status;
                        return status ? getStatusBadge(status) : <Badge variant="secondary">No Revision</Badge>;
                      } catch {
                        return drawing.latestRevision?.status 
                          ? getStatusBadge(drawing.latestRevision.status)
                          : <Badge variant="secondary">No Revision</Badge>;
                      }
                    })()}
                  </TableCell>
                  <TableCell data-testid={`text-updated-${drawing.id}`}>
                    {drawing.updatedAt && format(new Date(drawing.updatedAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedDrawingId(drawing.id);
                          setViewerDialogOpen(true);
                        }}
                        data-testid={`button-view-${drawing.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {drawing.latestRevision?.fileUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-download-${drawing.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-3">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground" />
              <h3 className="text-lg font-semibold">No drawings found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery || statusFilter !== "all" || disciplineFilter !== "all" || floorFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Upload your first drawing to get started"}
              </p>
            </div>
          </div>
        )}
      </div>

      <UploadDrawingDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />

      <DrawingViewerDialog
        drawingId={selectedDrawingId}
        open={viewerDialogOpen}
        onOpenChange={setViewerDialogOpen}
      />
    </div>
  );
}
