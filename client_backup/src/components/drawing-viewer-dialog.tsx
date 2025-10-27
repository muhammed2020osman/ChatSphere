import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, FileText, X, Check, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
// import type { DrawingWithDetails } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UploadRevisionDialog } from "./upload-revision-dialog";

interface DrawingViewerDialogProps {
  drawingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DrawingViewerDialog({ drawingId, open, onOpenChange }: DrawingViewerDialogProps) {
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [reviewingRevisionId, setReviewingRevisionId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const { toast } = useToast();

  const { data: drawing, isLoading } = useQuery<any>({
    queryKey: [`/api/drawings/${drawingId}`],
    enabled: !!drawingId && open,
  });

  const { data: revisions = [], refetch: refetchRevisions } = useQuery<any[]>({
    queryKey: [`/api/drawings/${drawingId}/revisions`],
    enabled: !!drawingId && open,
  });

  // Refetch revisions when revision dialog closes (after upload)
  useEffect(() => {
    if (!revisionDialogOpen && drawingId) {
      refetchRevisions();
    }
  }, [revisionDialogOpen, drawingId, refetchRevisions]);

  const reviewMutation = useMutation({
    mutationFn: async ({ revisionId, status, notes }: { revisionId: string; status: string; notes?: string }) => {
      await apiRequest(`/api/revisions/${revisionId}/status`, {
        method: "PATCH",
        body: {
          status,
          reviewNotes: notes || undefined,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drawings"] });
      queryClient.invalidateQueries({ queryKey: [`/api/drawings/${drawingId}`] });
      setReviewingRevisionId(null);
      setReviewNotes("");
      toast({
        title: "Success",
        description: "Revision status updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update revision status",
        variant: "destructive",
      });
    },
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
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleDownload = (fileUrl: string, fileName: string) => {
    window.open(`/api${fileUrl}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]" data-testid="dialog-drawing-viewer">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Drawing Details
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : drawing ? (
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6 pr-4">
              {/* Drawing Info */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Drawing Number</p>
                    <p className="font-mono font-semibold text-lg" data-testid="text-sheet-no">
                      {drawing.sheetNo}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Revision</p>
                    <p className="font-mono font-semibold text-lg" data-testid="text-current-revision">
                      {drawing.latestRevision?.revisionNo || "—"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Title</p>
                  <p className="text-lg font-medium" data-testid="text-drawing-title">
                    {drawing.title}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Discipline</p>
                    <Badge variant="secondary" className="mt-1" data-testid="badge-drawing-discipline">
                      {drawing.discipline?.name || 'N/A'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Floor</p>
                    <p className="mt-1" data-testid="text-drawing-floor">
                      {drawing.floor?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Package</p>
                    <p className="mt-1" data-testid="text-drawing-package">
                      {drawing.packageName || "N/A"}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Created By</p>
                  <p className="mt-1" data-testid="text-drawing-creator">
                    {drawing.creator?.firstName && drawing.creator?.lastName
                      ? `${drawing.creator.firstName} ${drawing.creator.lastName}`
                      : drawing.creator?.email || 'Unknown'}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Drawing Preview */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Drawing Preview</h3>
                {revisions && revisions.length > 0 ? (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    {(() => {
                      try {
                        const latestRevision = revisions[0]; // First revision is latest
                        const changes = typeof latestRevision.changes === 'string' 
                          ? JSON.parse(latestRevision.changes) 
                          : latestRevision.changes || {};
                        const fileUrl = changes.fileUrl;
                        const fileName = changes.fileName;
                        const fileType = changes.fileType;
                        
                        if (fileUrl && fileName) {
                          if (fileType === 'application/pdf') {
                            return (
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                  Latest revision: {latestRevision.version || 'N/A'} - {fileName}
                                </p>
                                <div className="border rounded bg-white p-4">
                                  <iframe
                                    src={`http://localhost:5000${fileUrl}`}
                                    width="100%"
                                    height="600"
                                    className="border-0"
                                    title={`Drawing: ${fileName}`}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      window.open(`http://localhost:5000${fileUrl}`, '_blank');
                                    }}
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Open in New Tab
                                  </Button>
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                  Latest revision: {latestRevision.version || 'N/A'} - {fileName}
                                </p>
                                <div className="border rounded bg-white p-4">
                                  <img
                                    src={`http://localhost:5000${fileUrl}`}
                                    alt={`Drawing: ${fileName}`}
                                    className="max-w-full h-auto"
                                    style={{ maxHeight: '600px' }}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      window.open(`http://localhost:5000${fileUrl}`, '_blank');
                                    }}
                                  >
                                    <Download className="w-4 h-4 mr-2" />
                                    Open in New Tab
                                  </Button>
                                </div>
                              </div>
                            );
                          }
                        } else {
                          return (
                            <div className="text-center py-8 text-muted-foreground">
                              <FileText className="w-12 h-12 mx-auto mb-2" />
                              <p>No drawing file available</p>
                            </div>
                          );
                        }
                      } catch (error) {
                        return (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="w-12 h-12 mx-auto mb-2" />
                            <p>Error loading drawing preview</p>
                          </div>
                        );
                      }
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-2" />
                    <p>No revisions available</p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Revision History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Revision History</h3>
                  <Button 
                    size="sm" 
                    onClick={() => setRevisionDialogOpen(true)}
                    data-testid="button-add-revision"
                  >
                    Upload New Revision
                  </Button>
                </div>

                {revisions && revisions.length > 0 ? (
                  <div className="space-y-3">
                    {revisions.map((revision: any) => (
                      <div
                        key={revision.id}
                        className="border rounded-md p-4 space-y-2"
                        data-testid={`revision-card-${revision.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-3">
                              <p className="font-mono font-semibold" data-testid={`text-revision-no-${revision.id}`}>
                                Revision {revision.version || revision.revisionNo || 'N/A'}
                              </p>
                              {getStatusBadge(revision.status || (() => {
                                try {
                                  const changes = typeof revision.changes === 'string' ? JSON.parse(revision.changes) : revision.changes || {};
                                  return changes.status || 'draft';
                                } catch {
                                  return 'draft';
                                }
                              })())}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Uploaded by{" "}
                              {revision.uploader?.firstName && revision.uploader?.lastName
                                ? `${revision.uploader.firstName} ${revision.uploader.lastName}`
                                : revision.uploader?.email || 'Unknown'}{" "}
                              {(revision.uploadedAt || revision.createdAt) && `on ${format(new Date(revision.uploadedAt || revision.createdAt), "MMM d, yyyy 'at' h:mm a")}`}
                            </p>
                            {revision.reviewedBy && revision.reviewedAt && (
                              <p className="text-sm text-muted-foreground">
                                Reviewed by{" "}
                                {revision.reviewer?.firstName && revision.reviewer?.lastName
                                  ? `${revision.reviewer.firstName} ${revision.reviewer.lastName}`
                                  : revision.reviewer?.email || 'Unknown'}{" "}
                                on {format(new Date(revision.reviewedAt), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            )}
                            {revision.reviewNotes && (
                              <p className="text-sm mt-2">
                                <span className="font-medium">Review Notes:</span> {revision.reviewNotes}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                try {
                                  const changes = typeof revision.changes === 'string' ? JSON.parse(revision.changes) : revision.changes || {};
                                  handleDownload(changes.fileUrl, changes.fileName);
                                } catch {
                                  console.error('Error parsing revision changes');
                                }
                              }}
                              data-testid={`button-download-revision-${revision.id}`}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          </div>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          {(() => {
                            try {
                              const changes = typeof revision.changes === 'string' ? JSON.parse(revision.changes) : revision.changes || {};
                              return (
                                <>
                                  <span>File: {changes.fileName || 'Unknown'}</span>
                                  {changes.fileSize && (
                                    <span>Size: {(parseInt(changes.fileSize) / 1024 / 1024).toFixed(2)} MB</span>
                                  )}
                                </>
                              );
                            } catch {
                              return <span>File: Unknown</span>;
                            }
                          })()}
                        </div>

                        {/* Review Section */}
                        {(() => {
                          try {
                            const changes = typeof revision.changes === 'string' ? JSON.parse(revision.changes) : revision.changes || {};
                            const status = revision.status || changes.status || 'draft';
                            return status === "draft" || status === "under review";
                          } catch {
                            return true;
                          }
                        })() ? (
                          reviewingRevisionId === revision.id ? (
                            <div className="pt-3 space-y-3 border-t">
                              <Textarea
                                placeholder="Add review notes (optional)..."
                                value={reviewNotes}
                                onChange={(e) => setReviewNotes(e.target.value)}
                                className="min-h-[80px]"
                                data-testid={`textarea-review-notes-${revision.id}`}
                              />
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setReviewingRevisionId(null);
                                    setReviewNotes("");
                                  }}
                                  data-testid={`button-cancel-review-${revision.id}`}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => reviewMutation.mutate({ 
                                    revisionId: revision.id, 
                                    status: "rejected",
                                    notes: reviewNotes 
                                  })}
                                  disabled={reviewMutation.isPending}
                                  data-testid={`button-reject-${revision.id}`}
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => reviewMutation.mutate({ 
                                    revisionId: revision.id, 
                                    status: "approved",
                                    notes: reviewNotes 
                                  })}
                                  disabled={reviewMutation.isPending}
                                  data-testid={`button-approve-${revision.id}`}
                                >
                                  <Check className="w-4 h-4 mr-2" />
                                  Approve
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="pt-3 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setReviewingRevisionId(revision.id)}
                                data-testid={`button-start-review-${revision.id}`}
                              >
                                Review Revision
                              </Button>
                            </div>
                          )
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No revisions available</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Drawing not found</p>
          </div>
        )}
      </DialogContent>
      
      <UploadRevisionDialog
        drawingId={drawingId}
        open={revisionDialogOpen}
        onOpenChange={setRevisionDialogOpen}
      />
    </Dialog>
  );
}
