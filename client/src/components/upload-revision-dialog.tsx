import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const uploadRevisionSchema = z.object({
  revisionNo: z.string().min(1, "Revision number is required"),
  file: z.instanceof(File, { message: "Please select a file" }),
});

type UploadRevisionForm = z.infer<typeof uploadRevisionSchema>;

interface UploadRevisionDialogProps {
  drawingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadRevisionDialog({ drawingId, open, onOpenChange }: UploadRevisionDialogProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<UploadRevisionForm>({
    resolver: zodResolver(uploadRevisionSchema),
    defaultValues: {
      revisionNo: "",
      file: undefined,
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadRevisionForm) => {
      if (!drawingId) throw new Error("No drawing selected");
      
      setIsUploading(true);

      try {
        // Get upload URL
        const uploadResponse = await (await apiRequest("POST", "/api/objects/upload")).json() as { uploadURL: string };

        // Upload file to object storage
        await fetch(uploadResponse.uploadURL, {
          method: "PUT",
          body: data.file,
          headers: {
            "Content-Type": data.file.type || "application/pdf",
          },
        });

        // Set ACL policy
        const aclResponse = await (await apiRequest("PUT", "/api/attachments", {
          attachmentURL: uploadResponse.uploadURL,
          fileName: data.file.name,
        })).json() as { objectPath: string };

        const fileUrl = aclResponse.objectPath;

        // Create revision
        await (await apiRequest("POST", `/api/drawings/${drawingId}/revisions`, {
          revisionNo: data.revisionNo,
          status: "draft",
          fileUrl,
          fileName: data.file.name,
          fileType: data.file.type,
          fileSize: data.file.size.toString(),
        })).json();
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drawings"] });
      queryClient.invalidateQueries({ queryKey: [`/api/drawings/${drawingId}`] });
      toast({
        title: "Success",
        description: "Revision uploaded successfully",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload revision",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UploadRevisionForm) => {
    uploadMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-upload-revision">
        <DialogHeader>
          <DialogTitle>Upload New Revision</DialogTitle>
          <DialogDescription>
            Upload a new revision for this drawing
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="revisionNo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Revision Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., B"
                      {...field}
                      data-testid="input-revision-no"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="file"
              render={({ field: { value, onChange, ...field } }) => (
                <FormItem>
                  <FormLabel>PDF File</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onChange(file);
                      }}
                      data-testid="input-revision-file"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUploading}
                data-testid="button-cancel-revision"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isUploading}
                data-testid="button-submit-revision"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Revision
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
