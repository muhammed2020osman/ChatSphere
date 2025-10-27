"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface BulkActionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTicketIds: string[];
  onSuccess: () => void;
}

const TICKET_STATUSES = [
  { value: "Open", label: "Open" },
  { value: "In Review", label: "In Review" },
  { value: "Awaiting Info", label: "Awaiting Info" },
  { value: "In Progress", label: "In Progress" },
  { value: "Resolved", label: "Resolved" },
  { value: "Closed", label: "Closed" },
];

const PRIORITIES = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
  { value: "Blocker", label: "Blocker" },
];

export function BulkActionsDialog({
  isOpen,
  onClose,
  selectedTicketIds,
  onSuccess,
}: BulkActionsDialogProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [priority, setPriority] = useState<string | undefined>(undefined);
  const [assignedTo, setAssignedTo] = useState<string | undefined>(undefined);
  const [addTagInput, setAddTagInput] = useState("");
  const [tagsToAdd, setTagsToAdd] = useState<string[]>([]);
  const [removeTagInput, setRemoveTagInput] = useState("");
  const [tagsToRemove, setTagsToRemove] = useState<string[]>([]);

  // Fetch users for assignee dropdown
  const { data: users, isLoading: isLoadingUsers } = useQuery<Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  }>>({
    queryKey: ['/api/users'],
    enabled: isOpen,
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      const updates: any = {};
      
      if (status) updates.status = status;
      if (priority) updates.priority = priority;
      if (assignedTo) updates.assignedTo = assignedTo;
      
      // For tags, we need to handle them specially
      // The backend should support adding/removing tags
      if (tagsToAdd.length > 0) {
        updates.addTags = tagsToAdd;
      }
      if (tagsToRemove.length > 0) {
        updates.removeTags = tagsToRemove;
      }

      return await apiRequest('/api/tickets/bulk', {
        method: 'PATCH',
        body: JSON.stringify({
          ticketIds: selectedTicketIds,
          updates,
        }),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      toast({
        title: "Bulk update successful",
        description: `Updated ${data.updated || selectedTicketIds.length} ticket(s) successfully.`,
      });
      onSuccess();
      handleClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update tickets. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle add tag
  const handleAddTag = () => {
    const tag = addTagInput.trim();
    if (tag && !tagsToAdd.includes(tag)) {
      setTagsToAdd([...tagsToAdd, tag]);
      setAddTagInput("");
    }
  };

  // Handle remove tag from add list
  const handleRemoveTagFromAdd = (tag: string) => {
    setTagsToAdd(tagsToAdd.filter((t) => t !== tag));
  };

  // Handle add tag to remove list
  const handleAddTagToRemove = () => {
    const tag = removeTagInput.trim();
    if (tag && !tagsToRemove.includes(tag)) {
      setTagsToRemove([...tagsToRemove, tag]);
      setRemoveTagInput("");
    }
  };

  // Handle remove tag from remove list
  const handleRemoveTagFromRemove = (tag: string) => {
    setTagsToRemove(tagsToRemove.filter((t) => t !== tag));
  };

  // Handle close
  const handleClose = () => {
    // Reset form
    setStatus(undefined);
    setPriority(undefined);
    setAssignedTo(undefined);
    setAddTagInput("");
    setTagsToAdd([]);
    setRemoveTagInput("");
    setTagsToRemove([]);
    onClose();
  };

  // Handle apply
  const handleApply = async () => {
    // Check if at least one action is selected
    if (!status && !priority && !assignedTo && tagsToAdd.length === 0 && tagsToRemove.length === 0) {
      toast({
        title: "No actions selected",
        description: "Please select at least one action to apply.",
        variant: "destructive",
      });
      return;
    }

    await bulkUpdateMutation.mutateAsync();
  };

  // Count active actions
  const activeActionsCount = [
    status,
    priority,
    assignedTo,
    tagsToAdd.length > 0,
    tagsToRemove.length > 0,
  ].filter(Boolean).length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" data-testid="dialog-bulk-actions">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Bulk Actions</DialogTitle>
          <DialogDescription>
            Apply actions to {selectedTicketIds.length} selected ticket{selectedTicketIds.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Selected Tickets Count */}
            <div className="p-4 bg-muted rounded-md">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="font-semibold" data-testid="text-selected-count">
                  {selectedTicketIds.length} ticket{selectedTicketIds.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              {activeActionsCount > 0 && (
                <p className="text-sm text-muted-foreground mt-2" data-testid="text-actions-count">
                  {activeActionsCount} action{activeActionsCount !== 1 ? 's' : ''} will be applied
                </p>
              )}
            </div>

            <Separator />

            {/* Change Status */}
            <div className="space-y-2">
              <Label htmlFor="status" className="text-base font-semibold">
                Change Status
              </Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status" data-testid="select-status">
                  <SelectValue placeholder="Select new status..." />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value} data-testid={`select-item-status-${s.value.toLowerCase().replace(/\s+/g, '-')}`}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {status && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" data-testid="badge-selected-status">
                    New status: {status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setStatus(undefined)}
                    data-testid="button-clear-status"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Change Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority" className="text-base font-semibold">
                Change Priority
              </Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="priority" data-testid="select-priority">
                  <SelectValue placeholder="Select new priority..." />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value} data-testid={`select-item-priority-${p.value.toLowerCase()}`}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {priority && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" data-testid="badge-selected-priority">
                    New priority: {priority}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPriority(undefined)}
                    data-testid="button-clear-priority"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Assign To */}
            <div className="space-y-2">
              <Label htmlFor="assignee" className="text-base font-semibold">
                Assign To
              </Label>
              {isLoadingUsers ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger id="assignee" data-testid="select-assignee">
                    <SelectValue placeholder="Select assignee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id} data-testid={`select-item-assignee-${user.id}`}>
                        {user.firstName} {user.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {assignedTo && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" data-testid="badge-selected-assignee">
                    Assignee: {users?.find((u) => u.id === assignedTo)?.firstName} {users?.find((u) => u.id === assignedTo)?.lastName}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAssignedTo(undefined)}
                    data-testid="button-clear-assignee"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {/* Add Tags */}
            <div className="space-y-2">
              <Label htmlFor="add-tags" className="text-base font-semibold">
                Add Tags
              </Label>
              <div className="flex gap-2">
                <Input
                  id="add-tags"
                  placeholder="Enter tag name..."
                  value={addTagInput}
                  onChange={(e) => setAddTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  data-testid="input-add-tag"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={!addTagInput.trim()}
                  data-testid="button-add-tag"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {tagsToAdd.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-md" data-testid="container-tags-to-add">
                  {tagsToAdd.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1" data-testid={`badge-add-tag-${tag}`}>
                      {tag}
                      <button
                        onClick={() => handleRemoveTagFromAdd(tag)}
                        className="ml-1 hover:bg-secondary-foreground/10 rounded-full p-0.5"
                        data-testid={`button-remove-add-tag-${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Remove Tags */}
            <div className="space-y-2">
              <Label htmlFor="remove-tags" className="text-base font-semibold">
                Remove Tags
              </Label>
              <div className="flex gap-2">
                <Input
                  id="remove-tags"
                  placeholder="Enter tag name to remove..."
                  value={removeTagInput}
                  onChange={(e) => setRemoveTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTagToRemove();
                    }
                  }}
                  data-testid="input-remove-tag"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleAddTagToRemove}
                  disabled={!removeTagInput.trim()}
                  data-testid="button-add-remove-tag"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {tagsToRemove.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-md" data-testid="container-tags-to-remove">
                  {tagsToRemove.map((tag) => (
                    <Badge key={tag} variant="destructive" className="gap-1" data-testid={`badge-remove-tag-${tag}`}>
                      {tag}
                      <button
                        onClick={() => handleRemoveTagFromRemove(tag)}
                        className="ml-1 hover:bg-destructive-foreground/10 rounded-full p-0.5"
                        data-testid={`button-remove-remove-tag-${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Warning if no actions */}
            {activeActionsCount === 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-semibold">No actions selected</p>
                    <p className="mt-1">Please select at least one action to apply to the selected tickets.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={bulkUpdateMutation.isPending}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={bulkUpdateMutation.isPending || activeActionsCount === 0}
            data-testid="button-apply"
          >
            {bulkUpdateMutation.isPending ? (
              <>Applying...</>
            ) : (
              <>Apply to {selectedTicketIds.length} Ticket{selectedTicketIds.length !== 1 ? 's' : ''}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
