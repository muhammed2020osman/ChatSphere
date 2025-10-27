"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  Pencil,
  Star,
  StarOff,
  Filter,
  Check,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { SavedView } from "@/shared/schema";
import type { TicketFilters } from "./tickets-filters-panel";

interface SavedViewsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: TicketFilters;
  currentSort: { sortBy: string; sortOrder: 'asc' | 'desc' };
  onLoadView: (view: SavedView) => void;
}

const createViewSchema = z.object({
  name: z.string().min(1, "View name is required").max(100, "Name is too long"),
  description: z.string().max(500, "Description is too long").optional(),
  isDefault: z.boolean().default(false),
  isShared: z.boolean().default(false),
});

type CreateViewFormData = z.infer<typeof createViewSchema>;

export function SavedViewsDialog({
  isOpen,
  onClose,
  currentFilters,
  currentSort,
  onLoadView,
}: SavedViewsDialogProps) {
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [editingView, setEditingView] = useState<SavedView | null>(null);
  const [deleteViewId, setDeleteViewId] = useState<string | null>(null);

  // Fetch saved views
  const { data: savedViews, isLoading } = useQuery<SavedView[]>({
    queryKey: ['/api/saved-views'],
    enabled: isOpen,
  });

  // Count active filters
  const filterCount = useMemo(() => {
    let count = 0;
    if (currentFilters.disciplineId?.length) count += currentFilters.disciplineId.length;
    if (currentFilters.floorId?.length) count += currentFilters.floorId.length;
    if (currentFilters.drawingId?.length) count += currentFilters.drawingId.length;
    if (currentFilters.type?.length) count += currentFilters.type.length;
    if (currentFilters.status?.length) count += currentFilters.status.length;
    if (currentFilters.priority?.length) count += currentFilters.priority.length;
    if (currentFilters.assignedTo?.length) count += currentFilters.assignedTo.length;
    if (currentFilters.layerId?.length) count += currentFilters.layerId.length;
    if (currentFilters.slaStatus) count++;
    if (currentFilters.tags?.length) count += currentFilters.tags.length;
    if (currentFilters.dateFrom || currentFilters.dateTo) count++;
    return count;
  }, [currentFilters]);

  // Create/Update view mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateViewFormData & { filters: TicketFilters; sortBy: string; sortOrder: string; viewType: string }) => {
      if (editingView) {
        return await apiRequest(`/api/saved-views/${editingView.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      } else {
        return await apiRequest('/api/saved-views', {
          method: 'POST',
          body: JSON.stringify(data),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-views'] });
      toast({
        title: editingView ? "View updated" : "View created",
        description: editingView 
          ? "The saved view has been updated successfully."
          : "The new view has been created successfully.",
      });
      setIsCreating(false);
      setEditingView(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save view. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete view mutation
  const deleteMutation = useMutation({
    mutationFn: async (viewId: string) => {
      return await apiRequest(`/api/saved-views/${viewId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/saved-views'] });
      toast({
        title: "View deleted",
        description: "The saved view has been deleted successfully.",
      });
      setDeleteViewId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete view. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Form for creating/editing views
  const form = useForm<CreateViewFormData>({
    resolver: zodResolver(createViewSchema),
    defaultValues: {
      name: "",
      description: "",
      isDefault: false,
      isShared: false,
    },
  });

  // Handle create new view
  const handleCreateNew = () => {
    form.reset({
      name: "",
      description: "",
      isDefault: false,
      isShared: false,
    });
    setEditingView(null);
    setIsCreating(true);
  };

  // Handle edit view
  const handleEdit = (view: SavedView) => {
    form.reset({
      name: view.name,
      description: view.description || "",
      isDefault: view.isDefault,
      isShared: view.isShared,
    });
    setEditingView(view);
    setIsCreating(true);
  };

  // Handle save view
  const handleSave = async (data: CreateViewFormData) => {
    await createMutation.mutateAsync({
      ...data,
      filters: currentFilters,
      sortBy: currentSort.sortBy,
      sortOrder: currentSort.sortOrder,
      viewType: 'table', // For now, default to table
    });
  };

  // Handle load view
  const handleLoad = (view: SavedView) => {
    onLoadView(view);
    onClose();
  };

  // Handle delete view
  const handleDelete = async () => {
    if (deleteViewId) {
      await deleteMutation.mutateAsync(deleteViewId);
    }
  };

  // Cancel create/edit
  const handleCancel = () => {
    setIsCreating(false);
    setEditingView(null);
    form.reset();
  };

  // Get filter count for a view
  const getViewFilterCount = (view: SavedView) => {
    const filters = view.filters as TicketFilters;
    let count = 0;
    if (filters.disciplineId?.length) count += filters.disciplineId.length;
    if (filters.floorId?.length) count += filters.floorId.length;
    if (filters.drawingId?.length) count += filters.drawingId.length;
    if (filters.type?.length) count += filters.type.length;
    if (filters.status?.length) count += filters.status.length;
    if (filters.priority?.length) count += filters.priority.length;
    if (filters.assignedTo?.length) count += filters.assignedTo.length;
    if (filters.layerId?.length) count += filters.layerId.length;
    if (filters.slaStatus) count++;
    if (filters.tags?.length) count += filters.tags.length;
    if (filters.dateFrom || filters.dateTo) count++;
    return count;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" data-testid="dialog-saved-views">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {isCreating ? (editingView ? "Edit View" : "Create New View") : "Saved Views"}
            </DialogTitle>
            <DialogDescription>
              {isCreating
                ? "Configure your custom view with filters and sort settings."
                : "Manage your saved views to quickly access filtered ticket lists."}
            </DialogDescription>
          </DialogHeader>

          {isCreating ? (
            // Create/Edit View Form
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSave)} className="flex-1 flex flex-col gap-4 overflow-hidden">
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-4">
                    {/* View Name */}
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>View Name *</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., High Priority Open Tickets"
                              {...field}
                              data-testid="input-view-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* View Description */}
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Optional description of this view..."
                              className="resize-none"
                              rows={3}
                              {...field}
                              data-testid="textarea-view-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Current Settings Summary */}
                    <div className="p-4 bg-muted rounded-md space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Filter className="h-4 w-4" />
                        <span>Current Settings</span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>
                          <span className="font-medium">Filters:</span> {filterCount} active
                        </div>
                        <div>
                          <span className="font-medium">Sort:</span> {currentSort.sortBy} ({currentSort.sortOrder})
                        </div>
                      </div>
                    </div>

                    {/* Set as Default */}
                    <FormField
                      control={form.control}
                      name="isDefault"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-is-default"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Set as default view</FormLabel>
                            <FormDescription>
                              This view will be loaded automatically when you open Tickets Hub
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />

                    {/* Share with Team */}
                    <FormField
                      control={form.control}
                      name="isShared"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-is-shared"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Share with team</FormLabel>
                            <FormDescription>
                              Other team members will be able to see and use this view
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </ScrollArea>

                {/* Form Actions */}
                <Separator />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={createMutation.isPending}
                    data-testid="button-cancel-view"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-save-view"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {editingView ? "Update View" : "Create View"}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            // List Views
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              {/* Create New Button */}
              <Button
                onClick={handleCreateNew}
                className="w-full"
                data-testid="button-create-new-view"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New View
              </Button>

              <Separator />

              {/* Views List */}
              <ScrollArea className="flex-1">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : savedViews && savedViews.length > 0 ? (
                  <div className="space-y-3">
                    {savedViews.map((view) => (
                      <div
                        key={view.id}
                        className="p-4 border rounded-md hover-elevate active-elevate-2 space-y-3"
                        data-testid={`card-saved-view-${view.id}`}
                      >
                        {/* View Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-base truncate" data-testid={`text-view-name-${view.id}`}>
                                {view.name}
                              </h3>
                              {view.isDefault && (
                                <Badge variant="secondary" className="shrink-0" data-testid={`badge-default-${view.id}`}>
                                  <Star className="h-3 w-3 mr-1" />
                                  Default
                                </Badge>
                              )}
                              {view.isShared && (
                                <Badge variant="outline" className="shrink-0" data-testid={`badge-shared-${view.id}`}>
                                  Shared
                                </Badge>
                              )}
                            </div>
                            {view.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-view-description-${view.id}`}>
                                {view.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* View Details */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1" data-testid={`text-filter-count-${view.id}`}>
                            <Filter className="h-3 w-3" />
                            <span>{getViewFilterCount(view)} filters</span>
                          </div>
                          {view.createdAt && (
                            <div data-testid={`text-created-date-${view.id}`}>
                              Created {format(new Date(view.createdAt), 'MMM d, yyyy')}
                            </div>
                          )}
                        </div>

                        {/* View Actions */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleLoad(view)}
                            className="flex-1"
                            data-testid={`button-load-view-${view.id}`}
                          >
                            Load View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(view)}
                            data-testid={`button-edit-view-${view.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteViewId(view.id)}
                            data-testid={`button-delete-view-${view.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-full bg-muted p-3 mb-4">
                      <Filter className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2" data-testid="text-no-views">No saved views</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Create your first saved view to quickly access your most used filter combinations.
                    </p>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteViewId} onOpenChange={(open) => !open && setDeleteViewId(null)}>
        <AlertDialogContent data-testid="dialog-delete-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Saved View</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this saved view? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
